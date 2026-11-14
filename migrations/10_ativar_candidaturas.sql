-- ÚLTIMO PASSO: código publicado, variáveis salvas, redeploy pronto,
-- agendamento 09 instalado e endpoint testado com o segredo.
DO $$ BEGIN
 IF (SELECT count(*) FROM public.empresas)<>1 THEN
  RAISE EXCEPTION 'Há mais de uma empresa ou nenhuma. Configure explicitamente a empresa antes de ativar.';
 END IF;
 INSERT INTO public.config_candidaturas(empresa_id,ativa)
 SELECT id,true FROM public.empresas
 ON CONFLICT(empresa_id) DO UPDATE SET ativa=true;
END $$;
SELECT empresa_id,ativa FROM public.config_candidaturas;
