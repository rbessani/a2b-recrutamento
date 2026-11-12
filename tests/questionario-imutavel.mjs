import fs from 'node:fs';
import assert from 'node:assert/strict';
let saved=null,inserts=0,failStatus=false;
process.env.NEXT_PUBLIC_EMPRESA_ID='empresa';process.env.NEXT_PUBLIC_QUESTIONARIO_ID='q';
globalThis.__qdb={from(table){let operation='read';const q={select(){return q},eq(){return q},async maybeSingle(){return {data:saved,error:null}},async single(){return {data:table==='candidatos'?{vaga_id:'v'}:{peso_perfil_a:1,peso_perfil_b:2,peso_perfil_c:1,peso_perfil_d:2,status:'ativa'},error:null}},async insert(payload){if(table==='resultado_comportamental'){inserts++;saved=payload;}return {error:null}},update(){operation='update';return q},then(resolve,reject){return Promise.resolve({error:failStatus&&operation==='update'?{message:'status failure'}:null}).then(resolve,reject)}};return q}};
let s=fs.readFileSync(new URL('../app/api/comportamental/route.js',import.meta.url),'utf8').replace(/import .* from '@\/lib\/security'/,"const checkOrigin=()=>null,requireCandidate=async()=>null,failure=(error,status)=>Response.json({error},{status});").replace("import { supabaseAdmin } from '@/lib/supabase'",'const supabaseAdmin=globalThis.__qdb').replace("import { NextResponse } from 'next/server'",'const NextResponse=Response');
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
const answers=l=>Object.fromEntries(Array.from({length:25},(_,i)=>[i+1,l]));
let res=await POST({json:async()=>({candidato_id:'c',respostas:answers('B')})});assert.equal(res.status,201);assert.equal(saved.json_resultado.contagem.B,25);
res=await POST({json:async()=>({candidato_id:'c',respostas:answers('A')})});assert.equal(res.status,200);assert.equal((await res.json()).resultado.contagem.B,25);assert.equal(inserts,1);
saved=null;failStatus=true;const old=console.error;console.error=()=>{};try{res=await POST({json:async()=>({candidato_id:'c',respostas:answers('D')})});assert.equal(res.status,500);}finally{console.error=old;}
failStatus=false;res=await POST({json:async()=>({candidato_id:'c',respostas:answers('A')})});assert.equal(res.status,200);assert.equal((await res.json()).resultado.contagem.D,25);assert.equal(inserts,2);
console.log('Questionário imutável e recuperação após falha auxiliar passaram.');
