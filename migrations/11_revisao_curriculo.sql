BEGIN;
-- Reaproveita a confirmação existente e seus bloqueios de contexto/arquivo/concorrência.
CREATE OR REPLACE FUNCTION public.bsn_revisar_curriculo(p_empresa uuid,p_candidato uuid,p_analise uuid,p_observacao_base text,p_nota integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE retorno jsonb;av public.avaliacoes_ia%ROWTYPE;
BEGIN
 IF p_nota IS NULL OR p_nota<0 OR p_nota>100 THEN RETURN jsonb_build_object('erro','Nota inválida. Use 0 a 100.','status',400);END IF;
 retorno:=bsn_confirmar_analise_curriculo(p_empresa,p_candidato,p_analise,p_observacao_base);
 IF retorno ? 'erro' THEN RETURN retorno;END IF;
 IF coalesce((retorno->>'ja_aplicada')::boolean,false) THEN
 SELECT * INTO av FROM avaliacoes_ia WHERE candidato_id=p_candidato AND empresa_id=p_empresa AND ativo=true;
 RETURN retorno||jsonb_build_object('score_curriculo',av.score_curriculo,'score_audio',av.score_audio,'score_comportamental',av.score_comportamental,'score_final',av.score_final);
 END IF;
 UPDATE avaliacoes_ia SET score_curriculo=p_nota,score_final=round(coalesce(score_comportamental,0)*.4+p_nota*.3+coalesce(score_audio,0)*.3),updated_at=now()
 WHERE candidato_id=p_candidato AND empresa_id=p_empresa AND ativo=true RETURNING * INTO av;
 UPDATE analises_curriculo SET resultado=resultado||jsonb_build_object('nota_confirmada',p_nota) WHERE id=p_analise AND empresa_id=p_empresa;
 -- A nota original da IA permanece em resultado.nota. Zero revisado também é válido.
 RETURN retorno||jsonb_build_object('score_curriculo',av.score_curriculo,'score_final',av.score_final);
END $$;
REVOKE ALL ON FUNCTION public.bsn_revisar_curriculo(uuid,uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bsn_revisar_curriculo(uuid,uuid,uuid,text,integer) TO service_role;
COMMIT;
