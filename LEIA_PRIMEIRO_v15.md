# v15 — Atualização dos testes automatizados

## Resultado

O comando npm test passou, com saída0, na base do ZIP a2b-recrutamento-main(2).zip (v14). São10 grupos: segurança/sessões, questionário, vagas, validação de arquivos, rotas de upload, contato do cadastro, consulta sem cache, retomada, questionário imutável e observações do recrutador.

O erro anterior era do carregador dos testes: ele importava as rotas por data URL, mas não resolvia o helper novo @/lib/upload-pendente. O teste do questionário também precisava acompanhar a leitura de resultado existente e o INSERT que preserva a primeira conclusão, em lugar do UPSERT antigo.

Não foram removidas as verificações de segurança para fazer o comando passar. O carregador passou a resolver os helpers atuais, e os testes usam cenários compatíveis com a implementação vigente. O script npm test agora inclui os testes locais já preparados para as atualizações recentes. Caminhos de arquivo nos carregadores usam fileURLToPath quando necessário para tratar caracteres e caminhos do sistema operacional; a execução foi conferida em Linux, não em Windows.

## Instalar no GitHub

1. Extraia o ZIP.
2. Abra a raiz do repositório a2b-recrutamento, branch main.
3. Clique em Add file → Upload files.
4. Arraste o arquivo package.json e a pasta tests deste ZIP juntos.
5. Clique em Commit changes.

Não enviar app, components, lib ou public. Não executar SQL. Não alterar variáveis, segredos ou dependências. Este pacote não muda telas, APIs, banco, notas ou inscrições. O script build continua next build. O script test é a única mudança funcional no package.json.

Um commit na main pode disparar o deploy automático já configurado na Vercel. Isso decorre da integração existente; esta entrega não modifica a produção nem acessa GitHub/Vercel por conta própria.

## Executar os testes

Em uma cópia local do projeto, com Node e as dependências do projeto instalados, abra o terminal na pasta onde está package.json:

```bash
npm test
```

Se as dependências ainda não estão instaladas, primeiro:

```bash
npm install
npm test
```

O comando interrompe no primeiro grupo que falhar e retorna código diferente de0. Todos passaram nesta conferência. Não são necessárias credenciais reais: os testes configuram valores fictícios no próprio processo. Não copie esses valores para a Vercel.

A Vercel continua executando o build já configurado; atualizar npm test não faz a hospedagem executar automaticamente a suíte. Um futuro ajuste no CI pode criar essa exigência antes de publicar, mas não está incluído nesta atualização.

## Cobertura e limites

- Sessões e origem: assinatura, expiração, cookies e bloqueio antes do banco.
- Vagas e questionário: validação, filtros e preservação da primeira conclusão, inclusive após falha auxiliar.
- Uploads: limite, formatos, pré-requisitos, proibição de substituir arquivos, falha de Storage e compensação em conflito.
- Contato: telefone/WhatsApp e estado correspondem ao formulário.
- Consulta sem cache: SDK real com transporte simulado lê a alteração sem reutilizar resposta antiga.
- Retomada: progresso, isolamento por inscrição/vaga/empresa, sessão expirada, ausência de exposição de notas e caminhos internos.
- Observações: salvar/ler/limpar, texto legado, autenticação, limites e preservação das notas.

Os cenários usam banco/Storage/transporte simulados, com as funções reais sob teste. Não fazem chamadas ao Supabase de produção e não comprovam permissões, índices ou integrações do banco real. Não incluem automação de layout no navegador. Os testes não substituem a conferência operacional que você fez no site.

O arquivo tests/sql-vagas.mjs que já existe no repositório é um teste separado da migração com PGlite. Ele não fazia parte do npm test anterior e continua fora da suíte padrão; depende de uma ferramenta de desenvolvimento não declarada no package.json atual. Não executar migrações na produção para rodar testes. Nenhuma dependência nova foi adicionada para esta entrega.

## Arquivos do pacote

- package.json — somente scripts.test atualizado, sem mudar dependências.
- tests/security.mjs
- tests/comportamental.mjs
- tests/vagas.mjs
- tests/uploads.mjs
- tests/upload-routes.mjs
- tests/cadastro-contato.mjs
- tests/supabase-atualizacao.mjs
- tests/retomada.mjs
- tests/questionario-imutavel.mjs
- tests/observacao-recrutador.mjs
- Este guia, opcional no repositório.

O código executado pelo site foi comparado com o ZIP da v14 e permaneceu idêntico em app, components, lib, public e migrations. Não é necessário repetir o build para validar mudanças somente em testes: o build dessa mesma base já passou na conferência anterior. Esta atualização não foi publicada por este trabalho.
