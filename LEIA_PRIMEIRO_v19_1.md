# A2B v19.1 — prazo, análise automática e download corrigido
Preparado em 14/11/2026. Pacote incremental sobre v17/v18. Ainda não publicado nem ativado em produção.

## O que muda
- Novos cadastros, depois da ativação, recebem 24 horas para enviar áudio e currículo. Aviso antes do cadastro, prazo exato na pausa e no resumo, horário de Brasília.
- Sem os dois arquivos, a candidatura fica “Incompleta — prazo encerrado”. Não é excluída, nem recebe decisão de reprovação por IA. Continua visível ao recrutador, identificada como incompleta.
- Cadastros anteriores não recebem prazo; seus arquivos, notas e observações são preservados. Arquivos antigos não são analisados novamente em lote. Sua retomada anterior continua limitada pela sessão já existente.
- Cada novo arquivo confirmado de uma candidatura com essa política entra em uma fila persistente. A IA prepara a sugestão sem depender do navegador aberto. Uma tarefa por execução, agendada a cada minuto; com fila, aguarda sua vez. Não é instantâneo.
- Somente a confirmação do recrutador aplica a nota ao ranking. As justificativas continuam nas abas, separadas das suas observações. Inclui a estrutura v18 e a validação de áudio v17.2.
- Falha da IA não desfaz o envio. Falhas e interrupções não geram novas chamadas pagas automaticamente. Use o botão existente para consultar/tentar ou avaliar manualmente. Continuam valendo os limites das funções de análise existentes.
- Encerramento não depende do agendamento para bloquear envio: o banco confere o prazo no registro. O painel calcula o estado pelo prazo; o agendamento também registra o encerramento.
- Nome suspenso, painel lateral, barras comportamentais e cores não foram alterados.

## Instalação — uma etapa por vez
1. Faça nova cópia do banco e dos buckets antes de instalar: houve candidatos depois do backup antigo. Guarde também o código atual para rollback.
2. No Supabase SQL Editor, execute `migrations/08_candidatura_automatica.sql`. Não execute ainda 09 nem 10. A regra permanece desligada. Requer migrações 04/05/07 já instaladas; a 07 está incluída se ainda faltar. Se faltar, aplique 07 antes de 08.
3. No GitHub envie APENAS as pastas `app`, `components`, `lib`, `migrations`, `tests` e o arquivo `next.config.js`, preservando os caminhos da raiz do repositório. Não envie este guia, os assistentes nem qualquer arquivo preenchido com segredo. Não precisa alterar package.json ou instalar dependências novas; pressupõe ffmpeg-static da v17 instalado.
4. Com o deploy pronto, execute `CONFIGURAR_AUTOMACAO.bat` no Windows. Extraia o ZIP inteiro antes. Se o Windows bloquear o script, abra Propriedades do ZIP, marque Desbloquear e extraia novamente. Ele gera um segredo local, copia para a área de transferência e orienta as duas variáveis Production da Vercel. Nunca cole o segredo aqui no chat. O arquivo preenchido com segredo fica somente no seu computador e no SQL Editor; proteja-o como senha. Se precisar repetir, informe o mesmo segredo já configurado, para não interromper o agendamento.
5. Salve as variáveis e faça Redeploy na Vercel. Aguarde Ready. No Supabase execute `09_AGENDAMENTO_PREENCHIDO_NAO_PUBLICAR.sql`, criado pelo assistente. Esse passo habilita pg_cron/pg_net e usa o Vault já existente do Supabase para guardar o segredo. Se der erro de extensão/permissão, não prossiga para a ativação; envie somente a mensagem, sem o segredo. O modelo 09 sem preencher se recusa a agendar.
6. Volte ao assistente e pressione Enter. Ele testa o endpoint autenticado. Só depois de resposta correta execute `migrations/10_ativar_candidaturas.sql`. Ele exige que exista exatamente uma empresa, como no levantamento deste projeto; se houver mais, para sem ativar. O aplicativo usa NEXT_PUBLIC_EMPRESA_ID existente.
7. Reabra a página da vaga pelo domínio oficial e confira o aviso. A partir daqui entram as novas regras. Não é necessário modificar as chaves/modelos OpenAI existentes.

Variáveis novas (sem NEXT_PUBLIC):
- CANDIDATURA_WORKER_SECRET: segredo aleatório gerado pelo assistente, igual ao Vault.
- CANDIDATURA_AUTOMATICA_ENABLED: true.
Continuam necessárias OPENAI_API_KEY, OPENAI_AUDIO_ENABLED=true, OPENAI_CURRICULO_ENABLED=true, modelos, APP_ORIGIN e configurações atuais de sessão/Supabase.

## Teste real, depois de instalar
1. Confira um candidato antigo: nome, notas, arquivos e observações devem permanecer. Ele não deve ter prazo novo.
2. Crie candidatura de teste com seus próprios dados, e-mail novo e consentimento. Confira o aviso e o prazo de 24 horas. Conclua o questionário.
3. Pause e retome no mesmo navegador: o prazo não pode ser renovado e só etapas enviadas ficam recebidas.
4. Envie um áudio próprio válido e currículo de teste. O andamento deve confirmar os envios sem esperar a IA. Feche a página do candidato.
5. Aguarde alguns minutos, abra o painel administrativo, entre nas abas Áudio e Currículo. Se estiver na fila, use “Atualizar análise salva” ou reabra a ficha depois. Abrir a aba não solicita nova análise paga.
6. Confira a sugestão completa e que as notas anteriores não mudaram. Confirme manualmente; somente então a nota e o ranking mudam. Minhas observações deve permanecer intacta.
7. Para testar encerramento sem esperar 24 horas, use SOMENTE uma candidatura identificada como teste. Solicite uma SQL específica com seu ID; este pacote não encurta o prazo de candidatos reais. Candidatura completa deve permanecer válida após o prazo; incompleta deve bloquear envio e aparecer identificada no painel.

## Conferência SQL somente leitura
```sql
select empresa_id,ativa from public.config_candidaturas;
select tipo,status,count(*) from public.fila_analises group by tipo,status order by tipo,status;
select codigo,prazo_conclusao,encerrada_incompleta_em
from public.candidatos where prazo_conclusao is not null order by prazo_conclusao desc;
select jobname,schedule,active from cron.job where jobname='bsn-fila-candidaturas';
```
Cron ativo confirma o agendamento, não o sucesso das chamadas HTTP. Se a fila não andar, conferir no SQL Editor:
```sql
select status_code,timed_out,error_msg,created
from net._http_response order by created desc limit 10;
```
401 indica segredo diferente/faltando; 503 indica configuração ou falha do processamento. Não envie headers nem consultas ao Vault em capturas.

## Pausa / rollback
Para impedir novos prazos e novas entradas na fila:
```sql
update public.config_candidaturas set ativa=false;
```
Para parar o agendamento:
```sql
select cron.unschedule('bsn-fila-candidaturas');
```
Para suspender o worker, configure CANDIDATURA_AUTOMATICA_ENABLED=false e faça redeploy. Isso não apaga prazos já assumidos, arquivos nem análises; prazos de candidaturas novas já criadas continuam valendo. Não remover colunas/tabelas para desfazer deploy. Se precisar prorrogar ou reabrir uma candidatura, tratar explicitamente seu ID com o recrutador; não há portal de reabertura neste pacote.

## Validação e limites
Testes locais: suite existente (14 grupos), SQL v18 (22 verificações), SQL v19 (21), rotas das abas e worker com serviços simulados. Build Next.js passou, incluindo binário de conversão de áudio no worker. Nenhuma chamada OpenAI paga nem alteração em produção foi realizada. O assistente Windows foi revisado, mas não executado no Windows nesta sessão. A interface não foi validada em navegador nesta execução; é necessário o teste real acima no deploy. O agendamento e Vault dependem da instalação no seu projeto Supabase e das variáveis/deploy Vercel, não foram testados na sua conta.
A fila tem ON DELETE CASCADE para exclusão dos candidatos/arquivos e não define retenção permanente. A promessa de até 24 meses e exclusão a pedido continua; este pacote não cria o processo de limpeza periódica que ainda não existia. O job não apaga candidatos.
Referências oficiais usadas para o agendamento: https://supabase.com/docs/guides/cron e https://supabase.com/docs/guides/functions/schedule-functions .

## Correção de download já incluída
O botão Baixar usa uma rota autenticada que gera um link novo por clique e solicita o download com o nome original. Vale para áudio e currículo. Não precisa do ZIP de correção separado nem de editar uma linha manualmente: basta enviar a pasta app deste pacote completo, como descrito acima. Não converte o formato original do áudio. Teste Baixar no painel após o deploy, inclusive deixando a ficha aberta por mais de dez minutos. Abrir áudio e o player permanecem separados; a renovação do player não faz parte desta correção.
