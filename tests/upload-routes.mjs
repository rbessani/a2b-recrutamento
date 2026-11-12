import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let checks=0,storageCalls=0,statusCalls=0,removed=0;
let active=[],result=true,closed=false,storageError=null,dbError=null,nota=null;
globalThis.__uploadDb={storage:{from:()=>({upload:async()=>{storageCalls++;return {error:storageError}},remove:async()=>{removed++;return {error:null}}})},from(table){let operation='read',filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},limit(){return q},update(){statusCalls++;return q},insert(){operation='insert';return q},async maybeSingle(){return {data:table==='resultado_comportamental'?(result?{id:'resultado'}:null):table==='avaliacoes_ia'?nota:null,error:null}},async single(){return {data:table==='candidatos'?{id:'candidate',vaga_id:'vaga',lgpd_aceito:true}:table==='vagas'?{status:closed?'encerrada':'ativa'}:{id:'file',versao:1},error:operation==='insert'?dbError:null}},then(resolve,reject){return Promise.resolve({data:table==='arquivos_candidatos'?active:[],error:null}).then(resolve,reject)}};return q}};
let helper=fs.readFileSync(root+'lib/upload-pendente.js','utf8').replace("'@/lib/uploads.mjs'",JSON.stringify(pathToFileURL(root+'lib/uploads.mjs').href)).replace(/import .* from '@\/lib\/security'/,"const checkOrigin=()=>null;const requireCandidate=async()=>null;const failure=(error,status)=>Response.json({error},{status});").replace("import { supabaseAdmin } from '@/lib/supabase'",'const supabaseAdmin=globalThis.__uploadDb').replace("import { NextResponse } from 'next/server'",'const NextResponse=Response');
const helperURL='data:text/javascript;base64,'+Buffer.from(helper).toString('base64');
for(const kind of ['audio','curriculo']){
 const src=fs.readFileSync(root+`app/api/upload/${kind}/route.js`,'utf8').replace("'@/lib/upload-pendente'",JSON.stringify(helperURL));
 const api=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
 const file={size:100,type:kind==='audio'?'audio/webm':'application/pdf',name:kind==='audio'?'gravacao.webm':'cv.pdf',arrayBuffer:async()=>new ArrayBuffer(100)};
 const req=f=>({formData:async()=>new Map([['candidato_id','candidate'],['arquivo',f]])});
 const reset=()=>{active=kind==='curriculo'?[{id:'a',tipo:'audio',ativo:true,status:'enviado',versao:1}]:[];result=true;closed=false;storageError=null;dbError=null;nota=null;};
 reset();let before=storageCalls;assert.equal((await api.POST(req(file))).status,201);assert.equal(storageCalls,before+1);checks++;
 before=storageCalls;assert.equal((await api.POST(req({...file,size:4_000_001}))).status,413);assert.equal(storageCalls,before);checks++;
 storageError=new Error('storage failed');before=statusCalls;assert.equal((await api.POST(req(file))).status,500);assert.equal(statusCalls,before);checks++;
 reset();active.push({id:'old',tipo:kind,versao:1,status:'enviado',ativo:true});before=storageCalls;assert.equal((await api.POST(req(file))).status,409);assert.equal(storageCalls,before);checks++;
 reset();closed=true;assert.equal((await api.POST(req(file))).status,409);checks++;
 reset();result=false;assert.equal((await api.POST(req(file))).status,409);checks++;
 reset();nota={['score_'+kind]:80};assert.equal((await api.POST(req(file))).status,409);checks++;
 reset();dbError={code:'23505'};before=removed;assert.equal((await api.POST(req(file))).status,409);assert.equal(removed,before+1);checks++;
 reset();dbError={message:'ambiguous timeout'};before=removed;assert.equal((await api.POST(req(file))).status,500);assert.equal(removed,before);checks++;
 reset();assert.equal((await api.POST(req({...file,type:'application/x-msdownload',name:'bad.exe'}))).status,400);checks++;
 if(kind==='curriculo'){reset();active=[];assert.equal((await api.POST(req(file))).status,409);checks++;}
}
console.log(`${checks} cenários de upload pendente passaram; sem substituição, sem produção.`);
