// 4 MB decimais deixam margem para o multipart no limite da hospedagem.
export const MAX_UPLOAD_BYTES = 4_000_000
export const UPLOAD_SIZE_MESSAGE = 'Arquivo muito grande. O limite é 4 MB. Escolha um arquivo menor ou reduza o tamanho e tente novamente.'
export function uploadError(file) {
  if (!file || typeof file.size !== 'number' || file.size <= 0) return 'Selecione um arquivo válido e não vazio para continuar.'
  return file.size > MAX_UPLOAD_BYTES ? UPLOAD_SIZE_MESSAGE : ''
}
export async function readUploadResponse(res) {
  if (res.status === 413) throw new Error(UPLOAD_SIZE_MESSAGE)
  let json
  try { json = await res.json() } catch {
    throw new Error('Não foi possível enviar o arquivo. Tente novamente. Se o problema continuar, escolha um arquivo menor, de até 4 MB.')
  }
  if (!res.ok) throw new Error(json.error || 'Não foi possível enviar o arquivo. Tente novamente.')
  return json
}
