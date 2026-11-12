"use client";
import {useEffect,useRef,useState} from 'react';
export default function ObservacaoRecrutador({candidatoId,observacao='',bloqueado=false,onSalva}){
  const [texto,setTexto]=useState(observacao),[salvo,setSalvo]=useState(observacao),[loading,setLoading]=useState(false),[erro,setErro]=useState(''),[mensagem,setMensagem]=useState('');
  const [ampliado,setAmpliado]=useState(false);
  const trava=useRef(false),rascunho=useRef(texto),base=useRef(salvo);
  useEffect(()=>{if(rascunho.current===base.current){setTexto(observacao);rascunho.current=observacao;}setSalvo(observacao);base.current=observacao;},[candidatoId,observacao]);
  async function salvar(){
    if(trava.current||bloqueado)return;
    trava.current=true;setLoading(true);setErro('');setMensagem('');const enviado=texto;
    try{
      const res=await fetch('/api/candidatos/observacao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidato_id:candidatoId,observacao:enviado})});
      const json=await res.json();if(!res.ok)throw new Error(json.error||'Não foi possível salvar a observação.');
      setSalvo(enviado);base.current=enviado;onSalva(enviado);setMensagem('Observação salva.');
    }catch(e){setErro(e.message||'Não foi possível salvar. Seu texto continua neste campo.');}finally{setLoading(false);trava.current=false;}
  }
  return <section style={{border:'1px solid #E2E8F0',borderRadius:10,padding:12,minWidth:0}} aria-labelledby={'titulo-observacao-'+candidatoId}>
    <h4 id={'titulo-observacao-'+candidatoId} style={{margin:'0 0 6px',color:'#003E8A',fontSize:15}}>Observações internas do recrutador</h4>
    <p style={{fontSize:12,color:'#475569',margin:'0 0 8px'}}>Visível apenas para quem administra o recrutamento.</p>
    <button type="button" aria-expanded={ampliado} aria-controls={'observacao-'+candidatoId} onClick={()=>setAmpliado(v=>!v)} style={{float:'right',marginBottom:6,border:0,background:'none',color:'#005DB5',fontSize:12,cursor:'pointer'}}>{ampliado?'Reduzir campo':'Ampliar campo'}</button>
    <textarea rows={ampliado?8:3} aria-label="Observações internas do recrutador" id={'observacao-'+candidatoId} maxLength={3000} value={texto} onChange={e=>{setTexto(e.target.value);rascunho.current=e.target.value;setMensagem('');setErro('');}} placeholder="Registre suas impressões sobre a candidatura e os pontos para a entrevista." style={{boxSizing:'border-box',display:'block',width:'100%',minHeight:72,padding:8,border:'1px solid #CBD5E1',borderRadius:8,resize:'vertical',fontFamily:'inherit',fontSize:13,lineHeight:1.6,color:'#1E293B'}}/>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,margin:'4px 0 8px',fontSize:11,color:'#64748b'}}><span role="status">{texto!==salvo?'Alterações ainda não salvas.':mensagem}</span><span>{texto.length}/3000</span></div>
    <div className="acoes-candidato"><span className="nota-observacao">As observações não alteram as notas nem a decisão de seleção.</span><button type="button" className="acao-arquivo acao-principal" disabled={loading||bloqueado||texto===salvo} onClick={salvar}>{loading?'Salvando…':'Salvar observação'}</button></div>
    {erro&&<p role="alert" style={{fontSize:12,color:'#DC2626',marginBottom:0}}>{erro}</p>}
  </section>;
}
