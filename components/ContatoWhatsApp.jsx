"use client";
import {useRef,useState} from 'react';
import {numeroWhatsApp,mensagemWhatsApp,linkWhatsApp} from '@/lib/whatsapp.mjs';
const campo={width:'100%',boxSizing:'border-box',padding:10,border:'1px solid #cbd5e1',borderRadius:8,font:'inherit'};
export default function ContatoWhatsApp({nome,whatsapp,telefone,vaga}){
  const dialog=useRef(null);
  // WhatsApp explícito prevalece; não troca silenciosamente um número inválido pelo telefone.
  const original=String(whatsapp||telefone||'').trim();
  const numero=numeroWhatsApp(original);
  const [tipo,setTipo]=useState('contato');
  const [mensagem,setMensagem]=useState('');
  const [copiado,setCopiado]=useState('');
  const href=linkWhatsApp(numero||'',mensagem);
  function abrir(){setTipo('contato');setMensagem(mensagemWhatsApp({nome,vaga}));setCopiado('');dialog.current.showModal();}
  return <>
    <button type="button" disabled={!numero} onClick={abrir} title={numero?'Preparar contato com '+nome:original?'Confira o telefone cadastrado: formato brasileiro inválido.':'Candidato sem telefone cadastrado.'} style={{background:numero?'#15803d':'#e2e8f0',color:numero?'white':'#475569',border:0,borderRadius:8,padding:'9px 14px',fontWeight:800,cursor:numero?'pointer':'default'}}>WhatsApp</button>
    {!numero&&<small style={{color:'#64748b'}}>{original?'Telefone precisa de conferência':'Sem telefone cadastrado'}</small>}
    <dialog ref={dialog} aria-label={'Contato com '+nome} style={{width:'min(520px, calc(100% - 32px))',maxHeight:'85vh',overflowY:'auto',boxSizing:'border-box',border:'1px solid #cbd5e1',borderRadius:14,padding:22,color:'#003e8a'}}>
      <h2 style={{marginTop:0,fontSize:21}}>Contato pelo WhatsApp</h2>
      <p style={{overflowWrap:'anywhere'}}><strong>{nome}</strong><br/>{original}</p>
      <label>Mensagem pronta<select autoFocus value={tipo} onChange={e=>{setTipo(e.target.value);setMensagem(mensagemWhatsApp({nome,vaga,tipo:e.target.value}));setCopiado('');}} style={{...campo,margin:'6px 0 16px'}}><option value="contato">Primeiro contato</option><option value="entrevista">Convidar para entrevista</option><option value="retorno">Conversar sobre o processo</option></select></label>
      <label>Revise a mensagem<textarea value={mensagem} onChange={e=>{setMensagem(e.target.value);setCopiado('');}} maxLength={2000} rows={7} style={{...campo,marginTop:6,resize:'vertical'}}/></label>
      <p style={{fontSize:12,color:'#475569'}}>O WhatsApp abrirá com o texto preenchido. Você decide quando enviar. Abrir a conversa não registra contato realizado nem altera notas ou a decisão de seleção.</p>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        {href?<a href={href} target="_blank" rel="noopener noreferrer" style={{background:'#15803d',color:'white',padding:'11px 15px',borderRadius:8,textDecoration:'none',fontWeight:800}}>Abrir WhatsApp</a>:<span>Digite uma mensagem para continuar.</span>}
        <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(mensagem);setCopiado('Mensagem copiada.');}catch{setCopiado('Não foi possível copiar. Selecione o texto acima e copie.');}}} style={{padding:10}}>Copiar mensagem</button>
        <button type="button" onClick={()=>dialog.current.close()} style={{padding:10}}>Fechar</button>
      </div><p role="status" style={{fontSize:12}}>{copiado}</p>
    </dialog>
  </>;
}
