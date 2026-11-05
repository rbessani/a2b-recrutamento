-- Executar SOMENTE após publicar e validar o código novo.
-- APIs usam service_role; o frontend não acessa tabelas diretamente.
-- Escopo: somente as tabelas documentadas, a view e os dois buckets.
BEGIN;
DO $$ DECLARE nome text; BEGIN
 FOREACH nome IN ARRAY ARRAY['alternativas_questionario','arquivos_candidatos','avaliacoes_ia','candidatos','empresas','logs_processamento','perguntas_questionario','questionarios','respostas_questionario_candidato','resultado_comportamental','vagas'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', nome);
  EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated, PUBLIC', nome);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', nome);
 END LOOP;
END $$;
REVOKE ALL PRIVILEGES ON TABLE public.vw_ranking FROM anon, authenticated, PUBLIC;
GRANT SELECT ON TABLE public.vw_ranking TO service_role;
UPDATE storage.buckets SET public=false WHERE id IN ('audios','curriculos');
COMMIT;
-- Não adicionar políticas de acesso público para compensar falhas nas APIs.
