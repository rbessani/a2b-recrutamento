export function progressoInscricao(resultado, arquivos = []) {
  const valido = tipo => arquivos.some(a => a.tipo === tipo && a.ativo === true && ['enviado','processando','processado'].includes(a.status));
  const etapas = { dados: true, questionario: !!resultado, audio: valido('audio'), curriculo: valido('curriculo') };
  const proxima_etapa = !etapas.questionario ? 3 : !etapas.audio ? 4 : !etapas.curriculo ? 5 : 6;
  return { etapas, proxima_etapa, concluida: proxima_etapa === 6 };
}
export function contagemPersistida(resultado) {
  const c = resultado?.json_resultado?.contagem;
  return c && ['A','B','C','D'].every(k => Number.isInteger(c[k]) && c[k]>=0) && Object.values(c).reduce((a,b)=>a+b,0) === 25 ? {A:c.A,B:c.B,C:c.C,D:c.D} : null;
}
