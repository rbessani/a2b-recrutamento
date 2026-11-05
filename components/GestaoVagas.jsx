'use client'
import { useState } from 'react'
import { DEFAULT_SCRIPT } from '@/lib/vagas.mjs'
const PERFIS=[['a','🦅 Águia'],['b','🐺 Lobo'],['c','🐬 Golfinho'],['d','🦈 Tubarão']]
const novo=()=>({titulo:'',descricao:'',roteiro_audio:DEFAULT_SCRIPT,status:'inativa',peso_perfil_a:1,peso_perfil_b:2,peso_perfil_c:1,peso_perfil_d:2,pesos_bloqueados:false})
export default function GestaoVagas({vagas,onRefresh,onSelect}){
 const [form,setForm]=useState(null),[saving,setSaving]=useState(false),[erro,setErro]=useState(''),[msg,setMsg]=useState('')
 function editar(v){setForm({...v,descricao:v.descricao||''});setErro('');setMsg('')}
 async function request(url,method,body){const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Não foi possível concluir.');return data}
 async function salvar(e){e.preventDefault();if(saving)return;setSaving(true);setErro('');try{const data=await request(form.id?'/api/vagas/'+form.id:'/api/vagas',form.id?'PATCH':'POST',form);await onRefresh();onSelect(form.id||data.vaga.id);setForm(null);setMsg('Vaga salva.');}catch(e){setErro(e.message)}finally{setSaving(false)}}
 async function duplicar(v){if(saving)return;setSaving(true);setErro('');try{const data=await request('/api/vagas','POST',{duplicar_de:v.id});const lista=await onRefresh();onSelect(data.vaga.id);const copy=lista.find(x=>x.id===data.vaga.id);if(copy)editar(copy);setMsg('Cópia criada como pausada, sem candidatos e com pesos liberados.');}catch(e){setErro(e.message)}finally{setSaving(false)}}
 async function copiar(v){setErro('');try{const link=new URL('/',window.location.origin);link.searchParams.set('vaga',v.id);await navigator.clipboard.writeText(link.href);setMsg('Link copiado para '+v.titulo+'.');}catch{setErro('Não foi possível copiar automaticamente. Use o campo de link da vaga.')}}
 return <section className="gestao-vagas">
  <style>{`.gestao-vagas{color:#003E8A}.gestao-vagas label{display:block;font-size:14px;font-weight:600;margin:14px 0}.gestao-vagas input,.gestao-vagas textarea,.gestao-vagas select{font:inherit;box-sizing:border-box;padding:10px;border:1px solid #D0E8F7;border-radius:8px;max-width:100%}.gestao-vagas input,.gestao-vagas textarea{width:100%;margin-top:6px}.gestao-vagas textarea{min-height:110px;resize:vertical}.gestao-vagas button{font:inherit;border:1px solid #D0E8F7;border-radius:8px;padding:9px 13px;background:#E8F4FC;color:#003E8A;cursor:pointer}.gestao-vagas button:disabled{opacity:.5;cursor:wait}.gestao-vagas .primario{background:#005DB5;color:white}.gestao-vagas .cartao{background:white;border:1px solid #D0E8F7;border-radius:14px;padding:22px;margin:14px 0}.gestao-vagas .acoes{display:flex;flex-wrap:wrap;gap:8px}.gestao-vagas .perfis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.gestao-vagas .erro{color:#B91C1C}.gestao-vagas .sucesso{color:#15803D}`}</style>
  <div className="acoes" style={{alignItems:'center',justifyContent:'space-between'}}><h2>Vagas</h2><button className="primario" onClick={()=>{setForm(novo());setErro('');setMsg('')}}>Nova vaga</button></div>
  <p>Um link e um ranking por vaga. As três avaliações permanecem fixas: currículo, teste comportamental e áudio.</p>
  {erro&&<p role="alert" className="erro">{erro}</p>}{msg&&<p role="status" className="sucesso">{msg}</p>}
  {form&&<form className="cartao" onSubmit={salvar}>
   <h3>{form.id?'Editar vaga':'Nova vaga'}</h3>
   <label>Título da vaga<input required maxLength={160} value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}/></label>
   <label>Descrição<textarea maxLength={10000} value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})}/></label>
   <label>Situação <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="inativa">Pausada — não recebe inscrições</option><option value="ativa">Aberta — recebe inscrições</option><option value="encerrada">Encerrada</option></select></label>
   <label>Texto/instrução para o áudio<textarea required maxLength={6000} value={form.roteiro_audio} onChange={e=>setForm({...form,roteiro_audio:e.target.value})}/></label>
   <p style={{fontSize:13}}>O candidato lê esta instrução na gravação. Cada nova inscrição guarda o texto recebido; editar agora não muda a instrução das inscrições que já começaram.</p>
   <h4>Compatibilidade comportamental</h4>{new Set(PERFIS.map(([k])=>Number(form['peso_perfil_'+k]))).size===1&&<p style={{color:"#92400E"}}>Com todos os pesos iguais, não há preferência de perfil: o cálculo atual resulta em 100 no teste completo, independentemente da distribuição de respostas.</p>}<p>Normal (1) ou Maior influência (2). Estes pesos alteram a compatibilidade; a contagem de respostas permanece igual.</p>
   {form.pesos_bloqueados&&<p><strong>Pesos bloqueados após a primeira inscrição.</strong> Para outra regra, duplique esta vaga. O bloqueio continua mesmo se as inscrições forem excluídas.</p>}
   <div className="perfis">{PERFIS.map(([k,label])=><label key={k}>{label}<br/><select aria-label={'Peso '+label} disabled={form.pesos_bloqueados} value={form['peso_perfil_'+k]} onChange={e=>setForm({...form,['peso_perfil_'+k]:Number(e.target.value)})}>{![1,2].includes(Number(form['peso_perfil_'+k]))&&<option value={form['peso_perfil_'+k]}>Peso legado: {form['peso_perfil_'+k]}</option>}<option value={1}>Normal (1)</option><option value={2}>Maior influência (2)</option></select></label>)}</div>
   <p><strong>Nota final fixa:</strong> Comportamental 40% · Currículo 30% · Áudio 30%.</p>
   <div className="acoes"><button className="primario" disabled={saving}>{saving?'Salvando…':'Salvar vaga'}</button><button type="button" disabled={saving} onClick={()=>setForm(null)}>Cancelar</button></div>
  </form>}
  {!vagas.length&&<p>Nenhuma vaga cadastrada. Crie uma vaga para começar.</p>}
  {vagas.map(v=><article className="cartao" key={v.id}>
   <h3>{v.titulo}</h3><p>{v.status==='ativa'?'Aberta':v.status==='encerrada'?'Encerrada':'Pausada'} · {v.pesos_bloqueados?'Pesos bloqueados':'Pesos editáveis'}</p>
   <div className="acoes"><button disabled={saving} onClick={()=>editar(v)}>Editar</button><button disabled={saving} onClick={()=>duplicar(v)}>Duplicar</button><button onClick={()=>onSelect(v.id)}>Selecionar no painel</button><button onClick={()=>copiar(v)}>Copiar link</button></div>
   {v.status!=='ativa'&&<p style={{fontSize:12}}>O link só receberá inscrições quando a vaga estiver aberta.</p>}
   <input aria-label={'Link de '+v.titulo} readOnly onFocus={e=>e.target.select()} value={typeof window==='undefined'?'':window.location.origin+'/?vaga='+v.id}/>
  </article>)}
 </section>
}
