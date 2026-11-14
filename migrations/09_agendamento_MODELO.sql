-- MODELO: executar SOMENTE depois do deploy e das variáveis da Vercel.
-- Substituir COLE_O_SEGREDO_AQUI pelo MESMO segredo aleatório da variável
-- CANDIDATURA_WORKER_SECRET. Não publicar a cópia preenchida no GitHub/chat.
-- Cron + pg_net + Vault: agendamento não depende do navegador aberto.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$ BEGIN
 IF 'COLE_O_SEGREDO_AQUI'='COLE_'||'O_SEGREDO_AQUI' THEN RAISE EXCEPTION 'Preencha o segredo antes de executar. Nenhuma automação ativada.'; END IF;
 IF EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='bsn_worker_secret') THEN
 PERFORM vault.update_secret((SELECT id FROM vault.decrypted_secrets WHERE name='bsn_worker_secret' LIMIT 1),'COLE_O_SEGREDO_AQUI');
 ELSE PERFORM vault.create_secret('COLE_O_SEGREDO_AQUI','bsn_worker_secret');END IF;
END $$;
SELECT cron.schedule('bsn-fila-candidaturas','* * * * *',$job$
 SELECT net.http_post(
  url:='https://a2b-recrutamento.vercel.app/api/interno/processar-fila',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='bsn_worker_secret' LIMIT 1)),
  body:='{}'::jsonb,timeout_milliseconds:=65000
 );
$job$);
-- Ativa SOMENTE depois de verificar o endpoint com o script indicado no guia.
-- Execute este bloco separadamente como último passo:
-- INSERT INTO public.config_candidaturas(empresa_id,ativa)
-- SELECT id,true FROM public.empresas WHERE id='SEU_NEXT_PUBLIC_EMPRESA_ID'::uuid
-- ON CONFLICT(empresa_id) DO UPDATE SET ativa=true;
