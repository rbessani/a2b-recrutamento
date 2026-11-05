# Sistema de vagas — implementação preparada em 05/11/2026

**Ainda não publicado nem executado no seu Supabase.** Este pacote parte da versão de segurança já implantada e validada pelo usuário. A instalação desta etapa usa **somente a nova migração 03**. Não reaplicar SQL 01 ou SQL 02.

## O que está pronto

- Aba **Vagas**: criar, editar, pausar/abrir/encerrar e duplicar.
- Cada vaga tem título, descrição, instrução do áudio e pesos dos quatro perfis.
- Pesos: **Normal (1)** ou **Maior influência (2)**.
- Bloqueio dos pesos após a primeira inscrição, tanto na API quanto por trigger PostgreSQL. O bloqueio permanece mesmo se todas as inscrições forem excluídas. Vagas antigas com candidatos já são bloqueadas pela migração.
- Duplicar cria uma vaga pausada, sem candidatos e com novos pesos editáveis. Notas e candidaturas não são copiadas.
- Botão **Copiar link**, no formato `https://a2b-recrutamento.vercel.app/?vaga=UUID`.
- Seleção de vaga no painel filtra indicadores, candidatos e ranking.
- Referência no ranking: **Comportamental 40% · Currículo 30% · Áudio 30%** e aviso sobre zero para itens não enviados. Lista os perfis de peso 2 da vaga selecionada.
- Candidatura mostra o título da vaga; a instrução na etapa de áudio vem dessa vaga.
- Inscrição grava a instrução recebida. Editar o texto depois afeta somente inscrições futuras. Cada novo arquivo de áudio guarda a instrução da sua inscrição, conferida no banco.
- No bloco do áudio do painel, **Instrução recebida nesta inscrição** permite consultar o texto de novos envios que tenham snapshot.
- Link inválido ou vaga pausada/encerrada impede novas inscrições. Não encaminha automaticamente para outra vaga.
- O link sem `?vaga` continua abrindo a vaga padrão da variável `NEXT_PUBLIC_VAGA_ID`.
- Ajuste necessário no ranking: uma avaliação ativa e um resultado comportamental mais recente por candidato, sem multiplicar linhas. Desempate de nota por data de cadastro e ID. Não regrava nem recalcula os resultados comportamentais históricos.

## O que permanece

Sem setores, sem etapas opcionais, sem mudança de ordem e sem versionamento/recálculo histórico. Mantém dados/privacidade, as três avaliações, 25 perguntas, critérios de áudio atuais, nota final fixa 40/30/30 e zero para item não enviado. O empate na confirmação do candidato continua adiado. Sessões, origem, arquivos privados e URLs assinadas são preservados.

Não há pesos automáticos “por profissão”. O gestor escolhe os perfis valorizados. O resultado comportamental é apoio à seleção, não comprovação de competência.

**Atenção à interpretação:** se os quatro pesos forem iguais, a fórmula atual dá nota comportamental 100 para um questionário completo. A tela avisa isso. Para diferenciar compatibilidade, escolher pesos diferentes. Não alteramos a fórmula aprovada.

## Como instalar, em etapas

### 1. Guardar a versão atual

No GitHub, Code → Download ZIP. Mantenha essa cópia. Providencie também o backup de banco disponível no seu ambiente. Se houver alterações de código depois da implantação de segurança que não foram feitas nesta conversa, comparar antes de enviar este pacote completo.

### 2. Executar somente o SQL 03

No ZIP, abra `migrations/03_vagas.sql` com Bloco de Notas, copie tudo e execute no Supabase → SQL Editor → New query → Run. O resultado esperado é **Success. No rows returned**. Se houver erro, não continue: envie somente a mensagem, sem credenciais.

O script tem transação e cria colunas/triggers e substitui a view mantendo os campos anteriores e acrescentando questionario_id. Não apaga candidatos, arquivos ou vagas e não altera a situação da vaga atual. Ele bloqueia os pesos das vagas com inscrições existentes. A view passa a desconsiderar avaliações inativas, portanto se havia duplicações históricas a posição pode mudar por corrigir esse erro; não é recálculo das notas salvas.

### 2.1. Conferir as permissões das funções

O SQL 03 atualizado concede explicitamente EXECUTE das três funções somente a service_role, mantendo a revogação de anon/authenticated/PUBLIC. Depois de executar o arquivo, faça esta consulta somente de leitura:

```sql
SELECT p.proname,
       has_function_privilege('service_role', p.oid, 'execute') AS service_role_pode_executar
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('bsn_proteger_pesos_vaga', 'bsn_inscricao_vaga', 'bsn_contexto_audio')
ORDER BY p.proname;
```

O resultado esperado é três linhas com true. Se o SQL anterior já foi executado, não precisa reaplicar toda a migração para acrescentar essas permissões; execute apenas:

```sql
BEGIN;
GRANT EXECUTE ON FUNCTION public.bsn_proteger_pesos_vaga() TO service_role;
GRANT EXECUTE ON FUNCTION public.bsn_inscricao_vaga() TO service_role;
GRANT EXECUTE ON FUNCTION public.bsn_contexto_audio() TO service_role;
COMMIT;
```

Em seguida repita a consulta de conferência. Se faltar uma função ou houver erro, informar a mensagem e conferir a migração antes do deploy.

A revisão inicial sugeriu que a ausência de EXECUTE interromperia automaticamente os gatilhos existentes. Essa interrupção **não foi reproduzida**: no PostgreSQL embarcado, após SET ROLE service_role (não superusuário, com BYPASSRLS e permissões de tabela que simulam as APIs), inscrição e áudio funcionaram também em experimento isolado com EXECUTE revogado. Isso distingue o privilégio de criação/chamada direta da execução de gatilhos já criados. A documentação PostgreSQL exige EXECUTE na criação do trigger: https://www.postgresql.org/docs/current/sql-createtrigger.html. Não inferir desse experimento o estado do Supabase de produção. As concessões explícitas foram mantidas e validadas, sem relaxar acesso público.

### 3. Enviar o código

As variáveis atuais continuam. Não precisa gerar outro SESSION_SECRET nem mudar a senha ou APP_ORIGIN.

Na raiz do GitHub (onde aparece package.json), use Add file → Upload files e envie **o conteúdo extraído**, mantendo os caminhos. Inclua **components**, que é uma pasta nova, além de app, lib, tests e migrations. Envie também package.json, jsconfig.json e next.config.js na raiz. Não envie a pasta externa envolvendo tudo.

Este ZIP é o projeto completo preparado; não contém node_modules, .next, segredos ou `.env`. As cópias antigas da página no GitHub não são removidas automaticamente por upload. Não editar cópias old/final/rework; a página ativa é app/page.jsx.

### 4. Aguardar Ready

Aguarde o deploy mais recente da Vercel ficar Ready. Se falhar, envie o erro; não reabra permissões do banco.

### 5. Testar a vaga atual

- Abrir o endereço sem parâmetros e conferir o título da vaga atual.
- Entrar no admin com a senha já configurada.
- Na aba Vagas, conferir a vaga atual com pesos bloqueados.
- No ranking, conferir composição 40/30/30 e perfis de maior influência.
- Abrir áudio/currículo de candidato antigo para confirmar compatibilidade.

### 6. Criar outra vaga de teste

- Clicar Nova vaga, definir título, descrição e instrução do áudio.
- Escolher os pesos e deixar a vaga pausada para revisar; salvar.
- Abrir Editar, mudar para Aberta e salvar.
- Clicar Copiar link e abrir em janela anônima.
- Fazer uma inscrição fictícia com 25 respostas e arquivos de teste.
- Conferir que aparece somente na vaga correta e que o roteiro do áudio corresponde.
- Voltar ao cadastro: pesos agora devem estar bloqueados.
- Editar o texto do áudio e conferir que a inscrição já iniciada mantém a instrução antiga; uma inscrição nova recebe a nova.
- Duplicar a vaga e conferir que a cópia começa pausada, sem candidatos e com pesos liberados.
- Pausar a cópia e abrir seu link: deve avisar indisponível. O link da vaga atual continua funcionando.

Não testar exclusão em candidatos reais. A fase de testes de produção desta etapa ainda precisa ser feita pelo usuário.

## Principais arquivos e responsabilidades

| Caminho | Mudança |
|---|---|
| `components/GestaoVagas.jsx` | Interface de gestão e cópia de links |
| `lib/vagas.mjs` | Validação e texto padrão de compatibilidade |
| `app/api/vagas/route.js` | Listagem/admin e criação/duplicação |
| `app/api/vagas/[id]/route.js` | Edição/admin com bloqueio de pesos |
| `app/api/vagas/publica/route.js` | Consulta pública limitada a uma vaga ativa da empresa |
| `app/api/candidatos/route.js` | Cadastro em vaga dinâmica e leitura isolada do ranking |
| `app/api/comportamental/route.js` | Mantém cálculo pela vaga e valida pesos positivos |
| `app/page.jsx` | Seleção de vaga, referência de notas, título e áudio dinâmicos |
| `migrations/03_vagas.sql` | Campos, bloqueio, snapshot e view sem multiplicação |
| `tests/vagas.mjs` | Domínio e APIs com mocks |
| `tests/sql-vagas.mjs` | Migração e invariantes em PostgreSQL embarcado isolado |

## Banco acrescentado

- vagas.roteiro_audio: text NOT NULL, padrão igual ao roteiro comercial anterior.
- vagas.pesos_bloqueados: boolean NOT NULL DEFAULT false; migrado para true nas vagas com candidatos.
- candidatos.roteiro_audio_inscricao: text nullable, preenchido no INSERT pela trigger.
- arquivos_candidatos.roteiro_audio: text nullable, preenchido para novos áudios a partir da inscrição.
- vw_ranking.questionario_id: UUID do resultado selecionado, acrescentado ao fim da view; mantém os campos anteriores.

Três triggers novas: `trg_bsn_proteger_pesos`, `trg_bsn_inscricao_vaga`, `trg_bsn_contexto_audio`. A primeira impede mudar pesos bloqueados ou desfazer bloqueio; a segunda valida empresa/status, trava a linha da vaga e marca bloqueio na inscrição; a terceira guarda contexto do áudio. Não há endpoint para excluir vaga ou transferir candidatura de vaga.

Para inscrições/arquivos anteriores à migração não existe snapshot; o sistema não preenche retroativamente uma instrução como se fosse prova histórica. Novas inscrições recebem a cópia no banco. Não é um sistema de versionamento, nem muda o áudio já enviado.

A view seleciona o resultado comportamental mais recente (updated_at, created_at, ID) e uma avaliação ativa da mesma empresa/vaga. A API usa o questionario_id escolhido pela view para buscar a mesma contagem. As novas vagas continuam usando as 25 perguntas fixas e o QUESTIONARIO_ID global, sem editor de questionários.

## Validação executada

- **Build Next.js de produção:** aprovado localmente com a versão de dependências da linha de base, variáveis fictícias e sem chamar produção.
- **33 verificações de sessão/segurança** + **8 cenários comportamentais** + **26 verificações de vagas/APIs:** aprovados (`npm test`). As APIs usam mocks nessa suíte.
- **35 verificações de banco:** migração executada em PostgreSQL embarcado (PGlite) com schema mínimo isolado. Cobriu bloqueio legado, primeira inscrição, tentativa de desbloquear, exclusão sem liberar pesos, instrução preservada no arquivo, empresa errada, vaga encerrada, view com versões históricas, grants da view e reexecução técnica da migração. Não simulou concorrência entre conexões reais nem todas as extensões do Supabase.
- **8 verificações de interação React em jsdom:** título, login simulado, composição no ranking, troca da vaga, pesos bloqueados, cadastro enviando o ID correto, 25 respostas levando ao roteiro preservado, link inválido sem iniciar candidatura. Rede simulada, sem acesso à produção.
- **Revisão visual em navegador real:** pendente. Chromium automatizado não iniciou devido a restrições do ambiente. Teste em celular/computador após deploy.

Para o teste SQL separado é necessário instalar `@electric-sql/pglite` em um ambiente de teste e executar `node tests/sql-vagas.mjs`. Ele usa banco em memória; não pede URL nem chave do Supabase. Não foi incluído como dependência de produção. O teste de DOM foi executado em ambiente auxiliar; não faz parte de npm test.

## Limitações preservadas

- Limites/formats de upload e substituição de arquivo ainda têm os problemas documentados anteriormente.
- Gravações de nota/log e resultado/status/log não são uma única transação.
- Não há retomada da candidatura por e-mail nem revogação central de sessão.
- Admin continua compartilhado. A consulta pública de uma vaga não exige login, mas expõe somente conteúdo da vaga, nunca lista candidatos.
- O bloqueio de concorrência está implementado com trava de linha/trigger; cenários de carga em Supabase real ainda precisam ser observados.
- Listagens continuam sujeitas aos limites de resposta do Supabase; paginação é melhoria futura.
- Não mudamos as dependências de produção nesta etapa. Next 14.2.0 é herdado e apresentou aviso de vulnerabilidade na instalação de teste; avaliar atualização para versão corrigida em trabalho próprio antes de ampliar uso. Build aprovado não significa ausência de vulnerabilidades.
- O nome da vaga pode se repetir: o vínculo e o filtro usam UUID, não descrição. Ao mudar o título, a URL e as inscrições continuam vinculadas.
- Sem parâmetro `vaga`, o sistema mantém a vaga padrão atual. Se ela estiver fechada, mostra indisponível; Área Admin continua acessível.
- Pausar/encerrar impede novas inscrições; quem já tem inscrição válida pode concluir etapas. Não suspende automaticamente inscrições existentes.

## Recuperação

A migração é aditiva para o código anterior e preserva a view com os campos antigos. Se o código novo falhar, recuperar o deploy anterior de segurança é preferível a reabrir o banco. Não voltar ao código anterior à segurança e não executar scripts de grants amplos. Guardar a nova migração e comparar erros específicos antes de qualquer reversão de banco.


## Revisão de permissões — antes da implantação

Alterados somente `migrations/03_vagas.sql`, `tests/sql-vagas.mjs` e este guia. Incluídos GRANT EXECUTE explícitos e testes reais de papel não superusuário. As 35 verificações SQL e as 67 verificações de código passaram após a alteração. O pacote não foi publicado; nada foi executado no Supabase. O teste de permissão usa schema mínimo isolado e não substitui a consulta pós-migração acima. As concessões amplas usadas para montar o banco de teste não são migração de produção.
