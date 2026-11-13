"use client";
import useAnaliseSalva from '@/lib/use-analise-salva';
import {useRef,useState} from 'react';
const GRUPOS=[['Experiência na área',30],['Conhecimento na área',30],['Experiências correlatas',30],['Competências comportamentais',10]];
export default function AvaliacaoCurriculoIA({candidatoId,nome,temCurriculo,observacao='',observacaoPendente=false,bloqueado=false,onSalvando,onConfirmada}){
 const [analise,setAnalise]=useState(null),[loading,setLoading]=useState(false),[salvando,setSalvando]=useState(false),[erro,setErro]=useState(''),[revisado,setRevisado]=useState(false),[mensagem,setMensagem]=useState('');
 const trava=useRef(false);
 const salva=useAnaliseSalva(candidatoId,'curriculo',setAnalise);
 async function enviar(url,body){const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let json;try{json=await res.json();}catch{throw new Error('A operação não foi confirmada. Atualize a lista para conferir antes de tentar novamente.');}if(!res.ok)throw new Error(json.error||'Não foi possível concluir.');return json;}
 async function analisar(){if(trava.current||bloqueado||salva.carregando||salva.falha)return;trava.current=true;setLoading(true);setErro('');setMensagem('');setRevisado(false);try{const json=await enviar('/api/candidatos/curriculo-ia',{candidato_id:candidatoId});setAnalise(json.analise);}catch(e){setErro(e.message);}finally{trava.current=false;setLoading(false);}}
 async function confirmar(){if(trava.current||!revisado||observacaoPendente||bloqueado)return;trava.current=true;setSalvando(true);onSalvando?.(candidatoId);setErro('');try{const json=await enviar('/api/candidatos/curriculo-ia/confirmar',{candidato_id:candidatoId,analise_id:analise.id,observacao_base:observacao,confirmado:true});setAnalise(v=>({...v,status:'aplicada'}));setMensagem(json.ja_aplicada?'Esta avaliação já havia sido confirmada.':'Nota e justificativas salvas.');await onConfirmada(json);}catch(e){setErro(e.message);}finally{trava.current=false;setSalvando(false);onSalvando?.(null);}}
 const ultrapassa=false;
 return <div style={{marginTop:8,fontSize:12,color:'#475569'}}>
 {salva.carregando&&<p role="status">Carregando avaliação salva…</p>}{salva.falha&&<p role="alert">Não foi possível carregar a avaliação. <button type="button" onClick={salva.repetir}>Tentar novamente</button></p>}

  <div className="acoes-candidato"><span className="nota-observacao">Sugestão de nota e justificativas com base na vaga.</span><button type="button" className="acao-arquivo" disabled={!temCurriculo||bloqueado||loading||salvando||salva.carregando||salva.falha} onClick={analisar}>{loading?'Analisando currículo…':analise?'Consultar / gerar análise da vaga atual':'Analisar currículo com IA'}</button></div>
  {mensagem&&<p role="status">{mensagem}</p>}{erro&&<p role="alert" style={{color:'#DC2626'}}>{erro}</p>}
 {analise&&<p style={{margin:'8px 0'}}>{analise.status==='aplicada'?'Avaliação confirmada: ':'Prévia para revisão: '}{analise.resultado.resumo}</p>}
  {analise&&<details style={{marginTop:8,border:'1px solid #D0E8F7',borderRadius:8,padding:10,background:'#F8FAFC',maxHeight:360,overflowY:'auto'}}><summary style={{fontWeight:800,color:'#003E8A'}}>Ver avaliação completa de {nome} · {analise.resultado.nota}/100</summary>
   <p>{analise.resultado.resumo}</p><p style={{fontSize:11}}>Registro salvo em {new Date(analise.created_at).toLocaleDateString('pt-BR')} · vaga usada: {analise.vaga_snapshot?.titulo||'registrada na análise'}.</p>
   <p style={{fontSize:11}}>Modelo: {analise.modelo} · Régua 30/30/30/10 · Sugestão sujeita à revisão.</p>
   {analise.resultado.criterios.map((c,i)=><div key={c.grupo} style={{padding:'7px 0',borderTop:'1px solid #E2E8F0'}}><strong>{GRUPOS[i][0]}: {c.pontos}/{GRUPOS[i][1]}</strong><p style={{margin:'4px 0'}}>{c.justificativa}</p><div><strong>Evidência:</strong> {c.evidencia}</div></div>)}
   {analise.resultado.pontos_fortes.length>0&&<><strong>Pontos fortes</strong><ul>{analise.resultado.pontos_fortes.map(t=><li key={t}>{t}</li>)}</ul></>}
   {analise.resultado.pontos_investigar.length>0&&<><strong>Pontos para investigar</strong><ul>{analise.resultado.pontos_investigar.map(t=><li key={t}>{t}</li>)}</ul></>}
   {analise.status==='aplicada'?<p role="status">Esta análise já foi aplicada. Não será acrescentada novamente.</p>:<>
    <p>A confirmação substitui a nota do currículo. As justificativas ficam nesta aba; suas observações são preservadas.</p>
    {observacaoPendente&&<p role="alert">Salve as alterações das observações internas antes de confirmar.</p>}
    {ultrapassa&&<p role="alert">As justificativas ficam nesta aba, separadas de suas observações.</p>}
    <label style={{display:'flex',gap:8,alignItems:'flex-start',margin:'10px 0'}}><input type="checkbox" checked={revisado} disabled={salvando} onChange={e=>setRevisado(e.target.checked)}/><span>Conferi as evidências e concordo com a nota sugerida para este candidato.</span></label>
    <div className="acoes-candidato"><span className="nota-observacao">A nota será aplicada ao ranking após sua confirmação.</span><button type="button" className="acao-arquivo acao-principal" disabled={!revisado||salvando||bloqueado||observacaoPendente||ultrapassa} onClick={confirmar}>{salvando?'Salvando…':'Confirmar nota e justificativas'}</button></div>
   </>}
   <button type="button" disabled={salvando} onClick={e=>{e.currentTarget.closest('details').open=false;setRevisado(false);}} style={{marginLeft:8,padding:8}}>Fechar análise</button>
  </details>}
 </div>;
}
