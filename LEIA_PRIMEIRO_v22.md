# v22 — Contato pelo WhatsApp

Base: v20, com a régua de currículo original mantida. A v21 foi cancelada.

## Instalação
1. Extraia o ZIP.
2. No GitHub, envie as pastas app, components e lib, preservando os caminhos e substituindo os arquivos correspondentes. Não apague essas pastas.
3. Aguarde o deploy Production ficar Ready e acesse o endereço oficial da plataforma.
Não execute SQL e não altere variáveis, chaves ou agendamento.

## Uso e teste
Na ficha do candidato, clique em WhatsApp, ao lado da decisão de seleção. Confira o nome e o telefone, escolha uma das três mensagens e edite o texto. Clique em Abrir WhatsApp: a conversa abre em outra aba ou no aplicativo, com o texto preenchido. O envio é feito pelo recrutador no WhatsApp. Fechar e Escape encerram a janela de preparação. Copiar mensagem oferece uma alternativa de uso.

Teste com um número de sua equipe em uma candidatura de teste. Confira se o destinatário e o texto estão corretos; não envie mensagens de teste a candidatos reais. Verifique também uma ficha sem telefone: o botão fica desabilitado com uma explicação.

Aceita telefone brasileiro com DDD, com ou sem +55. Números inválidos não são corrigidos por adivinhação. O campo WhatsApp tem preferência sobre telefone. A validação de formato não confirma que exista uma conta WhatsApp.

Abrir o WhatsApp não confirma entrega, não salva histórico de contato e não altera notas, ranking, decisão ou prazo da candidatura. Não envia arquivos, avaliações ou links privados. Não reabre inscrições encerradas. Nenhuma mensagem é enviada automaticamente.

## Validação
Testes automatizados existentes e verificações de normalização de telefone e codificação de mensagem. Compilação de produção com configuração fictícia de teste, sem credenciais de produção. Integração real com WhatsApp e aparência no navegador dependem da conferência após publicação.

## Reversão
Restaure app/page.jsx da v20. Os dois novos arquivos podem ser retirados depois de restaurar a página. Não há alteração no banco.
