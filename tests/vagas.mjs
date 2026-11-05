import assert from 'node:assert/strict'
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
import {vacancyPayload,validId,DEFAULT_SCRIPT} from '../lib/vagas.mjs'
const root=new URL('../',import.meta.url).pathname.replace(/\/$/,'')
const E='10000000-0000-0000-0000-000000000001',V='20000000-0000-0000-0000-000000000001',W='20000000-0000-0000-0000-000000000002'
process.env.NEXT_PUBLIC_EMPRESA_ID=E;process.env.NEXT_PUBLIC_VAGA_ID=V
let count=0;const test=fn=>{fn();count++}
const good={titulo:'Pré-vendas',descricao:'Descrição',roteiro_audio:DEFAULT_SCRIPT,status:'ativa',peso_perfil_a:1,peso_perfil_b:2,peso_perfil_c:1,peso_perfil_d:2}
test(()=>assert.equal(vacancyPayload(good).titulo,'Pré-vendas'))
test(()=>assert.throws(()=>vacancyPayload({...good,peso_perfil_a:3})))
test(()=>assert.throws(()=>vacancyPayload({...good,peso_perfil_a:0})))
test(()=>assert.throws(()=>vacancyPayload({...good,roteiro_audio:''})))
test(()=>assert.throws(()=>vacancyPayload({...good,titulo:'   '})))
test(()=>assert.throws(()=>vacancyPayload({...good,status:'aberta'})))
test(()=>assert.throws(()=>vacancyPayload({...good,peso_perfil_a:2},{...good,pesos_bloqueados:true})))
test(()=>assert.equal(vacancyPayload({...good,titulo:'Outro título'},{...good,pesos_bloqueados:true}).titulo,'Outro título'))
test(()=>assert.equal(vacancyPayload({...good,pesos_bloqueados:true}).pesos_bloqueados,undefined))
test(()=>assert.equal(validId(V),true));test(()=>assert.equal(validId(''),false));test(()=>assert.equal(validId('invalid'),false))
let admin=true,origin=true,queries=0,rows=[],written=null
function fakeDb(){return{from(table){queries++;const filters=[];let operation='read',payload;
 const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},insert(v){operation='insert';payload=v;return q},update(v){operation='update';payload=v;return q},async single(){return execute()},async maybeSingle(){return execute()},then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject)}};
 function execute(){if(operation==='insert'){written=payload;return{data:{id:W},error:null}};const selected=rows.filter(r=>filters.every(([k,v])=>r[k]===v));if(operation==='update'){written=payload;return{data:null,error:null}};return{data:selected[0]||null,error:null}};return q}}}
globalThis.__vagasDb=fakeDb()
globalThis.__vagasGate={origin:()=>origin,admin:()=>admin}
const security=`const failure=(error,status)=>Response.json({error},{status});const requireAdmin=()=>globalThis.__vagasGate.admin()?null:failure('Login necessário',401);const checkOrigin=()=>globalThis.__vagasGate.origin()?null:failure('Origem inválida',403);`
async function load(rel){let s=fs.readFileSync(root+'/app/api/'+rel+'/route.js','utf8');s=s.replace(/import \{[^\n]+\} from '@\/lib\/security'/,security).replace("import { NextResponse } from 'next/server'",'const NextResponse=Response').replace("import { supabaseAdmin } from '@/lib/supabase'",'const supabaseAdmin=globalThis.__vagasDb').replaceAll("'@/lib/vagas.mjs'",JSON.stringify(pathToFileURL(root+'/lib/vagas.mjs').href));return import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'))}
const pub=await load('vagas/publica'),manage=await load('vagas'),edit=await load('vagas/[id]')
const req=(body={})=>({url:'https://example.test/api/vagas/publica',json:async()=>body})
rows=[{...good,id:V,empresa_id:E,pesos_bloqueados:false}]
let res=await pub.GET({...req(),url:'https://example.test/api/vagas/publica?vaga='+V});assert.equal(res.status,200);count++
res=await pub.GET({...req(),url:'https://example.test/api/vagas/publica?vaga='});assert.equal(res.status,400);count++
res=await pub.GET({...req(),url:'https://example.test/api/vagas/publica?vaga='+W});assert.equal(res.status,404);count++
rows[0].status='encerrada';res=await pub.GET(req());assert.equal(res.status,404);count++
rows[0].status='ativa';rows[0].empresa_id=W;res=await pub.GET(req());assert.equal(res.status,404);count++
rows[0].empresa_id=E;admin=false;let before=queries;res=await manage.GET(req());assert.equal(res.status,401);assert.equal(queries,before);count++
res=await manage.POST(req(good));assert.equal(res.status,401);assert.equal(queries,before);count++
res=await edit.PATCH(req(good),{params:{id:V}});assert.equal(res.status,401);assert.equal(queries,before);count++
admin=true;origin=false;res=await manage.POST(req(good));assert.equal(res.status,403);count++
origin=true;res=await manage.POST(req({...good,empresa_id:'foreign',peso_comportamental:99}));assert.equal(res.status,201);assert.equal(written.empresa_id,E);assert.equal(written.peso_comportamental,40);assert.equal(written.peso_curriculo,30);assert.equal(written.peso_audio,30);count++
rows[0].pesos_bloqueados=true;res=await edit.PATCH(req({...good,peso_perfil_a:2}),{params:{id:V}});assert.equal(res.status,409);count++
res=await edit.PATCH(req({...good,titulo:'Novo título',roteiro_audio:'Outra instrução'}),{params:{id:V}});assert.equal(res.status,200);assert.equal(written.titulo,'Novo título');count++
res=await manage.POST(req({duplicar_de:V}));assert.equal(res.status,201);assert.equal(written.status,'inativa');assert.equal(written.pesos_bloqueados,undefined);assert.equal(written.id,undefined);count++
rows[0].empresa_id=W;res=await edit.PATCH(req(good),{params:{id:V}});assert.equal(res.status,404);count++
console.log(JSON.stringify({vacancyChecks:count,result:'passed',scope:'domain and APIs with mocks'}))
