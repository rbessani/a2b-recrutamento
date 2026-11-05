export const PERFIL_FIELDS = ['peso_perfil_a','peso_perfil_b','peso_perfil_c','peso_perfil_d']
export const DEFAULT_SCRIPT = 'Olá, bom dia! Meu nome é [SEU NOME] da Bessani Soluções. Trabalhamos com gestão empresarial há mais de 30 anos. Você teria 3 minutinhos?'
export function validId(id) { return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) }
export function vacancyPayload(body, original = null) {
 if (!body || typeof body !== 'object') throw new Error('Dados da vaga inválidos.')
 if (typeof body.titulo !== 'string' || !body.titulo.trim() || body.titulo.trim().length > 160) throw new Error('Informe um título com até 160 caracteres.')
 if (typeof body.descricao !== 'string' || body.descricao.length > 10000) throw new Error('Descrição inválida (máximo 10.000 caracteres).')
 if (typeof body.roteiro_audio !== 'string' || !body.roteiro_audio.trim() || body.roteiro_audio.length > 6000) throw new Error('Informe a instrução do áudio (máximo 6.000 caracteres).')
 if (!['ativa','inativa','encerrada'].includes(body.status)) throw new Error('Situação inválida.')
 const output = {titulo:body.titulo.trim(),descricao:body.descricao.trim(),roteiro_audio:body.roteiro_audio.trim(),status:body.status}
 for (const key of PERFIL_FIELDS) {
  const n = Number(body[key])
  if (original?.pesos_bloqueados) {
   if (n !== Number(original[key])) throw new Error('Pesos bloqueados após a primeira inscrição. Duplique a vaga.')
  } else if (![1,2].includes(n)) throw new Error('Os pesos dos perfis devem ser 1 ou 2.')
  output[key]=n
 }
 return output
}
