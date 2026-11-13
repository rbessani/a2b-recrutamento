-- Somente esta migração é nova. Não executar novamente os SQLs 01/02/03.
-- Não modifica candidatos/notas existentes. Não toca buckets nem permissões antigas.
BEGIN;
CREATE TABLE IF NOT EXISTS public.analises_curriculo (
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_analise_curriculo_contexto ON public.analises_curriculo(empresa_id,candidato_id,contexto_hash) WHERE status<>'erro';
CREATE INDEX IF NOT EXISTS idx_analise_curriculo_limite ON public.analises_curriculo(empresa_id,created_at);
ALTER TABLE public.analises_curriculo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analises_curriculo FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.analises_curriculo TO service_role;

CREATE OR REPLACE FUNCTION public.bsn_iniciar_analise_curriculo(p_empresa uuid,p_candidato uuid,p_arquivo uuid,p_contexto text,p_vaga jsonb,p_modelo text,p_prompt text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a public.analises_curriculo%ROWTYPE;
BEGIN
 -- Limite compartilhado entre instâncias: no máximo 30 chamadas novas por empresa/hora.
 -- O lock é curto: a chamada de IA ocorre fora da transação.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa::text,1604));
 IF NOT EXISTS(SELECT 1 FROM public.candidatos c JOIN public.arquivos_candidatos f ON f.candidato_id=c.id AND f.empresa_id=c.empresa_id WHERE c.id=p_candidato AND c.empresa_id=p_empresa AND f.id=p_arquivo AND f.tipo='curriculo' AND f.ativo=true) THEN
  RETURN jsonb_build_object('erro','Currículo indisponível. Atualize a lista.','status',409);
 END IF;
 UPDATE public.analises_curriculo SET status='erro' WHERE empresa_id=p_empresa AND status='processando' AND created_at<now()-interval '3 minutes';
 SELECT * INTO a FROM public.analises_curriculo WHERE empresa_id=p_empresa AND candidato_id=p_candidato AND contexto_hash=p_contexto AND status<>'erro';
 IF FOUND THEN
  IF a.status='processando' THEN RETURN jsonb_build_object('erro','Análise em andamento. Aguarde e consulte novamente.','status',409); END IF;
  RETURN jsonb_build_object('nova',false,'registro',jsonb_build_object('id',a.id,'status',a.status,'resultado',a.resultado,'observacao',a.observacao,'modelo',a.modelo,'created_at',a.created_at));
 END IF;
 IF EXISTS(SELECT 1 FROM public.analises_curriculo WHERE empresa_id=p_empresa AND candidato_id=p_candidato AND status='processando') THEN RETURN jsonb_build_object('erro','Já existe uma análise em andamento para este candidato. Aguarde.','status',409); END IF;
 IF (SELECT count(*) FROM public.analises_curriculo WHERE empresa_id=p_empresa AND created_at>now()-interval '1 hour')>=30 THEN
  RETURN jsonb_build_object('erro','Limite de 30 análises novas por hora atingido. Tente mais tarde.','status',429);
 END IF;
 INSERT INTO public.analises_curriculo(empresa_id,candidato_id,arquivo_id,contexto_hash,vaga_snapshot,modelo,versao_prompt) VALUES(p_empresa,p_candidato,p_arquivo,p_contexto,p_vaga,p_modelo,p_prompt) RETURNING * INTO a;
 RETURN jsonb_build_object('nova',true,'registro',jsonb_build_object('id',a.id));
END $$;

CREATE OR REPLACE FUNCTION public.bsn_confirmar_analise_curriculo(p_empresa uuid,p_candidato uuid,p_analise uuid,p_observacao_base text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a public.analises_curriculo%ROWTYPE; c public.candidatos%ROWTYPE; v public.vagas%ROWTYPE; av public.avaliacoes_ia%ROWTYPE;
 nota numeric; comp numeric; anterior text; nova text; snapshot_atual jsonb; versao integer;
BEGIN
 -- Mesmo lock da gravação manual nova: preserva edições concorrentes.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_candidato::text,1605));
 SELECT * INTO c FROM public.candidatos WHERE id=p_candidato AND empresa_id=p_empresa FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('erro','Candidato não encontrado.','status',404); END IF;
 SELECT * INTO a FROM public.analises_curriculo WHERE id=p_analise AND candidato_id=p_candidato AND empresa_id=p_empresa FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('erro','Análise não encontrada.','status',404); END IF;
 IF a.status NOT IN ('pronta','aplicada') THEN RETURN jsonb_build_object('erro','A análise ainda não está pronta.','status',409); END IF;
 SELECT * INTO av FROM public.avaliacoes_ia WHERE candidato_id=p_candidato AND empresa_id=p_empresa AND ativo=true FOR UPDATE;
 SELECT detalhes->>'observacao' INTO anterior FROM public.logs_processamento WHERE candidato_id=p_candidato AND empresa_id=p_empresa AND etapa='observacao_recrutador' AND jsonb_typeof(detalhes->'observacao')='string' ORDER BY created_at DESC,id DESC LIMIT 1;
 anterior:=coalesce(anterior,av.json_avaliacao->'avaliacao_manual'->>'observacao','');
 IF a.status='aplicada' THEN RETURN jsonb_build_object('ok',true,'ja_aplicada',true,'observacao',anterior); END IF;
 SELECT * INTO v FROM public.vagas WHERE id=c.vaga_id AND empresa_id=p_empresa FOR SHARE;
 snapshot_atual:=jsonb_build_object('id',v.id,'titulo',coalesce(v.titulo,''),'descricao',coalesce(v.descricao,''),'requisitos_obrigatorios',coalesce(v.requisitos_obrigatorios,''),'diferenciais',coalesce(v.diferenciais,''));
 IF snapshot_atual IS DISTINCT FROM a.vaga_snapshot OR NOT EXISTS(SELECT 1 FROM public.arquivos_candidatos WHERE id=a.arquivo_id AND candidato_id=p_candidato AND empresa_id=p_empresa AND tipo='curriculo' AND ativo=true) THEN RETURN jsonb_build_object('erro','A vaga ou o currículo mudou. Gere uma nova análise antes de confirmar.','status',409); END IF;
 IF p_observacao_base IS DISTINCT FROM anterior THEN RETURN jsonb_build_object('erro','As observações mudaram. Atualize a lista e confira o texto antes de confirmar.','status',409); END IF;
 IF a.resultado->>'legivel' IS DISTINCT FROM 'true' OR a.observacao IS NULL OR a.observacao='' THEN RETURN jsonb_build_object('erro','Análise inválida. Nenhuma nota foi alterada.','status',409); END IF;
 nota:=(a.resultado->>'nota')::numeric;
 IF nota IS NULL OR nota<0 OR nota>100 THEN RAISE EXCEPTION 'Nota inválida'; END IF;
 nova:=CASE WHEN anterior='' THEN a.observacao ELSE anterior||E'\n\n'||a.observacao END;
 IF length(nova)>3000 THEN RETURN jsonb_build_object('erro','O texto completo excederia 3.000 caracteres. Reduza e salve suas observações antes de confirmar. Nada foi alterado.','status',409); END IF;
 SELECT score_comportamental INTO comp FROM public.resultado_comportamental WHERE candidato_id=p_candidato AND empresa_id=p_empresa ORDER BY updated_at DESC,created_at DESC,id ASC LIMIT 1;
 comp:=coalesce(comp,0);
 SELECT coalesce(max(versao_avaliacao),0)+1 INTO versao FROM public.avaliacoes_ia WHERE candidato_id=p_candidato;
 INSERT INTO public.avaliacoes_ia(empresa_id,vaga_id,candidato_id,versao_avaliacao,ativo,score_curriculo,score_audio,score_comportamental,score_final,json_avaliacao)
 VALUES(p_empresa,c.vaga_id,p_candidato,versao,true,nota,coalesce(av.score_audio,0),comp,round(comp*.4+nota*.3+coalesce(av.score_audio,0)*.3),jsonb_build_object('curriculo_ia',jsonb_build_object('analise_id',a.id,'modelo',a.modelo,'versao_prompt',a.versao_prompt,'resultado',a.resultado,'revisado_por','admin','confirmado_em',now())))
 ON CONFLICT(candidato_id) WHERE ativo=true DO UPDATE SET
 score_curriculo=EXCLUDED.score_curriculo,score_comportamental=EXCLUDED.score_comportamental,
 score_final=round(EXCLUDED.score_comportamental*.4+EXCLUDED.score_curriculo*.3+coalesce(avaliacoes_ia.score_audio,0)*.3),
 json_avaliacao=coalesce(avaliacoes_ia.json_avaliacao,'{}'::jsonb)||EXCLUDED.json_avaliacao,updated_at=now()
 RETURNING * INTO av;
 INSERT INTO public.logs_processamento(empresa_id,candidato_id,etapa,status,mensagem,detalhes)
 VALUES(p_empresa,p_candidato,'observacao_recrutador','sucesso','Justificativas da IA acrescentadas após revisão do recrutador.',jsonb_build_object('observacao',nova,'responsavel','admin','origem','curriculo_ia','analise_id',a.id));
 UPDATE public.analises_curriculo SET status='aplicada',aplicada_em=now() WHERE id=a.id;
 RETURN jsonb_build_object('ok',true,'observacao',nova,'score_curriculo',av.score_curriculo,'score_audio',av.score_audio,'score_comportamental',av.score_comportamental,'score_final',av.score_final);
END $$;
CREATE OR REPLACE FUNCTION public.bsn_salvar_observacao_recrutador(p_empresa uuid,p_candidato uuid,p_texto text,p_base text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE anterior text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_candidato::text,1605));
 IF p_texto IS NULL OR length(p_texto)>3000 THEN RETURN jsonb_build_object('erro','Use até 3.000 caracteres.','status',400); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidatos WHERE id=p_candidato AND empresa_id=p_empresa) THEN RETURN jsonb_build_object('erro','Candidato não encontrado.','status',404); END IF;
 SELECT detalhes->>'observacao' INTO anterior FROM public.logs_processamento WHERE empresa_id=p_empresa AND candidato_id=p_candidato AND etapa='observacao_recrutador' AND jsonb_typeof(detalhes->'observacao')='string' ORDER BY created_at DESC,id DESC LIMIT 1;
 IF anterior IS NULL THEN SELECT json_avaliacao->'avaliacao_manual'->>'observacao' INTO anterior FROM public.avaliacoes_ia WHERE empresa_id=p_empresa AND candidato_id=p_candidato AND ativo=true; END IF;
 anterior:=coalesce(anterior,'');
 IF p_base IS NOT NULL AND p_base IS DISTINCT FROM anterior THEN RETURN jsonb_build_object('erro','As observações foram atualizadas em outro acesso. Seu rascunho continua no campo; copie-o e atualize a lista para conferir.','status',409); END IF;
 INSERT INTO public.logs_processamento(empresa_id,candidato_id,etapa,status,mensagem,detalhes) VALUES(p_empresa,p_candidato,'observacao_recrutador','sucesso','Observação interna salva pelo recrutador.',jsonb_build_object('observacao',p_texto,'responsavel','admin'));
 RETURN jsonb_build_object('observacao',p_texto);
END $$;
REVOKE ALL ON FUNCTION public.bsn_salvar_observacao_recrutador(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bsn_salvar_observacao_recrutador(uuid,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.bsn_iniciar_analise_curriculo(uuid,uuid,uuid,text,jsonb,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bsn_confirmar_analise_curriculo(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bsn_iniciar_analise_curriculo(uuid,uuid,uuid,text,jsonb,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.bsn_confirmar_analise_curriculo(uuid,uuid,uuid,text) TO service_role;
COMMIT;
