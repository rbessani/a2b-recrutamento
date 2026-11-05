-- Executar uma vez após backup, antes de publicar o pacote de vagas.
-- Requer SQL 01 e 02 já aplicados. Não recalcula resultados históricos.
BEGIN;
ALTER TABLE public.vagas ADD COLUMN IF NOT EXISTS roteiro_audio text NOT NULL DEFAULT 'Olá, bom dia! Meu nome é [SEU NOME] da Bessani Soluções. Trabalhamos com gestão empresarial há mais de 30 anos. Você teria 3 minutinhos?';
ALTER TABLE public.vagas ADD COLUMN IF NOT EXISTS pesos_bloqueados boolean NOT NULL DEFAULT false;
ALTER TABLE public.candidatos ADD COLUMN IF NOT EXISTS roteiro_audio_inscricao text;
ALTER TABLE public.arquivos_candidatos ADD COLUMN IF NOT EXISTS roteiro_audio text;
UPDATE public.vagas v SET pesos_bloqueados=true WHERE EXISTS (SELECT 1 FROM public.candidatos c WHERE c.vaga_id=v.id);
-- Não modifica pesos já usados por vagas antigas; novas configurações pela API aceitam 1/2.
CREATE OR REPLACE FUNCTION public.bsn_proteger_pesos_vaga() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.pesos_bloqueados AND NOT NEW.pesos_bloqueados THEN
  RAISE EXCEPTION 'Os pesos desta vaga já estão bloqueados.' USING ERRCODE='23514';
 END IF;
 IF (OLD.pesos_bloqueados OR EXISTS(SELECT 1 FROM public.candidatos WHERE vaga_id=OLD.id))
 AND ROW(NEW.peso_perfil_a,NEW.peso_perfil_b,NEW.peso_perfil_c,NEW.peso_perfil_d) IS DISTINCT FROM ROW(OLD.peso_perfil_a,OLD.peso_perfil_b,OLD.peso_perfil_c,OLD.peso_perfil_d) THEN
  RAISE EXCEPTION 'Pesos bloqueados após a primeira inscrição. Duplique a vaga.' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bsn_proteger_pesos ON public.vagas;
CREATE TRIGGER trg_bsn_proteger_pesos BEFORE UPDATE ON public.vagas FOR EACH ROW EXECUTE FUNCTION public.bsn_proteger_pesos_vaga();
CREATE OR REPLACE FUNCTION public.bsn_inscricao_vaga() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE oportunidade public.vagas%ROWTYPE;
BEGIN
 SELECT * INTO oportunidade FROM public.vagas WHERE id=NEW.vaga_id FOR UPDATE;
 IF NOT FOUND OR oportunidade.empresa_id IS DISTINCT FROM NEW.empresa_id OR oportunidade.status <> 'ativa' THEN
  RAISE EXCEPTION 'Vaga indisponível.' USING ERRCODE='23514';
 END IF;
 NEW.roteiro_audio_inscricao := oportunidade.roteiro_audio;
 UPDATE public.vagas SET pesos_bloqueados=true WHERE id=NEW.vaga_id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bsn_inscricao_vaga ON public.candidatos;
CREATE TRIGGER trg_bsn_inscricao_vaga BEFORE INSERT ON public.candidatos FOR EACH ROW EXECUTE FUNCTION public.bsn_inscricao_vaga();
-- Guardar contexto em novas substituições de áudio; preenchimento pela API é conferido no banco.
CREATE OR REPLACE FUNCTION public.bsn_contexto_audio() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.tipo='audio' THEN
  SELECT c.roteiro_audio_inscricao INTO NEW.roteiro_audio FROM public.candidatos c WHERE c.id=NEW.candidato_id AND c.empresa_id=NEW.empresa_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bsn_contexto_audio ON public.arquivos_candidatos;
CREATE TRIGGER trg_bsn_contexto_audio BEFORE INSERT ON public.arquivos_candidatos FOR EACH ROW EXECUTE FUNCTION public.bsn_contexto_audio();
-- Legado não possui snapshot: não inventar instrução histórica. A API usa texto padrão conhecido
-- para inscrição antiga sem snapshot; novos cadastros recebem snapshot pela trigger acima.
CREATE OR REPLACE VIEW public.vw_ranking AS
SELECT c.id,c.empresa_id,c.vaga_id,c.codigo,c.nome,c.email,c.telefone,c.whatsapp,c.cidade,c.estado,c.status,
 rc.perfil_dominante,
 COALESCE(rc.score_comportamental,0::numeric) AS score_comportamental,
 COALESCE(ai.score_curriculo,0::numeric) AS score_curriculo,
 COALESCE(ai.score_audio,0::numeric) AS score_audio,
 round(COALESCE(rc.score_comportamental,0::numeric)*0.4+COALESCE(ai.score_curriculo,0::numeric)*0.3+COALESCE(ai.score_audio,0::numeric)*0.3) AS score_final,
 row_number() OVER (PARTITION BY c.empresa_id,c.vaga_id ORDER BY (COALESCE(rc.score_comportamental,0::numeric)*0.4+COALESCE(ai.score_curriculo,0::numeric)*0.3+COALESCE(ai.score_audio,0::numeric)*0.3) DESC,c.created_at ASC,c.id ASC) AS posicao_ranking,
 rc.questionario_id
FROM public.candidatos c
LEFT JOIN LATERAL (SELECT r.* FROM public.resultado_comportamental r WHERE r.candidato_id=c.id AND r.empresa_id=c.empresa_id ORDER BY r.updated_at DESC,r.created_at DESC,r.id ASC LIMIT 1) rc ON true
LEFT JOIN LATERAL (SELECT a.* FROM public.avaliacoes_ia a WHERE a.candidato_id=c.id AND a.empresa_id=c.empresa_id AND a.vaga_id=c.vaga_id AND a.ativo=true ORDER BY a.updated_at DESC,a.id ASC LIMIT 1) ai ON true;
REVOKE ALL ON public.vw_ranking FROM anon,authenticated,PUBLIC;
GRANT SELECT ON public.vw_ranking TO service_role;
REVOKE ALL ON FUNCTION public.bsn_proteger_pesos_vaga() FROM anon,authenticated,PUBLIC;
REVOKE ALL ON FUNCTION public.bsn_inscricao_vaga() FROM anon,authenticated,PUBLIC;
REVOKE ALL ON FUNCTION public.bsn_contexto_audio() FROM anon,authenticated,PUBLIC;
GRANT EXECUTE ON FUNCTION public.bsn_proteger_pesos_vaga() TO service_role;
GRANT EXECUTE ON FUNCTION public.bsn_inscricao_vaga() TO service_role;
GRANT EXECUTE ON FUNCTION public.bsn_contexto_audio() TO service_role;
COMMIT;
