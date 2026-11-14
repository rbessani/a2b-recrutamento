$ErrorActionPreference = 'Stop'
try {
 $modelo = Join-Path $PSScriptRoot 'migrations\09_agendamento_MODELO.sql'
 if (!(Test-Path $modelo)) { throw 'Extraia todo o ZIP antes de executar.' }
 $segredo = Read-Host 'Ja configurou o segredo desta automacao? Cole-o aqui; se for a primeira vez, pressione Enter' -AsSecureString
 $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segredo)
 try { $valor = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
 if (!$valor) {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $valor = -join ($bytes | ForEach-Object { $_.ToString('x2') })
 }
 if ($valor -notmatch '^[a-fA-F0-9]{64}$') { throw 'Use o segredo de 64 caracteres gerado por este assistente.' }
 Set-Clipboard -Value $valor
 Write-Host 'Segredo copiado. Na Vercel crie CANDIDATURA_WORKER_SECRET (Production) e cole o valor.'
 Write-Host 'Crie tambem CANDIDATURA_AUTOMATICA_ENABLED com valor true (Production).'
 Write-Host 'Faca o redeploy e aguarde ficar Ready.'
 $saida = Join-Path $PSScriptRoot '09_AGENDAMENTO_PREENCHIDO_NAO_PUBLICAR.sql'
 $sql = [IO.File]::ReadAllText($modelo)
 # Substitui apenas literais do segredo. Mantem a protecao contra modelo nao preenchido.
 $sql = $sql.Replace("'COLE_O_SEGREDO_AQUI'", "'$valor'")
 [IO.File]::WriteAllText($saida, $sql, (New-Object Text.UTF8Encoding($false)))
 Write-Host 'Arquivo SQL preenchido criado nesta pasta. Nao publique esse arquivo no GitHub nem envie no chat.'
 Read-Host 'Depois do redeploy, execute 09_AGENDAMENTO_PREENCHIDO_NAO_PUBLICAR.sql no Supabase. Entao pressione Enter para testar'
 $res = Invoke-RestMethod -Method Post -Uri 'https://a2b-recrutamento.vercel.app/api/interno/processar-fila' -Headers @{Authorization="Bearer $valor"} -ContentType 'application/json' -Body '{}'
 if ($res.pausada) { throw 'Configure CANDIDATURA_AUTOMATICA_ENABLED=true e faca redeploy.' }
 if (!$res.vazia -and !$res.processada) { throw 'Resposta inesperada. Nao ative a regra ainda.' }
 Write-Host 'Endpoint respondeu corretamente. Agora execute migrations/10_ativar_candidaturas.sql como ultimo passo.' -ForegroundColor Green
} catch { Write-Host ('Nao foi possivel concluir: ' + $_.Exception.Message) -ForegroundColor Red }
finally { $valor=$null; Read-Host 'Pressione Enter para fechar' }
