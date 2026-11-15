const numero=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function resumoMaterial(arquivo,analises=[],fila=[],manual=null,tipo='curriculo',notaAtual=null){
 if(!arquivo)return {estado:'ausente',sugestao:null,revisada:false};
 const registros=analises.filter(a=>a.arquivo_id===arquivo.id);
 const aplicada=registros.find(a=>a.status==='aplicada');
 const pronta=registros.find(a=>a.status==='pronta');
 const revisao=manual?.revisoes_materiais?.[tipo];
 const legado=manual?.responsavel==='admin'&&manual.atualizado_em&&arquivo.created_at&&new Date(arquivo.created_at)<=new Date(manual.atualizado_em)&&numero(manual['score_'+tipo])===numero(notaAtual)&&(tipo==='audio'?!!manual.criterios_audio:numero(notaAtual)>0);
 const revisada=!!aplicada||revisao?.arquivo_id===arquivo.id||!!legado;
 const tarefa=fila.find(f=>f.arquivo_id===arquivo.id);
 const estado=revisada?'revisada':pronta?'revisao':tarefa?.status==='erro'||registros[0]?.status==='erro'?'erro':tarefa?.status==='processando'||registros[0]?.status==='processando'?'processando':'pendente';
 return {estado,revisada,sugestao:numero((pronta||aplicada)?.nota),mensagem:tarefa?.mensagem||null};
}
export function situacaoRevisao(c){
 const m=c.revisao||{};
 if(c.encerrada_incompleta)return 'Incompleta — prazo encerrado';
 if(!c.audio||!c.curriculo)return 'Candidatura incompleta';
 if(m.audio?.revisada&&m.curriculo?.revisada)return 'Avaliação revisada';
 if([m.audio,m.curriculo].some(x=>x?.estado==='erro'))return 'Falha na análise';
 if([m.audio,m.curriculo].some(x=>x?.estado==='revisao'))return 'Aguardando revisão humana';
 return 'Aguardando análise da IA';
}
export function revisado(c){return !!c.audio&&!!c.curriculo&&!!c.revisao?.audio?.revisada&&!!c.revisao?.curriculo?.revisada&&!c.encerrada_incompleta;}
export function ordenarRevisao(lista,modo){
 const itens=lista.filter(c=>revisado(c)===(modo==='revisados'));
 if(modo==='revisados')return itens.sort((a,b)=>Number(b.score_final||0)-Number(a.score_final||0)||String(a.id||a.candidato_id).localeCompare(String(b.id||b.candidato_id)));
 return itens.sort((a,b)=>{const ac=a.audio&&a.curriculo,bc=b.audio&&b.curriculo;if(!!ac!==!!bc)return ac?-1:1;return new Date(a.concluida_em||a.data_cadastro||0)-new Date(b.concluida_em||b.data_cadastro||0)||String(a.id||a.candidato_id).localeCompare(String(b.id||b.candidato_id));});
}
