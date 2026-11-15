# A2B v20 — revisão humana e ranking revisado
Pacote incremental sobre v19.1 já instalada e ativada. Preparado em 14/11/2026 (Brasília). Implementado e testado localmente; não publicado pelo assistente.

## O que muda
- Nas telas Ranking e Candidatos: Para revisar / Ranking revisado, com contagens.
- Para revisar mostra primeiro candidaturas completas, por data de conclusão; incompletas ao final, por cadastro. Notas da IA não determinam a ordem. Empates de data usam ID estável.
- Ranking revisado ordena somente candidaturas com áudio e currículo revisados e arquivos ativos. Posições são recalculadas nesse grupo, independentemente da busca. A composição continua 40% comportamental, 30% currículo e 30% áudio.
- Status: Candidatura incompleta; Aguardando análise da IA; Aguardando revisão humana; Falha na análise; Avaliação revisada; Incompleta — prazo encerrado. O status de revisão não muda a decisão de seleção.
- Sugestão da IA aparece identificada, sem transformar ausência de revisão em nota zero. Um zero aplicado pelo recrutador é uma nota válida e pode entrar no ranking.
- As abas de avaliações abrem inicialmente no currículo pendente ou no áudio pendente, quando presentes. Abrir a aba somente lê o registro salvo. Não chama a OpenAI.
- Não é mais preciso marcar uma caixa e depois confirmar. Após conferir as evidências nos detalhes, o recrutador clica Aplicar nota revisada. No currículo, pode ajustar a nota de 0 a 100; no áudio, mantém os dez critérios editáveis e precisa completar os não verificáveis. A aplicação ao ranking continua sendo uma ação humana explícita.
- A nota original do currículo fica em resultado.nota e a nota revisada em resultado.nota_confirmada. A nova função mantém a confirmação, o ajuste e o cálculo do total na mesma transação. Não reescreve observações pessoais nem a nota do áudio.
- As justificativas completas permanecem nas abas, separadas de Minhas observações. A listagem busca resumos de status e notas; não carrega justificativas completas de todos os candidatos.
- As avaliações manuais novas registram qual arquivo foi revisado. Avaliações de IA já aplicadas ao arquivo ativo são reconhecidas. Legado manual: só reconhece evidência de responsável administrativo, data posterior ao arquivo e correspondência da nota; currículo exige nota positiva no legado e áudio exige checklist. Registros antigos ambíguos ficam para revisão, preservando todas as notas e observações existentes. Nenhuma revisão em massa é inventada.
- Nome e painel lateral suspensos, gráfico comportamental, cores dos totais revisados e download v19.1 preservados. A arte anterior é referência visual: a implementação mantém a estrutura existente das fichas.

## Instalar, uma etapa por vez
1. Guarde o código atual do GitHub (Code / Download ZIP). Os backups de banco e Storage já conferidos neste acompanhamento continuam guardados; se houve novos envios desde então, atualize as cópias antes de instalar.
2. No Supabase SQL Editor, execute SOMENTE `migrations/11_revisao_curriculo.sql`. Ela adiciona uma função; não altera notas antigas, não reativa nem recria a fila. Requer as migrações anteriores já instaladas. Não execute novamente 08, 09 ou 10.
3. No GitHub, na raiz onde existe package.json, envie as pastas `app`, `components`, `lib`, `migrations` e `tests` deste ZIP preservando os caminhos. Não envie a pasta externa do ZIP. Não é necessário modificar package.json, next.config.js, variáveis Vercel, segredo, Vault ou agendamento.
4. Aguarde Vercel Ready. Entre pelo domínio oficial, atualize e faça os testes abaixo.

## Conferência SQL somente leitura
```sql
select p.proname as funcao,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_role,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='bsn_revisar_curriculo';
```
Esperado: uma linha, true / false / false. Isso verifica permissões da função, não substitui testar o fluxo real.

## Testar na plataforma
- Abra Candidatos / Para revisar: a candidatura de teste com sugestão de currículo deve mostrar Aguardando revisão humana (ou Falha na análise se o áudio ainda falhou), sem posição nem total oficial na ficha. A nota sugerida não altera a ordem.
- Entre na aba Currículo. Revise o conteúdo e confira a nota sugerida. Nos detalhes, ajuste Sua avaliação se necessário e clique Aplicar nota revisada. Não há caixa adicional. Minhas observações e nota do áudio devem permanecer.
- Enquanto o áudio não for revisado, o candidato permanece em Para revisar. Para testar a classificação sem nova chamada paga, ouça e use a avaliação manual do áudio existente, preencha os dez critérios e salve.
- Após os dois materiais revisados, a candidatura aparece em Ranking revisado. Sua posição considera só esse grupo. Use a aba para conferir o total de revisados; ele será diferente do antigo total de todos os inscritos.
- Confira uma candidatura antiga já revisada e outra incompleta. Nenhuma deve perder arquivo, nota ou observação. Se faltar evidência confiável de revisão no legado, ela pode aparecer em Para revisar; isso não apaga a nota antiga.
- Digite um rascunho em Minhas observações e tente trocar de lista: deve pedir confirmação antes de descartar. Alternar entre abas da mesma ficha preserva o rascunho. A atualização completa da página tem o comportamento anterior.
- Confira que os gráficos e os elementos suspensos continuam presentes e que Baixar funciona.

## Áudio: limite do ajuste
A falha mostrada no teste ainda NÃO tem causa confirmada. O worker passa a guardar na fila a mensagem já sanitizada devolvida pela rotina de análise (até 600 caracteres), e a tela a exibe. Não grava conteúdo bruto da API nem chaves. Erros anteriores já gravados com mensagem genérica permanecem genéricos. Este pacote não repete automaticamente tarefas que falharam nem promete resolver conversão/timeout/modelo sem diagnóstico. O botão de análise manual por IA tenta novamente e pode consumir a API; avaliação manual humana continua disponível sem essa chamada.

## Validação local
Suite existente: 14 grupos passaram. Novos testes de classificação cobrem revisão explícita, arquivo trocado, zero, legado, erro, ordem por conclusão e exclusão de sugestões do ranking. Testes SQL incluem 22 verificações de abas existentes mais ajuste da nota para zero, preservação da sugestão original/áudio/observações, idempotência e permissões. Rotas de leitura, worker e download passaram com serviços simulados. Build Next.js passou. Nenhuma chamada paga, acesso ao banco real ou deploy feito pelo assistente. Não houve validação visual concluída em navegador; a conferência do deploy é necessária.

## Voltar ao código anterior
Se houver problema de tela, restaure os arquivos anteriores pelo GitHub e faça redeploy. A função 11 pode permanecer sem uso. Não exclua tabelas, análises ou arquivos para desfazer esta interface. A fila, prazos e configurações da v19.1 continuam independentes desta mudança de tela.
