"use client";
import {useState} from 'react';
import ObservacaoRecrutador from './ObservacaoRecrutador';
import AvaliacaoCurriculoIA from './AvaliacaoCurriculoIA';
import AvaliacaoAudioIA from './AvaliacaoAudioIA';
export default function ObservacoesAvaliacoes({candidatoId,nome,temCurriculo,temAudio,notaCurriculo,notaAudio,observacao,observacaoPendente,bloqueado,onPendente,onSalva,onSalvando,onConfirmada}){
 const [aba,setAba]=useState('obs'),[visitadas,setVisitadas]=useState({obs:true});
 const tabs=[['obs','Minhas observações'],['curriculo',`Currículo · ${notaCurriculo===''?'—':notaCurriculo}/100`],['audio',`Áudio · ${notaAudio===''?'—':notaAudio}/100`]];
 const props={candidatoId,nome,observacao,observacaoPendente,bloqueado,onSalvando,onConfirmada};
 function abrir(id){setAba(id);setVisitadas(v=>({...v,[id]:true}));}
 return <section style={{border:'1px solid #D0E8F7',borderRadius:10,padding:12,minWidth:0}}><h4 style={{margin:'0 0 8px',fontSize:15,color:'#003E8A'}}>Observações e avaliações</h4>
 <div role="tablist" aria-label="Observações e avaliações" style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>{tabs.map(([id,t],i)=><button key={id} id={`tab-${candidatoId}-${id}`} role="tab" type="button" aria-selected={aba===id} aria-controls={`painel-${candidatoId}-${id}`} tabIndex={aba===id?0:-1} onClick={()=>abrir(id)} onKeyDown={e=>{let n;if(e.key==='ArrowRight')n=(i+1)%3;if(e.key==='ArrowLeft')n=(i+2)%3;if(e.key==='Home')n=0;if(e.key==='End')n=2;if(n!==undefined){e.preventDefault();abrir(tabs[n][0]);document.getElementById(`tab-${candidatoId}-${tabs[n][0]}`)?.focus();}}} style={{flex:'1 1 140px',minHeight:36,border:'1px solid #CBE1F4',borderRadius:7,padding:'7px 10px',fontFamily:'inherit',fontWeight:700,cursor:'pointer',background:aba===id?'#044d9f':'#F8FAFC',color:aba===id?'#fff':'#044d9f'}}>{t}{id==='obs'&&observacaoPendente?' •':''}</button>)}</div>
 <div role="tabpanel" id={`painel-${candidatoId}-obs`} aria-labelledby={`tab-${candidatoId}-obs`} hidden={aba!=='obs'}><ObservacaoRecrutador candidatoId={candidatoId} observacao={observacao} bloqueado={bloqueado} onPendente={onPendente} onSalva={onSalva}/></div>
 <div role="tabpanel" id={`painel-${candidatoId}-curriculo`} aria-labelledby={`tab-${candidatoId}-curriculo`} hidden={aba!=='curriculo'}><p style={{fontSize:12,color:'#475569',margin:0}}>Peso no resultado geral: <strong>30%</strong>.</p><p style={{fontSize:12,color:'#044d9f',lineHeight:1.7}}>Critérios da nota do currículo: <strong>Experiência 30% · Conhecimento 30% · Experiências correlatas 30% · Competências comportamentais 10%</strong>.</p>{visitadas.curriculo&&<AvaliacaoCurriculoIA {...props} temCurriculo={temCurriculo}/>}</div>
 <div role="tabpanel" id={`painel-${candidatoId}-audio`} aria-labelledby={`tab-${candidatoId}-audio`} hidden={aba!=='audio'}><p style={{fontSize:12,color:'#475569',margin:0}}>Peso no resultado geral: <strong>30%</strong>. Dez critérios existentes, incluindo cumprimento da instrução recebida.</p>{visitadas.audio&&<AvaliacaoAudioIA {...props} temAudio={temAudio}/>}</div>
 </section>;
}
