# A2B v18 — observações e avaliações em abas

Pacote incremental sobre a v17. Preparado em 13/11/2026. Não publicado automaticamente. Preserva o componente ContextoCandidato (nome suspenso), o CSS do painel lateral suspenso, os gráficos e as cores existentes do resultado geral.

## Comportamento

- Um card com abas Minhas observações, Currículo e Áudio.
- As observações pessoais permanecem montadas quando outra aba abre; mudar de aba não descarta o rascunho. O ponto junto do título sinaliza alterações não salvas.
- Caixa compacta com rolagem vertical e opção de ampliar, limite de 10.000 caracteres. Mesmos caminhos de salvamento e comparação de texto-base para evitar sobrescrever outra edição.
- Na aba Currículo: peso de 30% no resultado geral e pesos internos Experiência 30%, Conhecimento 30%, Experiências correlatas 30%, Competências comportamentais 10%. Não confundir os pesos internos com os 30% da nota geral.
- Na aba Áudio: peso de 30% no total; dez critérios e conferência do roteiro nos detalhes.
- As análises salvas do arquivo ativo são buscadas somente na primeira abertura da respectiva aba. Alternar entre abas depois reutiliza os componentes montados. Recarregar a página ou remontar a ficha faz nova leitura, não nova chamada à OpenAI.
- Resumo curto visível e Ver avaliação completa recolhível, com área limitada a 360px e rolagem interna. Detalhes completos são carregados ao entrar na aba, não na listagem inicial de candidatos.
- Abrir uma aba faz GET autenticado de leitura; só clicar em Analisar solicita geração. Mesmo contexto pronto continua usando o cache existente.
- A consulta mostra a análise pronta/aplicada mais recente do arquivo ativo, com a data e a vaga registrada na análise. Não é uma tela de todo o histórico. Se a descrição mudou, gerar/consultar a vaga atual pode criar novo contexto; a confirmação mantém as verificações no banco para bloquear contexto desatualizado.
- Confirmar nota guarda as justificativas nas tabelas de análise e o evento de confirmação, sem acrescentar texto às observações pessoais. Nada é retirado dos textos antigos: conteúdo anteriormente misturado permanece integralmente.

## 1. Banco primeiro

Faça backup atualizado se houve novos cadastros desde sua última cópia. Este pacote usa as tabelas e funções das migrações 04 e 05 já instaladas. A correção 06 pode permanecer; a 07 substitui as funções correspondentes.

Execute SOMENTE migrations/07_observacoes_abas.sql no SQL Editor do Supabase Nexa. Não executar novamente 01/02/03/04/05/06. O SQL troca três funções, sem criar tabela nova, sem regravar observações ou recalcular notas existentes.

Confira em nova consulta:

```sql
select p.proname as funcao,
 has_function_privilege('service_role',p.oid,'execute') as service_role,
 has_function_privilege('anon',p.oid,'execute') as anon,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('bsn_confirmar_analise_curriculo','bsn_confirmar_analise_audio','bsn_salvar_observacao_recrutador');
```

Esperado: 3 linhas, true / false / false. Se falhar, não envie o código. Não restaurar a função antiga depois de salvar observações acima de 3.000 caracteres, pois as validações anteriores não aceitam esse tamanho.

## 2. GitHub

Na raiz do repositório (onde estão app, components, lib), Add file → Upload files. Envie juntos **app, components, lib, migrations e tests deste ZIP**, mantendo os caminhos. Não enviar a pasta externa A2B_v18_Observacoes_Abas como um nível extra. Não apagar os demais arquivos do repositório. Não há package.json ou next.config novo neste pacote.

### Arquivos alterados/criados

| Caminho | Ação |
|---|---|
| app/page.jsx | Substituir: novo card de abas, sem mudar header/aside |
| app/api/candidatos/analises/route.js | Criar: leitura privada das análises salvas |
| app/api/candidatos/observacao/route.js | Substituir: limite 10.000 |
| app/api/candidatos/curriculo-ia/confirmar/route.js | Substituir: texto-base até 10.000 |
| app/api/candidatos/audio-ia/confirmar/route.js | Substituir: texto-base até 10.000 |
| app/api/candidatos/score/route.js | Substituir: compatibilidade do campo legado até 10.000 |
| components/ObservacoesAvaliacoes.jsx | Criar: abas e pesos |
| components/ObservacaoRecrutador.jsx | Substituir: rolagem e limite |
| components/AvaliacaoCurriculoIA.jsx | Substituir: leitura salva, detalhes recolhíveis e notas separadas |
| components/AvaliacaoAudioIA.jsx | Substituir: leitura salva e detalhes recolhíveis |
| lib/use-analise-salva.js | Criar: leitura sob demanda e retry |
| lib/audio-ia.mjs | Substituir: mantém a correção v17.2 de validação |
| migrations/07_observacoes_abas.sql | Criar e executar no banco antes do código |
| tests/observacao-recrutador.mjs | Substituir: limite novo |
| tests/observacoes-abas-sql.mjs | Criar: testes isolados da migração |
| tests/observacoes-abas-routes.mjs | Criar: testes de leitura privada |

Não precisa alterar variáveis da Vercel nem criar chave. Aguarde deployment Production Ready e use https://a2b-recrutamento.vercel.app.

## 3. Teste acompanhado após instalar

1. Abra candidato com observação antiga. Confira o texto integral, inclusive justificativas antigas.
2. Escreva um rascunho sem salvar; abra Currículo, depois Áudio e volte. O texto deve permanecer.
3. Salve e recarregue; confira persistência. Teste uma observação maior que 3.000 e menor que 10.000 caracteres em inscrição fictícia.
4. Abra Currículo: confira pesos, resumo salvo e detalhes sem clicar em Analisar. Não deve haver geração paga ao trocar abas.
5. Abra Áudio e expanda: confira roteiro, critérios e opções confirmadas. Não deve alterar nota apenas ao consultar.
6. Em caso de teste, gere e confirme uma nova avaliação. A nota correspondente e o total mudam, mas o texto das suas observações permanece exatamente igual.
7. Confira nome suspenso e painel lateral durante rolagem, gráficos e cores; em celular, abas quebram linha e o painel lateral segue o comportamento responsivo existente.
8. Teste novamente autenticação e isolamento de empresa no ambiente próprio. Leitura nova usa sessão administrativa e Cache-Control private, no-store; não modifica permissões das tabelas.

## Validação desta entrega

- npm test: 14 grupos existentes passaram, com API/Supabase simulados. Teste de observação agora aceita 10.000 e recusa 10.001 caracteres.
- node tests/observacoes-abas-sql.mjs: 22 verificações em PostgreSQL/PGlite isolado, funções privadas, instalação repetida, 10.000 caracteres, confirmação de currículo/áudio sem alterar texto anterior, preservação de notas, idempotência e conflito de texto-base.
- node tests/observacoes-abas-routes.mjs: sessão, empresa, tipo permitido, arquivo ativo, leitura sem geração ou escrita, ausência de análise e cache privado passaram, com transporte simulado.
- npm run build: passou com variáveis fictícias.
- Não houve execução no Supabase real, chamada real à OpenAI nem publicação por esta entrega. A tentativa de iniciar o navegador local foi impedida por restrição do ambiente; não há captura nova ou verificação visual desktop/mobile concluída. Validar a interface após instalar. A imagem aprovada é referência, não captura da implementação.

## Continuidade e limites

Nenhuma nova coluna é necessária: analises_curriculo e analises_audio já guardam as justificativas. Não houve separação automática do conteúdo antigo de observações. Não houve alteração dos pesos nem da metodologia de pontuação do currículo nesta entrega. Retenção/exclusão seguem os procedimentos existentes, incluindo as tabelas de análise. Não foi adicionada tarefa automática de limpeza.

Os eventos de novas confirmações usam etapas avaliacao_curriculo_ia e avaliacao_audio_ia e guardam analise_id. A leitura das observações pessoais continua pela última observacao_recrutador, com fallback legado. O registro ativo de notas permanece com o resultado auditável e notas confirmadas.

A confirmação ainda pede salvar rascunhos antes de continuar, para preservar a experiência existente. As limitações anteriores de edição concorrente das rotas manuais de score continuam; evite editar uma mesma ficha simultaneamente em dois acessos. O novo GET não tem chamada de IA, não inicia análise e não revela credenciais.
