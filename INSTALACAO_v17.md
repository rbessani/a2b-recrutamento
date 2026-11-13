# A2B v17 — áudio com IA e conferência do roteiro

Pacote de alterações sobre a v16 instalada. Não é o projeto inteiro. Preparado em 13/11/2026. Ainda não publicado neste trabalho. A régua de currículo continua na versão anterior; este pacote acrescenta exclusivamente a avaliação assistida do áudio.

## O que muda

No card Áudio aparece **Analisar áudio com IA**. A prévia mostra cada pedido explícito da instrução histórica e o resultado: Atendido, Parcial, Não atendido ou Não verificável. Também apresenta os dez critérios já existentes, opções sugeridas e justificativas. O recrutador pode ajustar as opções antes de confirmar. É obrigatório marcar que ouviu o áudio e revisou o roteiro.

O cumprimento do roteiro conserva peso de 5%. Não existe reprovação automática, teto oculto ou alteração dos demais pesos. A nota geral continua 40% comportamental, 30% currículo e 30% áudio.

A geração da prévia não altera nota nem ranking. A confirmação altera apenas o score do áudio, atualiza o total com os demais scores persistidos e acrescenta observações. Análises aplicadas não são acrescentadas novamente.

## 1. Primeiro banco — somente migração 05

Preserve os backups já feitos. Se houver novas inscrições desde aquela cópia, faça uma nova cópia antes de atualizar.

Abra `migrations/05_analise_audio_ia.sql` no Bloco de Notas. Copie tudo para uma nova consulta no SQL Editor do projeto Nexa e execute. Não executar novamente 01/02/03/04. Esta migração não altera candidatos, arquivos ou notas já existentes; cria tabela privada e duas funções para o novo fluxo.

Conferência de permissões (duas linhas true / false / false):

```sql
select p.proname as funcao,
 has_function_privilege('service_role', p.oid, 'execute') as service_role,
 has_function_privilege('anon', p.oid, 'execute') as anon,
 has_function_privilege('authenticated', p.oid, 'execute') as authenticated
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
 and p.proname in ('bsn_iniciar_analise_audio','bsn_confirmar_analise_audio');
```

Se falhar, não prossiga ao código; envie somente o erro, nunca chaves.

## 2. Arquivos no GitHub

Na raiz do repositório onde estão app, components, lib e package.json, use Add file → Upload files. Envie juntos **app, components, lib, migrations, tests, next.config.js, package.json e package-lock.json deste pacote**. Preserve os demais arquivos atuais. Não envie a pasta externa A2B_Recrutamento_v17_Audio_IA como um nível extra.

Arquivos exatos:

- app/page.jsx (substituir)
- app/api/candidatos/audio-ia/route.js (novo)
- app/api/candidatos/audio-ia/confirmar/route.js (novo)
- components/AvaliacaoAudioIA.jsx (novo)
- components/EntradaCandidatura.jsx (substituir; aviso inclui áudio)
- lib/audio-criterios.mjs (novo)
- lib/audio-ia.mjs (novo)
- lib/audio-converter.mjs (novo)
- migrations/05_analise_audio_ia.sql (novo)
- tests/audio-ia.mjs (novo)
- tests/audio-ia-routes.mjs (novo)
- tests/audio-ia-sql.mjs (novo)
- tests/audio-converter.mjs (novo)
- next.config.js (substituir; empacotamento do conversor)
- package.json (substituir; dependência e comandos de teste)
- package-lock.json (novo; dependências fixadas)

Não enviar node_modules, .next, .env, backups ou currículos reais. A nova dependência ffmpeg-static baixa seu binário durante npm install; o arquivo de configuração garante sua inclusão na função. O binário não deve ser arrastado manualmente ao GitHub. A instalação de dependências deve permitir scripts de instalação. Verifique Ready na Vercel; o build local confirmou o binário no trace da rota.

## 3. Vercel

Conservar todas as variáveis anteriores, incluindo OPENAI_API_KEY e configurações de currículo. Adicionar em Production:

| Nome | Valor |
|---|---|
| OPENAI_AUDIO_MODEL | gpt-audio-1.5 |
| OPENAI_AUDIO_ENABLED | true |

A chave já cadastrada é reutilizada; o projeto da API precisa ter acesso ao modelo e créditos. Não é necessário enviar a chave a ninguém. Faça Redeploy em Production após salvar as variáveis e aguarde Ready. Use o endereço principal a2b-recrutamento.vercel.app, pois login e origem são vinculados ao domínio previsto.

## 4. Teste acompanhado

Primeiro use inscrição fictícia com áudio compreensível e roteiro histórico salvo.

1. Ouça o arquivo e anote as notas atuais e uma observação curta.
2. Clique Analisar áudio com IA. Antes de confirmar, nada no ranking deve mudar.
3. Compare cada pedido com o roteiro mostrado em Instrução recebida nesta inscrição. A análise não usa o roteiro atual de outra vaga.
4. Teste um áudio que realmente realize a tarefa e outro que apenas leia a instrução ou omita um pedido. Confira a diferença na prévia. Não trate o parecer como verdade sem ouvir.
5. Ajuste uma opção; a nota é recalculada com os pesos existentes e o aceite de revisão é desmarcado.
6. Complete manualmente qualquer opção não verificável. Marque a revisão e confirme.
7. Confira nota do áudio e total, preservação do currículo, comportamento e texto anterior. Atualize a página e confira persistência.
8. Reabra a mesma análise: não deve gerar chamada paga nova ou duplicar observações. A prévia aplicada mostra as opções finais confirmadas.
9. Teste rascunho não salvo, erro de API, ausência de áudio e áudio antigo sem roteiro histórico: não deve haver alteração de nota.
10. Se o texto combinado ultrapassar 3.000 caracteres, a operação é bloqueada sem perder o texto. Os detalhes completos também ficam em analises_audio. Não apague anotações importantes para caber; esse limite pode demandar evolução futura de interface.

## Regras e limites técnicos

- Áudio é baixado do Storage privado pelo servidor, até 4.000.000 bytes. Nenhuma URL assinada é enviada à OpenAI.
- FFmpeg converte localmente para WAV mono 16 kHz, mantendo a velocidade e a duração. Original permanece intacto. São aceitos os formatos do fluxo atual; testes reais de conversão cobriram WAV, MP3, M4A, OGG, OPUS, WebM e AAC. Arquivos inválidos ou maiores que dez minutos pedem avaliação manual, sem corte silencioso.
- Conversão usa arquivo temporário aleatório, timeout de 12 s, sem shell, sem protocolos de rede e somente demuxers de áudio/containers permitidos. Temporários são removidos em finally. Binário deve estar disponível na hospedagem.
- OpenAI Chat Completions com entrada input_audio WAV e saída somente texto, store:false, timeout de 45 s e resposta JSON validada localmente. Modelo sem Structured Outputs: não enviamos response_format json_schema. Resposta inválida/truncada/recusa não vira nota.
- A rota declara maxDuration=60; limite efetivo depende da hospedagem. Se conversão + chamada excederem o orçamento, use avaliação manual. Não há fila nem processamento em segundo plano.
- Roteiro vem de arquivos_candidatos.roteiro_audio. Ausência bloqueia a IA; não se inventa roteiro antigo usando o cadastro atual. Hash inclui arquivo, versão, vaga, roteiro, modelo e versão do prompt.
- Referências a dados sensíveis/família não são pontuadas; sotaque, timbre, sexo, origem, saúde e personalidade não são critérios. Segurança, energia e naturalidade são restritas à apresentação observável. Não há detecção de mentira, emoção, doença ou uso de IA.
- A lista de pedidos e evidências é gerada pelo modelo e exige revisão. O sistema não verifica matematicamente a cobertura semântica do roteiro nem a veracidade dos trechos. Não é comprovação de competência nem decisão de contratação.
- Dez critérios e valores permitidos são conferidos no servidor; a nota total não é aceita do navegador. Critério sem opção é pendência, não zero automático. Opções revisadas ficam separadas da sugestão original no histórico.
- Tabela analises_audio: empresa/candidato/arquivo com FKs ON DELETE CASCADE, RLS sem políticas públicas, permissões somente service_role. Duas RPCs SECURITY INVOKER privadas. Índices novos são exclusivos da nova tabela; nenhum índice antigo é recriado.
- Cache por contexto, exclusão de geração concorrente por candidato, processamento abandonado expira após três minutos, limite distribuído de 30 novas tentativas de áudio por empresa/hora (inclui erros). Este limite é separado do currículo.
- Confirmação atômica e idempotente, lock compatível com observações e currículo, comparação do texto-base e arquivo ativo/contexto. Falha no log reverte toda gravação. Ainda existe a limitação anterior de concorrência nas rotas de avaliação manual; evitar edições simultâneas da mesma ficha.
- Retenção segue até 24 meses e exclusão quando solicitada, incluindo a nova tabela. Não há job de limpeza novo. O áudio completo é enviado ao provedor; store:false não promete retenção zero. Atualização do aviso não comprova ciência dos candidatos antigos.
- Os pesos e o prompt do currículo não foram recalibrados neste pacote.

## Validação feita

- npm test: 14 grupos passaram, incluindo rotas simuladas de áudio e de currículo.
- npm run test:sql:curriculo: 39 verificações anteriores passaram.
- npm run test:sql:audio: 24 verificações em PostgreSQL/PGlite isolado, incluindo RLS/permissões, cache, conflito do roteiro/arquivo/base, validação de critérios, cálculo, preservação do currículo/observações, confirmação idempotente, rollback, tamanho do texto e limite distribuído.
- node tests/audio-converter.mjs: sete formatos convertidos de fato com FFmpeg, entrada inválida, limite de tamanho e de duração.
- npm run build: passou com variáveis fictícias; trace inclui o binário FFmpeg.
- Sem chamada paga real à OpenAI, sem migração no Supabase real e sem publicação. Qualidade acústica e de cumprimento do roteiro precisam de teste acompanhado no ambiente configurado. Não houve rodada de interface em navegador nesta entrega.

## Desativar e reverter

OPENAI_AUDIO_ENABLED=false + redeploy suspende novas gerações; avaliação manual continua. A flag não revoga a confirmação de prévias já prontas. Restaurar os arquivos anteriores juntos reverte a interface; deixar a tabela privada não prejudica a v16. Reverter código não desfaz notas já confirmadas.

## Referências oficiais consultadas

- https://developers.openai.com/api/docs/guides/audio-chat-completions
- https://developers.openai.com/api/docs/models/gpt-audio-1.5
