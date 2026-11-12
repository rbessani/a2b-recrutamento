import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const E='10000000-0000-4000-8000-000000000001',V='20000000-0000-4000-8000-000000000001';
process.env.NEXT_PUBLIC_EMPRESA_ID=E;
let gravado,payload,step,erro,memoria,loading=[];
const banco={from(table){const q={select(){return q},eq(){return q},insert(body){if(table==='candidatos')gravado=body;return q},async maybeSingle(){return {data:table==='vagas'?{id:V}:null,error:null}},async single(){return {data:{id:'candidate-test',codigo:'TESTE',roteiro_audio_inscricao:'Texto'},error:null}},then(resolve,reject){return Promise.resolve({data:null,error:null}).then(resolve,reject)}};return q}};
class Resposta{static json(body,opt={}){return {body,status:opt.status||200,cookies:{set(){}}}}}
globalThis.__contatoDb=banco;globalThis.__contatoResponse=Resposta;
let route=fs.readFileSync(new URL('app/api/candidatos/route.js',root),'utf8').replace(/^import .*$/gm,'');
route=`const validId=id=>id===${JSON.stringify(V)};const candidateCookie=()=>'',cookieOptions=()=>({}),signSession=()=>'';const checkOrigin=()=>null,requireAdmin=()=>null,requireCandidate=()=>null,failure=(error,status)=>globalThis.__contatoResponse.json({error},{status});const supabaseAdmin=globalThis.__contatoDb,gerarCodigoBSN=()=> 'TESTE',NextResponse=globalThis.__contatoResponse;\n`+route;
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(route).toString('base64'));
const page=fs.readFileSync(new URL('app/page.jsx',root),'utf8');
const inicio=page.indexOf('  async function handleDados(formData){');const fim=page.indexOf('  async function handleComportamental',inicio);assert(inicio>=0&&fim>inicio);
const criar=new Function('travaEnvio','setInscricoes','apiPost','setLoading','setErro','save','setStep','vagaPublica','DEFAULT_SCRIPT',page.slice(inicio,fim)+';return handleDados;');
const handler=criar({current:false},()=>{},async(url,body)=>{assert.equal(url,'/api/candidatos');payload=body;const res=await POST({json:async()=>body});assert.equal(res.status,201);return res.body},v=>loading.push(v),v=>erro=v,v=>memoria=v,v=>step=v,{id:V},'Padrão');
const form={nome:'Pessoa Teste',email:'teste@example.invalid',cidade:'Rio Claro',tel:'(19) 99999-0000',uf:'SP'};await handler(form);
assert.equal(erro,null);assert.equal(gravado.telefone,form.tel);assert.equal(gravado.whatsapp,form.tel);assert.equal(gravado.estado,'SP');assert.equal(gravado.nome,form.nome);assert.equal(gravado.email,form.email);assert.equal(gravado.cidade,form.cidade);assert.equal(gravado.vaga_id,V);assert.equal(gravado.lgpd_aceito,true);assert.equal(payload.tel,undefined);assert.equal(payload.uf,undefined);assert.equal(step,3);assert.deepEqual(loading,[true,false]);assert.deepEqual(memoria.cand,form);
console.log('Cadastro: formulário real → POST real → insert simulado preserva telefone, WhatsApp, estado, vaga e consentimento; sem produção.');
