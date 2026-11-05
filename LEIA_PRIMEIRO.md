# Atualização de segurança e organização — Bessani

Estado: arquivos preparados e verificados localmente em 04/11/2026; **não publicados**. Nenhum comando foi executado no Supabase ou na Vercel. Base: ZIP de commit f4380d900d04e19a71f021b8b4e97b6b677038c3 fornecido pelo usuário. Se houve mudanças depois desse ZIP, comparar antes de substituir arquivos.

## O que foi implementado

- Login real pela API; retirada da senha fixa/preenchida no frontend.
- Cookie administrativo HttpOnly, SameSite Strict, Secure em produção; sessão assinada HMAC com prazo de 8 horas, vinculada à empresa configurada.
- Logout que apaga o cookie administrativo.
- Sessão individual de inscrição por candidato, prazo de 24 horas; ID informado na requisição deve corresponder ao cookie assinado. Sessões de diferentes inscrições usam cookies distintos.
- Checagem da origem dos POSTs e verificação de vínculo do candidato com a empresa.
- Exigência de sessão administrativa para listar candidatos, avaliar, excluir e mudar decisão.
- Cliente Supabase administrativo marcado como exclusivo do servidor.
- URLs temporárias de arquivos, válidas por 10 minutos; botão Atualizar renova os links.
- SQL para restringir grants, habilitar RLS nas tabelas documentadas e tornar os dois buckets privados.
- Decisão de seleção separada do status de andamento: Em análise, Aprovado ou Reprovado. Não muda notas/posição.
- Observação de avaliação no card; salva ao avaliar currículo ou áudio. Checklist de áudio e notas são registrados com responsável `admin` e data do servidor em JSON e logs.
- Validação do checklist e da faixa 0–100 no servidor; preservação da nota de áudio ao salvar currículo.
- Questionário exige 25 respostas válidas; erros de persistência são verificados e a tela não avança silenciosamente.

Mantidos: 25 perguntas, perfis pela contagem original e empates, data em Brasília, organização dos blocos, exclusão com confirmação, pesos fixos 40%/30%/30%, zero para componentes não enviados. Não houve exclusão de candidato em testes.

## Ordem de implantação

### 1. Preparar

Faça backup do repositório e do banco pelos recursos disponíveis no seu projeto. Guarde o código anterior para recuperação. Faça a alteração num horário sem candidaturas em andamento: inscrições antigas abertas no navegador não possuem o novo cookie e precisarão de acompanhamento; esta versão não implementa recuperação por e-mail.

Este ZIP contém o projeto completo e limpo, sem cópias históricas da página. Não contém `.env`, credenciais reais, dados pessoais nem `node_modules`.

### 2. Executar SQL 01 no Supabase

Abra `migrations/01_decisao_selecao.sql`, copie o conteúdo e execute no SQL Editor. Ele cria o campo da decisão sem modificar as notas. Decisões antigas registradas como status aprovado/reprovado são copiadas inicialmente; as demais ficam Em análise. O status antigo é preservado.

Execute este arquivo só uma vez durante a implantação; reexecutá-lo pode copiar novamente uma decisão antiga para alguém que voltou a Em análise. Se a coluna já existir com definição diferente, o script não corrige automaticamente essa diferença.

### 3. Configurar variáveis na Vercel

Mantenha as variáveis existentes, principalmente a chave administrativa Supabase exclusiva do servidor e os IDs da empresa/vaga/questionário. Acrescente:

| Variável | O que informar |
|---|---|
| `SESSION_SECRET` | Segredo aleatório com pelo menos 32 caracteres; use 32 bytes aleatórios ou mais |
| `APP_ORIGIN` | Origem HTTPS exata do recrutamento, por exemplo `https://seu-recrutamento.vercel.app`, sem caminho |
| `ADMIN_PASSWORD` | Nova senha forte com pelo menos 16 caracteres, distinta da senha antiga presente no código histórico |

Não envie os valores dessas variáveis ao chat. Não use prefixo `NEXT_PUBLIC_` nos segredos. Para gerar SESSION_SECRET localmente com Node, pode usar `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` no seu próprio terminal e copiar diretamente para a configuração protegida da Vercel.

O login continua sendo `admin`; agora a senha válida é ADMIN_PASSWORD. APP_ORIGIN deve ser o endereço usado no navegador; previews com outra origem precisam de configuração própria. A candidatura deve abrir diretamente no domínio do recrutamento; cookies Strict podem não funcionar em iframe de outro domínio. Não afrouxar a política de cookie sem avaliar esse cenário.

### 4. Publicar os arquivos

Copie as pastas `app/`, `lib/`, `tests/`, os arquivos de configuração e `package.json` para os mesmos caminhos no GitHub. Inclua as novas pastas de rotas e os arquivos `.mjs`. A Vercel precisa instalar a nova dependência `server-only`. Não basta substituir somente `page.jsx`.

Arquivos novos essenciais:

- `lib/session.mjs`
- `lib/security.js`
- `app/api/admin/logout/route.js`
- `app/api/candidatos/decisao/route.js`

Arquivos alterados: `app/page.jsx`, `lib/supabase.js`, `package.json`, login, candidatos, score, delete, comportamental e as duas rotas de upload.

Não alteramos o SQL da view neste pacote. A inconsistência com versões históricas de avaliações na `vw_ranking` documentada anteriormente continua pendente de uma migração própria. A rota de score passou a buscar apenas a avaliação ativa.

### 5. Conferir o deploy antes do SQL 02

Confirme status Ready. Entre com a senha nova. Verifique que o ranking carrega, que os arquivos abrem e que decisões e avaliações salvam. Use uma inscrição fictícia para testar o fluxo. Faça logout e confirme que voltar ao painel exige login. Não exclua candidatos reais como teste.

### 6. Executar SQL 02

Só depois do código novo estar publicado, execute `migrations/02_restringir_acessos.sql` no Supabase. Ele limita o acesso direto às tabelas/view, ativa RLS e torna privados os buckets de áudios/currículos. As APIs seguem utilizando service_role, cuja chave deve continuar exclusiva do servidor.

O script tem transação: erro antes do COMMIT deve desfazer o bloco. Não cria políticas de acesso público. Ele protege os objetos existentes listados; futuras tabelas exigem revisão própria. Não modifica automaticamente privilégios padrão para objetos futuros.

### 7. Conferir novamente

- Cadastro de candidato fictício com aceite de privacidade.
- Responder as 25 perguntas; confirmar persistência e avanço.
- Gravar/enviar áudio e enviar currículo nos limites aceitos pelo bucket.
- Entrar no admin, ouvir áudio, abrir currículo, salvar notas e observação.
- Salvar decisão, atualizar e confirmar persistência.
- Conferir posição, perfis, data e nota final preservados.
- Confirmar que links públicos antigos não abrem e que links temporários novos abrem.
- Após 10 minutos, usar Atualizar para renovar links expirados.
- Confirmar que GET `/api/candidatos` sem login não lista dados (retorna 401).

O código foi validado com mocks; esta etapa confirma configuração e integração reais.

## Testes realizados e limites

`npm test` executa 33 verificações locais com módulos simulados, sem chamar serviços externos. Cobrem assinatura, adulteração, expiração, escopo da empresa, diferença entre sessão de candidato/admin, vínculo entre inscrições, origem e bloqueio das principais APIs antes de acessar o banco. Todos passaram. Todos os arquivos JS/JSX/MJS de app/lib também foram analisados com parser JSX no ambiente de preparação.

Não foi executado build Next/Vercel, teste visual em navegador ou teste real de Supabase. As dependências de produção não estavam instaladas neste ambiente. Em particular, validar `server-only`, imports e build na Vercel antes de aplicar SQL 02. O teste com mocks não substitui isso.

## Limitações e próximos passos

- O usuário administrativo ainda é compartilhado. O responsável fica registrado como `admin`; não é possível afirmar qual pessoa da equipe avaliou. Usuários individuais exigem etapa posterior.
- O limitador de tentativas do login é local por instância, com 10 tentativas por 15 minutos/IP; reinício e múltiplas instâncias limitam sua eficácia. Complementar com limitação no provedor ou solução compartilhada antes de ampliar divulgação.
- Sessões assinadas não têm revogação central. Logout remove o cookie do navegador; trocar SESSION_SECRET invalida todas as sessões. Não expor o segredo.
- Candidato com página recarregada não retoma automaticamente o fluxo. A sessão prova titularidade, mas não implementa recuperação de inscrição.
- Ainda há divergências nos formatos e limites de upload, conforme documentação base; esta etapa não redesenhou o versionamento dos arquivos.
- URLs temporárias são links portadores: quem as receber pode acessá-las até expirar. Não compartilhá-las fora da equipe.
- Avaliação e registro do log são operações separadas. Falha no log pode ocorrer após salvar a nota; não há transação única entre as duas operações. Não há claim de auditoria imutável ou prova individual.
- As escolhas do checklist são guardadas no JSON e no log, mas a interface ainda não oferece uma tela de histórico ou reabre automaticamente escolhas anteriores. Observação atual é mostrada no card.
- A decisão de seleção ficou separada. O andamento existente continua sendo o último status de etapa; não foi substituído por um modelo completo de conclusão de todas as etapas.
- A view ainda pode incluir avaliações históricas e resultados de mais de um questionário. Tratar em migração específica, preservando pesos aprovados.
- Se o código ativo mudou depois do ZIP, reaplicar as diferenças sobre a versão atual antes de publicar.

## Recuperação

Não volte ao código antigo enquanto deixar arquivos privados: ele usa URLs públicas. Se houver falha de configuração, corrija as variáveis/build primeiro. Para voltar ao código anterior em emergência, considere indisponibilizar temporariamente o recrutamento e recuperar com ajuda técnica; não reabra permissões amplas por tentativa. O campo novo pode permanecer, pois é aditivo. SQL 02 não apaga registros ou objetos.


## Correção de regressão antes da publicação

Foram removidas exatamente duas referências indevidas a `logError` em `app/api/comportamental/route.js`: uma antes da declaração no ramo de dados incompletos e outra fora do escopo no catch. A checagem legítima depois do insert do log foi preservada. Não houve alteração de fórmula, permissões, cookies ou fluxo de sucesso.

Adicionado `tests/comportamental.mjs`, executado por `npm test` junto aos testes existentes. Oito cenários passaram: respostas ausentes, questionário incompleto, alternativa inválida, sucesso, falha no resultado, falha no status, falha no log e nova tentativa após falha simulada. Erros de banco agora retornam JSON HTTP 500 nos cenários testados, sem ReferenceError. O teste usa mocks: não comprova atomicidade nem ausência de gravação parcial. Upsert, status e log continuam operações separadas. Falha no log após persistir resultado/status pode exigir retry; a correção não transforma essas operações em transação.

Os 33 testes anteriores também continuam passando. A tela de login ainda generaliza mensagens de falha, o ranking e os problemas de upload documentados continuam pendentes. Não publicar sobre uma versão do GitHub posterior ao ZIP base sem comparar suas diferenças. Confirmar vaga ativa e APP_ORIGIN antes do deploy. Publicação e SQLs não foram executados por esta correção.
