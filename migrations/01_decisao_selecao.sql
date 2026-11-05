-- Executar antes de publicar os novos arquivos. Não altera notas nem ranking.
BEGIN;
ALTER TABLE public.candidatos
 ADD COLUMN IF NOT EXISTS decisao_selecao text NOT NULL DEFAULT 'em_analise';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.candidatos'::regclass AND conname='candidatos_decisao_selecao_check') THEN
  ALTER TABLE public.candidatos ADD CONSTRAINT candidatos_decisao_selecao_check
  CHECK (decisao_selecao IN ('em_analise','aprovado','reprovado'));
 END IF;
END $$;
UPDATE public.candidatos SET decisao_selecao=status
 WHERE status IN ('aprovado','reprovado') AND decisao_selecao='em_analise';
COMMIT;
