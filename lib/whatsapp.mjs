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
  if(tipo==='nao_avancou')return `${abertura}\n\nAgradecemos seu interesse e sua participação no processo seletivo${assunto}. Nesta seleção, decidimos seguir com candidaturas mais alinhadas às necessidades atuais da vaga, e você não avançará para a próxima etapa.\n\nVocê será bem-vindo(a) para se candidatar novamente em futuras oportunidades. Acompanhe as próximas oportunidades pelo nosso Instagram: @bessanisoftwares — https://www.instagram.com/bessanisoftwares/. Desejamos sucesso na sua trajetória!`;
  if(tipo==='incompleta')return `${abertura}\n\nSua candidatura${assunto} foi encerrada como incompleta, pois não recebemos todos os arquivos obrigatórios (currículo e áudio) dentro do prazo informado. Por esse motivo, ela não seguirá neste processo seletivo.\n\nAgradecemos seu interesse. Você poderá se candidatar novamente em futuras oportunidades, concluindo todas as etapas solicitadas. Acompanhe as próximas vagas no Instagram: @bessanisoftwares — https://www.instagram.com/bessanisoftwares/.`;
  if(tipo==='entrevista')return `${abertura}\n\nVocê avançou para a próxima fase do processo seletivo${assunto}! Gostaríamos de combinar uma entrevista remota com uma atividade prática de simulação de atendimento.\n\nEnviaremos previamente um vídeo com o conteúdo e as orientações da atividade. No encontro, você explicará e demonstrará o procedimento como se estivesse atendendo um cliente.\n\nVocê tem interesse e disponibilidade para participar? Podemos combinar o dia e o horário por aqui.`;
  if(tipo==='retorno')return `${abertura}\n\nEstamos entrando em contato para conversar sobre sua participação no processo seletivo${assunto}. Você tem disponibilidade para falar?`;
  return `${abertura}\n\nRecebemos sua candidatura${assunto} e gostaríamos de conversar com você. Podemos falar por aqui?`;
}
export function linkWhatsApp(numero,mensagem){
  const n=numeroWhatsApp(numero);
  return n&&mensagem.trim()?`https://wa.me/${n}?text=${encodeURIComponent(mensagem)}`:null;
}
