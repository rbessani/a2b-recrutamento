# v14 — Ficha compacta e contexto durante a rolagem

Base: ZIP real a2b-recrutamento-main(1).zip enviado nesta conversa, com a v13 instalada.

## O que muda

- Nome, código, contato, decisão e resumo das notas acompanham a rolagem dentro da ficha de cada candidato.
- Ao passar para outra ficha, o contexto passa para o respectivo candidato. Não é um cabeçalho global com nome antigo.
- No desktop, o card Resultado geral acompanha a rolagem abaixo do cabeçalho quando há espaço. Não estica até o fim da observação.
- Em telas estreitas ou com altura de até650px, o resultado lateral fica no fluxo normal; o resumo das notas no cabeçalho continua disponível.
- Espaços, paddings e controles foram compactados. Os botões principais continuam iguais e alinhados.
- Observação começa com três linhas, com Ampliar campo / Reduzir campo. O texto permanece ao alternar o tamanho e pode ser salvo pelo mesmo botão.
- Gráfico de barras, contagens, cores dinâmicas, fórmulas, notas e dados permanecem os existentes.

A ficha ainda pode precisar de rolagem, conforme tamanho da tela, nome do candidato, texto e checklist aberto. Esta versão mantém o contexto visível; não promete encaixar qualquer conteúdo em uma dobra.

## Atualizar — três arquivos de interface

| Caminho | Ação |
|---|---|
| app/page.jsx | Substituir |
| components/ObservacaoRecrutador.jsx | Substituir |
| components/ContextoCandidato.jsx | Criar |

1. Extraia o ZIP.
2. No GitHub, abra a raiz do repositório a2b-recrutamento, branch main.
3. Clique em Add file → Upload files.
4. Arraste juntas as pastas app e components deste ZIP. Elas contêm apenas os três arquivos acima.
5. Confira os caminhos e clique em Commit changes.
6. Aguarde a Vercel Ready e teste no endereço oficial.

Não executar SQL. Não alterar variáveis. Não reenviar lib ou public. Não alterar APIs. Não publicar só a página sem o componente novo, pois isso causa importação ausente.

## Teste manual

1. Abra Candidatos, confira perfil de barras e cores do resultado geral.
2. Role até a observação: confirme que nome/código e resumo de notas continuam visíveis.
3. No desktop com altura suficiente, resultado geral deve acompanhar a rolagem sem coluna azul esticada.
4. Digite, amplie e reduza o campo. O texto não pode sumir. Clique em Salvar observação e depois atualize para confirmar persistência.
5. Passe para a ficha seguinte. O nome deve corresponder à ficha atual.
6. Abra o checklist do áudio e role. Contexto deve permanecer disponível e opções continuam funcionando.

## Referência técnica

ContextoCandidato é um componente externo estável que envolve cada ficha em article. Seu header usa position:sticky, top:0, fundo branco e z-index5. Um ResizeObserver mede o cabeçalho e atualiza a variável CSS --altura-contexto no próprio article; o resultado lateral usa esse valor como afastamento superior. O observer é desconectado na desmontagem.

A grade usa align-items:start, e o aside usa align-self:start para não acompanhar artificialmente a altura da coluna esquerda. O sticky é limitado à respectiva ficha/grade. Próximo à borda final de cada ficha, o navegador naturalmente desloca o bloco fixo para permitir a entrada da próxima ficha. O cabeçalho também mostra o resumo das notas, inclusive quando não cabe fixar o resultado lateral.

No celular, o resultado fica no fluxo normal e o cabeçalho admite rolagem interna em casos de conteúdo alto, limitado a45vh. Os botões continuam com grade responsiva da v13. Altura mínima dos botões reduzida de44 para38px; fontes principais preservadas. Textarea rows3/8 e resize vertical continuam disponíveis.

Nenhum endpoint, autorização, persistência, consulta, cálculo ou tabela foi modificado. A observação continua usando a API independente da v13 e seu registro em logs_processamento. A pendência dos testes antigos do repositório permanece; não foi alterada por este ajuste visual.

## Verificação

Build de produção passou com variáveis fictícias. Conferência no navegador com dados e banco simulados: cabeçalho fixo, resultado lateral, transição entre duas fichas, largura375px sem overflow horizontal no conteúdo, ampliação/redução do texto e salvamento com confirmação. O título, os gráficos de barras e a função de cores do resultado permanecem existentes. Código de QA e dados fictícios não estão no ZIP.

Não publicado em produção por este trabalho.
