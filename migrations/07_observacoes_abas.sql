-- Não regrava observações nem notas existentes. Aplicar sobre 04/05/06.
BEGIN;
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
 nova:=anterior; -- Justificativas ficam em analises_curriculo, separadas das anotações.
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
 VALUES(p_empresa,p_candidato,'avaliacao_curriculo_ia','sucesso','Avaliação confirmada pelo recrutador.',jsonb_build_object('responsavel','admin','origem','curriculo_ia','analise_id',a.id));
 UPDATE public.analises_curriculo SET status='aplicada',aplicada_em=now() WHERE id=a.id;
 RETURN jsonb_build_object('ok',true,'observacao',nova,'score_curriculo',av.score_curriculo,'score_audio',av.score_audio,'score_comportamental',av.score_comportamental,'score_final',av.score_final);
END $$;
CREATE OR REPLACE FUNCTION public.bsn_salvar_observacao_recrutador(p_empresa uuid,p_candidato uuid,p_texto text,p_base text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE anterior text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_candidato::text,1605));
 IF p_texto IS NULL OR length(p_texto)>10000 THEN RETURN jsonb_build_object('erro','Use até 10.000 caracteres.','status',400); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.candidatos WHERE id=p_candidato AND empresa_id=p_empresa) THEN RETURN jsonb_build_object('erro','Candidato não encontrado.','status',404); END IF;
 SELECT detalhes->>'observacao' INTO anterior FROM public.logs_processamento WHERE empresa_id=p_empresa AND candidato_id=p_candidato AND etapa='observacao_recrutador' AND jsonb_typeof(detalhes->'observacao')='string' ORDER BY created_at DESC,id DESC LIMIT 1;
 IF anterior IS NULL THEN SELECT json_avaliacao->'avaliacao_manual'->>'observacao' INTO anterior FROM public.avaliacoes_ia WHERE empresa_id=p_empresa AND candidato_id=p_candidato AND ativo=true; END IF;
 anterior:=coalesce(anterior,'');
 IF p_base IS NOT NULL AND p_base IS DISTINCT FROM anterior THEN RETURN jsonb_build_object('erro','As observações foram atualizadas em outro acesso. Seu rascunho continua no campo; copie-o e atualize a lista para conferir.','status',409); END IF;
 INSERT INTO public.logs_processamento(empresa_id,candidato_id,etapa,status,mensagem,detalhes) VALUES(p_empresa,p_candidato,'observacao_recrutador','sucesso','Observação interna salva pelo recrutador.',jsonb_build_object('observacao',p_texto,'responsavel','admin'));
 RETURN jsonb_build_object('observacao',p_texto);
END $$;
CREATE OR REPLACE FUNCTION public.bsn_confirmar_analise_audio(p_empresa uuid,p_candidato uuid,p_analise uuid,p_observacao_base text,p_criterios jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a public.analises_audio%ROWTYPE; c public.candidatos%ROWTYPE; v public.vagas%ROWTYPE; av public.avaliacoes_ia%ROWTYPE;
 nota numeric; comp numeric; anterior text; nova text; snapshot_atual jsonb; versao integer; f public.arquivos_candidatos%ROWTYPE; k text; val numeric; peso numeric; permitidos jsonb; texto_criterios text:=''; aviso text; resumo text;
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
 nova:=anterior; aviso:='Nota do áudio salva. As justificativas estão na aba Áudio; suas observações foram preservadas.';
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
 VALUES(p_empresa,p_candidato,'avaliacao_audio_ia','sucesso','Avaliação confirmada pelo recrutador.',jsonb_build_object('responsavel','admin','origem','audio_ia','analise_id',a.id));
 UPDATE public.analises_audio SET status='aplicada',aplicada_em=now(),resultado=resultado||jsonb_build_object('criterios_confirmados',p_criterios,'nota_confirmada',nota) WHERE id=a.id;
 RETURN jsonb_build_object('ok',true,'observacao',nova,'score_curriculo',av.score_curriculo,'score_audio',av.score_audio,'score_comportamental',av.score_comportamental,'score_final',av.score_final,'aviso',aviso);
END $$;
REVOKE ALL ON FUNCTION public.bsn_confirmar_analise_curriculo(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bsn_confirmar_analise_curriculo(uuid,uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.bsn_confirmar_analise_audio(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bsn_confirmar_analise_audio(uuid,uuid,uuid,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.bsn_salvar_observacao_recrutador(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bsn_salvar_observacao_recrutador(uuid,uuid,text,text) TO service_role;
COMMIT;
