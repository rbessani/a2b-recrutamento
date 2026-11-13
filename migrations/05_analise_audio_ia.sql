-- Somente esta migração é nova. Não executar novamente os SQLs 01/02/03.
-- Não modifica candidatos/notas existentes. Não toca buckets nem permissões antigas.
BEGIN;
CREATE TABLE IF NOT EXISTS public.analises_audio (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
 candidato_id uuid NOT NULL REFERENCES public.candidatos(id) ON DELETE CASCADE,
 arquivo_id uuid NOT NULL REFERENCES public.arquivos_candidatos(id) ON DELETE CASCADE,
 contexto_hash text NOT NULL CHECK (contexto_hash ~ '^[0-9a-f]{64}$'),
 vaga_snapshot jsonb NOT NULL,
 modelo text NOT NULL,
 versao_prompt text NOT NULL,
 status text NOT NULL DEFAULT 'processando' CHECK(status IN ('processando','pronta','aplicada','erro')),
 resultado jsonb, observacao text, request_id text, uso jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), aplicada_em timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_analise_audio_contexto ON public.analises_audio(empresa_id,candidato_id,contexto_hash) WHERE status<>'erro';
CREATE INDEX IF NOT EXISTS idx_analise_audio_limite ON public.analises_audio(empresa_id,created_at);
ALTER TABLE public.analises_audio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analises_audio FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.analises_audio TO service_role;

CREATE OR REPLACE FUNCTION public.bsn_iniciar_analise_audio(p_empresa uuid,p_candidato uuid,p_arquivo uuid,p_contexto text,p_vaga jsonb,p_modelo text,p_prompt text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a public.analises_audio%ROWTYPE;
BEGIN
 -- Limite compartilhado entre instâncias: no máximo 30 chamadas novas por empresa/hora.
 -- O lock é curto: a chamada de IA ocorre fora da transação.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa::text,1704));
 IF NOT EXISTS(SELECT 1 FROM public.candidatos c JOIN public.arquivos_candidatos f ON f.candidato_id=c.id AND f.empresa_id=c.empresa_id WHERE c.id=p_candidato AND c.empresa_id=p_empresa AND f.id=p_arquivo AND f.tipo='audio' AND f.ativo=true) THEN
  RETURN jsonb_build_object('erro','Áudio indisponível. Atualize a lista.','status',409);
 END IF;
 UPDATE public.analises_audio SET status='erro' WHERE empresa_id=p_empresa AND status='processando' AND created_at<now()-interval '3 minutes';
 SELECT * INTO a FROM public.analises_audio WHERE empresa_id=p_empresa AND candidato_id=p_candidato AND contexto_hash=p_contexto AND status<>'erro';
 IF FOUND THEN
  IF a.status='processando' THEN RETURN jsonb_build_object('erro','Análise em andamento. Aguarde e consulte novamente.','status',409); END IF;
  RETURN jsonb_build_object('nova',false,'registro',jsonb_build_object('id',a.id,'status',a.status,'resultado',a.resultado,'observacao',a.observacao,'modelo',a.modelo,'created_at',a.created_at));
 END IF;
 IF EXISTS(SELECT 1 FROM public.analises_audio WHERE empresa_id=p_empresa AND candidato_id=p_candidato AND status='processando') THEN RETURN jsonb_build_object('erro','Já existe uma análise em andamento para este candidato. Aguarde.','status',409); END IF;
 IF (SELECT count(*) FROM public.analises_audio WHERE empresa_id=p_empresa AND created_at>now()-interval '1 hour')>=30 THEN
  RETURN jsonb_build_object('erro','Limite de 30 análises novas por hora atingido. Tente mais tarde.','status',429);
 END IF;
 INSERT INTO public.analises_audio(empresa_id,candidato_id,arquivo_id,contexto_hash,vaga_snapshot,modelo,versao_prompt) VALUES(p_empresa,p_candidato,p_arquivo,p_contexto,p_vaga,p_modelo,p_prompt) RETURNING * INTO a;
 RETURN jsonb_build_object('nova',true,'registro',jsonb_build_object('id',a.id));
END $$;

CREATE OR REPLACE FUNCTION public.bsn_confirmar_analise_audio(p_empresa uuid,p_candidato uuid,p_analise uuid,p_observacao_base text,p_criterios jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a public.analises_audio%ROWTYPE; c public.candidatos%ROWTYPE; v public.vagas%ROWTYPE; av public.avaliacoes_ia%ROWTYPE;
 nota numeric; comp numeric; anterior text; nova text; snapshot_atual jsonb; versao integer; f public.arquivos_candidatos%ROWTYPE; k text; val numeric; peso numeric; permitidos jsonb; texto_criterios text:='';
BEGIN
 -- Mesmo lock da gravação manual nova: preserva edições concorrentes.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_candidato::text,1605));
 SELECT * INTO c FROM public.candidatos WHERE id=p_candidato AND empresa_id=p_empresa FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('erro','Candidato não encontrado.','status',404); END IF;
 SELECT * INTO a FROM public.analises_audio WHERE id=p_analise AND candidato_id=p_candidato AND empresa_id=p_empresa FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('erro','Análise não encontrada.','status',404); END IF;
 IF a.status NOT IN ('pronta','aplicada') THEN RETURN jsonb_build_object('erro','A análise ainda não está pronta.','status',409); END IF;
 SELECT * INTO av FROM public.avaliacoes_ia WHERE candidato_id=p_candidato AND empresa_id=p_empresa AND ativo=true FOR UPDATE;
 SELECT detalhes->>'observacao' INTO anterior FROM public.logs_processamento WHERE candidato_id=p_candidato AND empresa_id=p_empresa AND etapa='observacao_recrutador' AND jsonb_typeof(detalhes->'observacao')='string' ORDER BY created_at DESC,id DESC LIMIT 1;
 anterior:=coalesce(anterior,av.json_avaliacao->'avaliacao_manual'->>'observacao','');
 IF a.status='aplicada' THEN RETURN jsonb_build_object('ok',true,'ja_aplicada',true,'observacao',anterior); END IF;
 SELECT * INTO v FROM public.vagas WHERE id=c.vaga_id AND empresa_id=p_empresa FOR SHARE;
 SELECT * INTO f FROM public.arquivos_candidatos WHERE id=a.arquivo_id AND candidato_id=p_candidato AND empresa_id=p_empresa AND tipo='audio' AND ativo=true FOR SHARE;
 snapshot_atual:=jsonb_build_object('id',v.id,'titulo',coalesce(v.titulo,''),'descricao',coalesce(v.descricao,''),'roteiro_audio',f.roteiro_audio);
 IF snapshot_atual IS DISTINCT FROM a.vaga_snapshot OR NOT EXISTS(SELECT 1 FROM public.arquivos_candidatos WHERE id=a.arquivo_id AND candidato_id=p_candidato AND empresa_id=p_empresa AND tipo='audio' AND ativo=true) THEN RETURN jsonb_build_object('erro','A vaga ou o áudio mudou. Gere uma nova análise antes de confirmar.','status',409); END IF;
 IF p_observacao_base IS DISTINCT FROM anterior THEN RETURN jsonb_build_object('erro','As observações mudaram. Atualize a lista e confira o texto antes de confirmar.','status',409); END IF;
 IF a.resultado->>'avaliavel' IS DISTINCT FROM 'true' OR a.observacao IS NULL OR a.observacao='' THEN RETURN jsonb_build_object('erro','Análise inválida. Nenhuma nota foi alterada.','status',409); END IF;
 IF jsonb_typeof(p_criterios) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_criterios))<>10 THEN RETURN jsonb_build_object('erro','Preencha os dez critérios.','status',400); END IF;
 permitidos:='{"diccao":[100,80,60,20],"velocidade":[100,60],"entonacao":[100,80,40],"seguranca":[100,70,30],"naturalidade":[100,70,30],"clareza":[100,70,30],"postura":[100,80,20],"energia":[100,70,30],"conducao":[100,70,30],"script":[100,85,30]}'::jsonb;
 nota:=0;
 FOR k IN SELECT jsonb_object_keys(permitidos) LOOP
  IF jsonb_typeof(p_criterios->k) IS DISTINCT FROM 'number' OR NOT (permitidos->k @> jsonb_build_array(p_criterios->k)) THEN RETURN jsonb_build_object('erro','Critério inválido.','status',400); END IF;
  val:=(p_criterios->>k)::numeric;
  peso:=CASE k WHEN 'diccao' THEN .10 WHEN 'velocidade' THEN .08 WHEN 'entonacao' THEN .10 WHEN 'seguranca' THEN .15 WHEN 'naturalidade' THEN .10 WHEN 'clareza' THEN .15 WHEN 'postura' THEN .10 WHEN 'energia' THEN .07 WHEN 'conducao' THEN .10 WHEN 'script' THEN .05 END;
  nota:=nota+val*peso;
  texto_criterios:=texto_criterios||k||': '||val||'/100; ';
 END LOOP;
 nota:=round(nota);
 nova:=concat_ws(E'\n\n',nullif(anterior,''),'Áudio IA — revisado pelo recrutador. Nota: '||nota||'/100'||E'\n'||texto_criterios||E'\nJustificativas originais da IA (as opções confirmadas estão acima):\n'||a.observacao);
 IF length(nova)>3000 THEN RETURN jsonb_build_object('erro','O texto completo excederia 3.000 caracteres. Reduza e salve suas observações antes de confirmar. Nada foi alterado.','status',409); END IF;
 SELECT score_comportamental INTO comp FROM public.resultado_comportamental WHERE candidato_id=p_candidato AND empresa_id=p_empresa ORDER BY updated_at DESC,created_at DESC,id ASC LIMIT 1;
 comp:=coalesce(comp,0);
 SELECT coalesce(max(versao_avaliacao),0)+1 INTO versao FROM public.avaliacoes_ia WHERE candidato_id=p_candidato;
 INSERT INTO public.avaliacoes_ia(empresa_id,vaga_id,candidato_id,versao_avaliacao,ativo,score_curriculo,score_audio,score_comportamental,score_final,json_avaliacao)
 VALUES(p_empresa,c.vaga_id,p_candidato,versao,true,coalesce(av.score_curriculo,0),nota,comp,round(comp*.4+coalesce(av.score_curriculo,0)*.3+nota*.3),jsonb_build_object('audio_ia',jsonb_build_object('analise_id',a.id,'modelo',a.modelo,'versao_prompt',a.versao_prompt,'resultado',a.resultado,'criterios_confirmados',p_criterios,'revisado_por','admin','confirmado_em',now()),'avaliacao_manual',coalesce(av.json_avaliacao->'avaliacao_manual','{}'::jsonb)||jsonb_build_object('criterios_audio',p_criterios)))
 ON CONFLICT(candidato_id) WHERE ativo=true DO UPDATE SET
 score_audio=EXCLUDED.score_audio,score_comportamental=EXCLUDED.score_comportamental,
 score_final=round(EXCLUDED.score_comportamental*.4+coalesce(avaliacoes_ia.score_curriculo,0)*.3+EXCLUDED.score_audio*.3),
 json_avaliacao=coalesce(avaliacoes_ia.json_avaliacao,'{}'::jsonb)||EXCLUDED.json_avaliacao,updated_at=now()
 RETURNING * INTO av;
 INSERT INTO public.logs_processamento(empresa_id,candidato_id,etapa,status,mensagem,detalhes)
 VALUES(p_empresa,p_candidato,'observacao_recrutador','sucesso','Justificativas da IA acrescentadas após revisão do recrutador.',jsonb_build_object('observacao',nova,'responsavel','admin','origem','audio_ia','analise_id',a.id));
 UPDATE public.analises_audio SET status='aplicada',aplicada_em=now(),resultado=resultado||jsonb_build_object('criterios_confirmados',p_criterios,'nota_confirmada',nota) WHERE id=a.id;
 RETURN jsonb_build_object('ok',true,'observacao',nova,'score_curriculo',av.score_curriculo,'score_audio',av.score_audio,'score_comportamental',av.score_comportamental,'score_final',av.score_final);
END $$;
REVOKE ALL ON FUNCTION public.bsn_iniciar_analise_audio(uuid,uuid,uuid,text,jsonb,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bsn_confirmar_analise_audio(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bsn_iniciar_analise_audio(uuid,uuid,uuid,text,jsonb,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bsn_confirmar_analise_audio(uuid,uuid,uuid,text,jsonb) TO service_role;
COMMIT;
