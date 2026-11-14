BEGIN;
-- Nenhum cadastro antigo recebe prazo; nenhum arquivo antigo entra na fila.
CREATE TABLE IF NOT EXISTS public.config_candidaturas (
 empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
 ativa boolean NOT NULL DEFAULT false
);
ALTER TABLE public.config_candidaturas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.config_candidaturas FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.config_candidaturas TO service_role;
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS prazo_conclusao timestamptz;
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS encerrada_incompleta_em timestamptz;
CREATE INDEX IF NOT EXISTS idx_candidatura_prazo ON public.candidatos(prazo_conclusao) WHERE prazo_conclusao IS NOT NULL AND encerrada_incompleta_em IS NULL;
CREATE TABLE IF NOT EXISTS public.fila_analises (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
 candidato_id uuid NOT NULL REFERENCES public.candidatos(id) ON DELETE CASCADE,
 arquivo_id uuid NOT NULL UNIQUE REFERENCES public.arquivos_candidatos(id) ON DELETE CASCADE,
 tipo text NOT NULL CHECK(tipo IN ('audio','curriculo')),
 status text NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','processando','concluida','erro')),
 created_at timestamptz NOT NULL DEFAULT now(),iniciada_em timestamptz,finalizada_em timestamptz,
 analise_id uuid,mensagem text
);
CREATE INDEX IF NOT EXISTS idx_fila_analises_pendente ON public.fila_analises(empresa_id,created_at) WHERE status='pendente';
ALTER TABLE public.fila_analises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fila_analises FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.fila_analises TO service_role;
CREATE OR REPLACE FUNCTION public.bsn_prazo_novo_cadastro() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 -- Sempre calculado pelo banco, nunca aceito do cliente.
 NEW.prazo_conclusao:=NULL;NEW.encerrada_incompleta_em:=NULL;
 IF EXISTS(SELECT 1 FROM config_candidaturas WHERE empresa_id=NEW.empresa_id AND ativa) THEN
  NEW.prazo_conclusao:=clock_timestamp()+interval '24 hours';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bsn_prazo_novo_cadastro ON public.candidatos;
CREATE TRIGGER bsn_prazo_novo_cadastro BEFORE INSERT ON public.candidatos FOR EACH ROW EXECUTE FUNCTION public.bsn_prazo_novo_cadastro();
CREATE OR REPLACE FUNCTION public.bsn_validar_prazo_arquivo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c record;
BEGIN
 SELECT empresa_id,prazo_conclusao,encerrada_incompleta_em INTO c FROM candidatos WHERE id=NEW.candidato_id FOR UPDATE;
 IF c.empresa_id IS DISTINCT FROM NEW.empresa_id THEN RAISE EXCEPTION 'Empresa inválida' USING ERRCODE='23514'; END IF;
 IF c.prazo_conclusao IS NOT NULL AND (clock_timestamp()>=c.prazo_conclusao OR c.encerrada_incompleta_em IS NOT NULL) THEN
  RAISE EXCEPTION 'Prazo encerrado' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bsn_validar_prazo_arquivo ON public.arquivos_candidatos;
CREATE TRIGGER bsn_validar_prazo_arquivo BEFORE INSERT ON public.arquivos_candidatos FOR EACH ROW EXECUTE FUNCTION public.bsn_validar_prazo_arquivo();
CREATE OR REPLACE FUNCTION public.bsn_enfileirar_arquivo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.ativo AND NEW.tipo IN ('audio','curriculo') AND EXISTS(
 SELECT 1 FROM candidatos c JOIN config_candidaturas p USING(empresa_id)
 WHERE c.id=NEW.candidato_id AND c.empresa_id=NEW.empresa_id AND c.prazo_conclusao IS NOT NULL AND p.ativa) THEN
 INSERT INTO fila_analises(empresa_id,candidato_id,arquivo_id,tipo) VALUES(NEW.empresa_id,NEW.candidato_id,NEW.id,NEW.tipo) ON CONFLICT(arquivo_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bsn_enfileirar_arquivo ON public.arquivos_candidatos;
CREATE TRIGGER bsn_enfileirar_arquivo AFTER INSERT ON public.arquivos_candidatos FOR EACH ROW EXECUTE FUNCTION public.bsn_enfileirar_arquivo();
CREATE OR REPLACE FUNCTION public.bsn_encerrar_incompletas(p_empresa uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c record;n integer:=0;
BEGIN
 -- Mesmo lock usado pelo envio: um arquivo confirmado não é ignorado pelo encerramento.
 FOR c IN SELECT id FROM candidatos WHERE empresa_id=p_empresa AND prazo_conclusao<=clock_timestamp() AND encerrada_incompleta_em IS NULL FOR UPDATE SKIP LOCKED LOOP
 IF NOT EXISTS(SELECT 1 FROM arquivos_candidatos WHERE candidato_id=c.id AND empresa_id=p_empresa AND ativo AND tipo='audio')
 OR NOT EXISTS(SELECT 1 FROM arquivos_candidatos WHERE candidato_id=c.id AND empresa_id=p_empresa AND ativo AND tipo='curriculo') THEN
 UPDATE candidatos SET encerrada_incompleta_em=clock_timestamp() WHERE id=c.id;
 n:=n+1;
 END IF;
 END LOOP;
 RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.bsn_reservar_analise(p_empresa uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tarefa fila_analises%ROWTYPE;
BEGIN
 -- Nunca repetir automaticamente uma chamada de resultado incerto: botão manual disponível.
 UPDATE fila_analises SET status='erro',finalizada_em=clock_timestamp(),mensagem='Processamento interrompido. Confira a análise salva ou use a análise manual.'
 WHERE empresa_id=p_empresa AND status='processando' AND iniciada_em<clock_timestamp()-interval '5 minutes';
 IF NOT EXISTS(SELECT 1 FROM config_candidaturas WHERE empresa_id=p_empresa AND ativa) THEN RETURN NULL;END IF;
 SELECT * INTO tarefa FROM fila_analises WHERE empresa_id=p_empresa AND status='pendente' ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL;END IF;
 UPDATE fila_analises SET status='processando',iniciada_em=clock_timestamp() WHERE id=tarefa.id;
 RETURN to_jsonb(tarefa);
END $$;
REVOKE ALL ON FUNCTION public.bsn_prazo_novo_cadastro(),public.bsn_validar_prazo_arquivo(),public.bsn_enfileirar_arquivo(),public.bsn_encerrar_incompletas(uuid),public.bsn_reservar_analise(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bsn_encerrar_incompletas(uuid),public.bsn_reservar_analise(uuid) TO service_role;
COMMIT;
