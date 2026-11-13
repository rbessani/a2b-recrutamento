# A2B v16 — avaliação assistida de currículo

Implementação preparada em 12/11/2026. Base: `a2b-recrutamento-main (2).zip` enviado na conversa de continuidade. Não foi publicada em produção por esta entrega. O ZIP contém SOMENTE as alterações, não é um projeto completo para substituir o repositório inteiro.

## Como funciona

1. No administrativo, abra Candidatos e selecione a vaga.
2. Clique em **Analisar currículo com IA**. O arquivo deve estar enviado.
3. O servidor busca o currículo privado e os dados da vaga daquela inscrição.
4. A OpenAI retorna uma prévia: nota sugerida, quatro critérios, justificativas, evidências, pontos fortes e perguntas para entrevista.
5. Confira as evidências no currículo e marque que revisou. Nada foi alterado no ranking até aqui.
6. Clique em **Confirmar nota e justificativas**.
7. Uma transação aplica somente a nota do currículo, recalcula o total 40/30/30, acrescenta o texto às observações internas e marca a análise como aplicada. Áudio, checklist, decisão de seleção e resultado do questionário permanecem.

A IA não aprova nem reprova o candidato. A nota é de evidências documentais segundo uma régua, não um diagnóstico de competência ou personalidade. A confirmação identifica o responsável como admin compartilhado, porque o projeto ainda não tem usuários administrativos individuais.

## 1. Primeiro: banco, antes do GitHub

Faça o backup habitual. No SQL Editor do Supabase, execute **somente** o conteúdo de `migrations/04_analise_curriculo_ia.sql`.

Esse SQL não apaga nem recalcula notas antigas. Cria a tabela privada `analises_curriculo` e três funções. Não refaz os índices antigos nem muda permissões de tabelas/buckets existentes. As funções novas têm EXECUTE somente para `service_role`, além do proprietário do banco.

Depois execute:

```sql
select p.proname,
       has_function_privilege('service_role', p.oid, 'execute') as service_role_pode_executar,
       has_function_privilege('anon', p.oid, 'execute') as anon_pode_executar,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_pode_executar
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('bsn_iniciar_analise_curriculo',
                    'bsn_confirmar_analise_curriculo',
                    'bsn_salvar_observacao_recrutador');
```

Esperado: três linhas com **true / false / false**, respectivamente. Se o SQL falhar ou faltar uma função, não envie o código novo. A rota de observações passa a usar a terceira função; sem a migração ela não consegue salvar.

Não execute novamente os SQLs 01/02/03. A migração 04 é compatível com a versão anterior, que continua funcionando enquanto o código novo não for publicado.

## 2. Arquivos exatos para levar ao GitHub

A raiz é onde já existe `package.json`. Preserve todos os arquivos atuais que não estão neste pacote. Não arraste a pasta externa `A2B_Recrutamento_v16_Avaliacao_Curriculo_IA` criando outro nível no GitHub.

| Caminho relativo | Ação |
|---|---|
| `app/page.jsx` | Substituir |
| `app/api/candidatos/observacao/route.js` | Substituir |
| `app/api/candidatos/curriculo-ia/route.js` | Criar |
| `app/api/candidatos/curriculo-ia/confirmar/route.js` | Criar |
| `components/ObservacaoRecrutador.jsx` | Substituir |
| `components/EntradaCandidatura.jsx` | Substituir; inclui informação do processamento por IA no aviso |
| `components/AvaliacaoCurriculoIA.jsx` | Criar |
| `lib/curriculo-ia.mjs` | Criar |
| `migrations/04_analise_curriculo_ia.sql` | Criar no repositório para documentar; executar no Supabase conforme passo 1 |
| `package.json` | Substituir |
| `tests/observacao-recrutador.mjs` | Substituir |
| `tests/curriculo-ia.mjs` | Criar |
| `tests/curriculo-ia-routes.mjs` | Criar |
| `tests/curriculo-ia-sql.mjs` | Criar |

As pastas `public` e as demais rotas já existentes continuam no projeto; não precisam ser reenviadas nesta atualização. `INSTALACAO_v16.md` é documentação, pode ficar no repositório. Não enviar `node_modules`, `.next`, arquivos de configuração com senhas ou a pasta de demonstração.

Faça o upload dos arquivos juntos no mesmo commit, mantendo os caminhos exatos. A Vercel publica automaticamente após o commit na main, conforme o fluxo atual do projeto.

## 3. Configuração da Vercel

A integração fica desativada até existir configuração no servidor. O restante da avaliação manual continua disponível.

Em Project → Settings → Environment Variables, adicionar:

| Nome | Valor |
|---|---|
| `OPENAI_API_KEY` | Sua chave de API da OpenAI, do seu projeto de API |
| `OPENAI_CURRICULO_MODEL` | `gpt-4.1` (padrão deste pacote; pode ser alterado para modelo compatível após testar) |
| `OPENAI_CURRICULO_ENABLED` | `true` para ativar; `false` para suspender novas análises |

Nenhuma dessas variáveis usa `NEXT_PUBLIC_`. Não cole a chave no GitHub, SQL, ZIP nem nesta conversa. As variáveis de Supabase, empresa, origem e sessão já existentes devem ser mantidas.

Use o ambiente Production; só habilite Preview se quiser testar nele e se APP_ORIGIN estiver correto para aquele ambiente. Alterar variável exige novo deployment para o código usá-la. A API usa cobrança própria; confira créditos/faturamento da sua conta de API antes de ativar. Não há preço fixo por currículo neste pacote: tamanho do PDF, modelo e resposta afetam o consumo.

O aviso público passa a informar apoio da OpenAI e possível transferência internacional. Isso não certifica adequação jurídica e não prova que candidatos antigos viram o aviso atualizado. Antes de usar dados reais, confirme a compatibilidade do tratamento com o aviso/base adotados pela empresa e seus procedimentos de retenção e exclusão. Não é necessário pedir ao candidato para refazer o questionário por causa desta atualização técnica.

## 4. Teste após o deploy

Use primeiro uma inscrição de teste e currículo fictício:

1. Verifique que a avaliação manual e o botão Salvar observação continuam funcionando.
2. Escreva uma anotação, salve e gere a análise do currículo.
3. Confira nome, vaga, quatro critérios e evidências.
4. Antes de confirmar, confira que a nota do painel não mudou.
5. Confirme a análise. A nota do currículo deve mudar, o áudio e comportamento devem permanecer e o total respeitar 40/30/30.
6. Confira a anotação anterior seguida das justificativas. Atualize a lista para conferir a persistência.
7. Abra novamente a análise do mesmo currículo/vaga: ela é reutilizada e não deve acrescentar texto duas vezes.
8. Teste alterações não salvas nas observações: a confirmação deve ficar bloqueada até salvar/reverter seu rascunho.
9. Teste o caso sem currículo: botão desabilitado. Sem configuração: mensagem clara, sem mudar notas.
10. Somente depois teste com um caso real autorizado e revise a qualidade antes de confirmar a nota.

Se a IA falhar, usar avaliação manual. Não mudar chaves de sessão, permissões públicas ou buckets para tentar resolver erros de análise.

## Estrutura e persistência para o próximo agente

- O envio do candidato não dispara IA. Somente admin autenticado, mesmo APP_ORIGIN e candidato da empresa configurada podem pedir análise/confirmação.
- `lib/curriculo-ia.mjs`: prompt `bsn-curriculo-v1`, schema de resposta, validação e formatação da observação. A soma é calculada pelo servidor; a API não aceita nota enviada pelo navegador na confirmação.
- Régua fixa nesta versão: experiência direta 30, conhecimento relevante 30, experiência correlata/transferível 30, evidências comportamentais profissionais/cursos 10. Há faixas orientadoras de evidência, instrução contra dupla contagem e proibição de usar características pessoais. **O JSON `vagas.criterios_avaliacao` não é interpretado nem editado nesta fase.** Para usar critérios configuráveis, criar contrato e validação próprios.
- Dados reais consultados: `candidatos.id/vaga_id/empresa_id`; `vagas.id/titulo/descricao/requisitos_obrigatorios/diferenciais`; currículo ativo em `arquivos_candidatos`, incluindo bucket/caminho/nome/tamanho/versão. O modelo não recebe o áudio, respostas do teste ou observações do gestor. O currículo inteiro pode conter dados pessoais; ele é transmitido, não anonimizado.
- `analises_curriculo` relaciona empresa, candidato e arquivo por FKs com exclusão em cascata. Guarda snapshot da vaga, hash do contexto, modelo, versão de prompt, resultado, texto, ID de resposta, uso de tokens e datas. Não há cópia adicional do arquivo nesta tabela.
- Status: processando → pronta → aplicada; falha → erro. Nenhum score é alterado na geração da prévia.
- Hash inclui contexto da vaga, ID/versão do arquivo, modelo solicitado e versão do prompt. Resultado pronto/aplicado é reutilizado sem nova chamada paga. Não há botão de refazer uma análise já aplicada do mesmo contexto. Para alterar a metodologia, incrementar versão do prompt após validação, nunca editar silenciosamente a análise anterior.
- O modelo solicitado tem fallback `gpt-4.1`; a resposta guarda o identificador efetivamente retornado. SDK extra da OpenAI não é necessário; usa fetch no servidor.
- Arquivo é baixado do Storage privado, limitado a 4.000.000 bytes e enviado em base64 para `/v1/responses` com `store:false`. Não cria arquivo persistente pela Files API, não usa URL assinada como entrada e não expõe a chave ao navegador. PDF pode incluir texto/imagens; DOCX tem extração textual pelo provedor. Documento ilegível/sem evidência suficiente não vira nota zero automaticamente: a operação falha e oferece avaliação manual.
- `store:false` não equivale a retenção zero: controles operacionais do provedor continuam aplicáveis.
- Conteúdo da vaga/documento é tratado como dado não confiável; sem ferramentas, links externos ou execução de instruções do currículo. Prompt ajuda, mas revisão humana é essencial; não há garantia de veracidade das evidências citadas.
- Limite distribuído: 30 análises novas por empresa em uma janela de uma hora, incluindo falhas, com lock curto no PostgreSQL. Cache não consome uma chamada nova. Uma geração por candidato por vez. Processamento abandonado é invalidado após três minutos na próxima solicitação. Chamada OpenAI tem timeout de 45 s; rota declara maxDuration=60, sujeito à configuração/plano efetivos da hospedagem. Não há fila ou worker neste pacote.
- `bsn_confirmar_analise_curriculo` faz a gravação atômica de avaliação + observação + marca de aplicada. Confere arquivo ainda ativo e descrição/título/requisitos/diferenciais atuais iguais ao snapshot. Calcula comportamento pelo resultado persistido mais recente, preserva score_audio e JSON de checklist. Registra análise sob `json_avaliacao.curriculo_ia`. Não escreve decisão de seleção, estado da candidatura ou resultado do teste.
- Confirmar a mesma análise novamente retorna ja_aplicada e não escreve nota nem observação outra vez. Se a nota depois foi editada manualmente, repetir uma confirmação antiga não restaura a nota anterior.
- Observações continuam em `logs_processamento`, etapa `observacao_recrutador`; a nova função de gravação manual usa o mesmo lock por candidato da confirmação e compara observacao_base quando enviada. Texto vazio continua sendo uma limpeza válida. Limite 3.000 caracteres continua; não truncar a nota anterior para caber IA.
- A confirmação exige observacao_base igual ao texto persistido. A tela bloqueia confirmação enquanto o rascunho daquele candidato está sujo. Atualização após confirmação busca ranking sem desmontar as fichas e preserva rascunhos de outros candidatos.
- Concorrência legada das rotas de avaliação manual de áudio/CV permanece como era: elas gravam vários scores de uma vez. Não foi implantado versionamento otimista completo para todas as avaliações. Evitar editar a mesma ficha simultaneamente em dois acessos; esse endurecimento é etapa futura.
- Prévia fica recolhível dentro do card de currículo. Cabeçalho sticky, barras, cores do resultado e layout compacto anteriores são preservados. A inspeção visual nesta entrega foi desktop com dados fictícios; não houve nova rodada de testes em dispositivos móveis físicos.
- Dados novos entram no prazo de retenção já informado, até 24 meses e exclusão mediante solicitação. Não há job automático de limpeza implementado aqui; os procedimentos existentes de exclusão/retenção precisam incluir a tabela. FKs em cascata removem análises quando arquivo/candidato/empresa é apagado. Não tratar eventos com observações como logs descartáveis.
- Novas RPCs são SECURITY INVOKER, acessíveis ao service_role; anon/authenticated sem EXECUTE. Tabela nova com RLS e sem políticas públicas. APIs continuam verificando origem, sessão e empresa antes de chamar funções. Essas proteções não substituem controle de acesso da chave administrativa.

## Verificações feitas nesta entrega

- `npm test`: dez grupos existentes e dois novos passaram; API OpenAI e Supabase simulados nos testes de rotas.
- `npm run test:sql:curriculo`: 39 verificações PostgreSQL/PGlite isolado; permissão service_role não superusuário, negação anon/authenticated, cache, exclusão de concorrência de geração, confirmação, preservação do texto e checklist, conflito de contexto/arquivo/base, limite de texto, idempotência, limite por hora e rollback integral por falha do log.
- `npm run build`: passou com configuração fictícia, sem banco ou API reais.
- Navegador: demonstração desktop com dados fictícios e endpoints de QA separados; prévia, revisão obrigatória, confirmação, atualização das notas, preservação da observação e de rascunho de outro candidato. O código de QA NÃO está no ZIP.
- A chamada real à OpenAI e a migração no seu Supabase ainda precisam ser validadas após a configuração. Não alegar produção testada ou auditoria de segurança.

Para repetir os testes: `npm install`, `npm test`, `npm run test:sql:curriculo`, `npm run build` com as variáveis fictícias/ambiente próprio. A dependência de desenvolvimento `@electric-sql/pglite` foi fixada em 0.5.15; dependências da aplicação não foram atualizadas. O teste SQL não deve ser apontado ao banco de produção.

## Desativar e voltar

- Para suspender novas chamadas pagas: OPENAI_CURRICULO_ENABLED=false e redeploy. A avaliação manual continua. Análises prontas ainda podem ser confirmadas pela rota própria; essa flag controla geração, não revoga revisão de prévias já existentes.
- Para reverter o código: restaurar os arquivos da versão anterior, juntos. A tabela e funções novas podem permanecer privadas; não precisa apagar dados para voltar a interface anterior.
- Reverter código não desfaz notas já confirmadas. Corrigir uma nota pelo mecanismo manual, com observação adequada, quando necessário.

Referências de implementação: https://developers.openai.com/api/docs/guides/file-inputs ; https://developers.openai.com/api/docs/guides/structured-outputs ; https://developers.openai.com/api/docs/guides/your-data .
