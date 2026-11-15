// Números brasileiros: não adivinha DDD, ramal ou código internacional.
export function numeroWhatsApp(valor){
  if(typeof valor!=='string')return null;
  const bruto=valor.trim();
  if(!bruto||!/^[+\d\s().-]+$/.test(bruto))return null;
  let n=bruto.replace(/\D/g,'');
  if(n.startsWith('0055'))n=n.slice(2);
  if(n.length===10||n.length===11){if(bruto.startsWith('+'))return null;n='55'+n;}
  if(!/^55[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(n))return null;
  return n;
}
export function mensagemWhatsApp({nome,vaga,tipo='contato'}){
  const primeiro=String(nome||'').trim().split(/\s+/)[0]||'tudo bem';
  const abertura=`Olá, ${primeiro}! Tudo bem? Aqui é da equipe de recrutamento da Bessani Soluções.`;
  const assunto=vaga?` para a vaga de ${vaga}`:'';
  if(tipo==='entrevista')return `${abertura}\n\nGostaríamos de conversar com você sobre sua candidatura${assunto}. Podemos combinar um horário para uma entrevista?`;
  if(tipo==='retorno')return `${abertura}\n\nEstamos entrando em contato para conversar sobre sua participação no processo seletivo${assunto}. Você tem disponibilidade para falar?`;
  return `${abertura}\n\nRecebemos sua candidatura${assunto} e gostaríamos de conversar com você. Podemos falar por aqui?`;
}
export function linkWhatsApp(numero,mensagem){
  const n=numeroWhatsApp(numero);
  return n&&mensagem.trim()?`https://wa.me/${n}?text=${encodeURIComponent(mensagem)}`:null;
}
