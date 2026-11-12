import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/, '');
process.env.SESSION_SECRET='testing-only-'.repeat(5);process.env.NEXT_PUBLIC_EMPRESA_ID='company-test';process.env.APP_ORIGIN='https://test.invalid';process.env.ADMIN_PASSWORD='test-admin-password-123456';
const sessionUrl=pathToFileURL(root+'/lib/session.mjs').href;
const sess=await import(sessionUrl);
let count=0;function check(fn){fn();count++;}
const tok=sess.signSession('admin','admin',3600,1000000);
check(()=>assert.equal(sess.verifySession(tok,'admin','admin',1001000),true));
check(()=>assert.equal(sess.verifySession(tok+'x','admin','admin',1001000),false));
check(()=>assert.equal(sess.verifySession(tok,'candidate','admin',1001000),false));
check(()=>assert.equal(sess.verifySession(tok,'admin','other',1001000),false));
check(()=>assert.equal(sess.verifySession(tok,'admin','admin',5000000),false));
check(()=>assert.equal(sess.verifySession('bad','admin','admin'),false));
process.env.NEXT_PUBLIC_EMPRESA_ID='other';check(()=>assert.equal(sess.verifySession(tok,'admin','admin',1001000),false));process.env.NEXT_PUBLIC_EMPRESA_ID='company-test';
check(()=>assert.notEqual(sess.candidateCookie('a'),sess.candidateCookie('b')));
check(()=>assert.equal(sess.equalSecret('a','b'),false));
check(()=>assert.equal(sess.equalSecret('a','a'),true));
class Result {constructor(body,opt={}){this.body=body;this.status=opt.status||200;this.headers=opt.headers;this.values={};this.cookies={set:(k,v,o)=>this.values[k]={v,o}}} static json(body,opt){return new Result(body,opt)}}
globalThis.__response=Result;globalThis.__dbCalls=0;globalThis.__dbMatch=true;
globalThis.__db={from(){globalThis.__dbCalls++;const q={select(){return q},eq(){return q},async maybeSingle(){return {data:globalThis.__dbMatch?{id:'candidate-a'}:null,error:null}}};return q}};
function asUrl(s){return 'data:text/javascript;base64,'+Buffer.from(s).toString('base64')}
let guard=fs.readFileSync(root+'/lib/security.js','utf8').replace("import { NextResponse } from 'next/server'","const NextResponse = globalThis.__response").replace("import { supabaseAdmin } from '@/lib/supabase'","const supabaseAdmin = globalThis.__db").replace("'@/lib/session.mjs'",JSON.stringify(sessionUrl));const guardUrl=asUrl(guard);const g=await import(guardUrl);
const req=(token,origin='https://test.invalid')=>({headers:new Headers({origin}),cookies:{get:k=>token?.[k]?{value:token[k]}:undefined},json:async()=>({usuario:'admin',senha:process.env.ADMIN_PASSWORD})});
check(()=>assert.equal(g.checkOrigin(req(null,'https://evil.invalid')).status,403));
check(()=>assert.equal(g.checkOrigin(req(null)),null));
check(()=>assert.equal(g.requireAdmin(req(null)).status,401));
check(()=>assert.equal(g.requireAdmin(req({bsn_admin:sess.signSession('admin','admin',100)})),null));
check(()=>assert.equal(g.requireAdmin(req({bsn_admin:sess.signSession('candidate','admin',100)})).status,401));
assert.equal((await g.requireCandidate(req(null),'candidate-a')).status,401);count++;
const cReq=req({[sess.candidateCookie('candidate-a')]:sess.signSession('candidate','candidate-a',100)});
assert.equal(await g.requireCandidate(cReq,'candidate-a'),null);count++;
assert.equal((await g.requireCandidate(cReq,'candidate-b')).status,401);count++;
globalThis.__dbMatch=false;assert.equal((await g.requireCandidate(cReq,'candidate-a')).status,404);count++;
let login=fs.readFileSync(root+'/app/api/admin/login/route.js','utf8').replace("import { NextResponse } from 'next/server'","const NextResponse = globalThis.__response").replace("'@/lib/security'",JSON.stringify(guardUrl)).replace("'@/lib/session.mjs'",JSON.stringify(sessionUrl));const l=await import(asUrl(login));
const good=await l.POST(req(null));assert.equal(good.status,200);assert.equal(good.values.bsn_admin.o.httpOnly,true);count++;
const wrong=req(null);wrong.json=async()=>({usuario:'admin',senha:'wrong'});assert.equal((await l.POST(wrong)).status,401);count++;
assert.equal((await l.POST(req(null,'https://evil.invalid'))).status,403);count++;
// GET must deny unauthenticated caller before hitting database.
let get=fs.readFileSync(root+'/app/api/candidatos/route.js','utf8').replace("import { NextResponse } from 'next/server'","const NextResponse = globalThis.__response").replace("import { supabaseAdmin } from '@/lib/supabase'","const supabaseAdmin = globalThis.__db").replace("import { gerarCodigoBSN } from '@/lib/helpers'","const gerarCodigoBSN = () => 'BSN-TEST'").replaceAll("'@/lib/security'",JSON.stringify(guardUrl)).replaceAll("'@/lib/session.mjs'",JSON.stringify(sessionUrl));get=get.replaceAll("'@/lib/vagas.mjs'",JSON.stringify(pathToFileURL(root+'/lib/vagas.mjs').href));const route=await import(asUrl(get));const before=globalThis.__dbCalls;assert.equal((await route.GET(req(null))).status,401);assert.equal(globalThis.__dbCalls,before);count++;
for (const rel of ['candidatos/score','candidatos/delete','comportamental','upload/audio','upload/curriculo']) {
 let source=fs.readFileSync(root+'/app/api/'+rel+'/route.js','utf8').replace("import { NextResponse } from 'next/server'","const NextResponse = globalThis.__response").replace("import { supabaseAdmin } from '@/lib/supabase'","const supabaseAdmin = globalThis.__db").replaceAll("'@/lib/security'",JSON.stringify(guardUrl));
 source=source.replaceAll("'@/lib/uploads.mjs'",JSON.stringify(pathToFileURL(root+'/lib/uploads.mjs').href));
 if(rel.startsWith('upload/')){let helper=fs.readFileSync(root+'/lib/upload-pendente.js','utf8').replace("import { NextResponse } from 'next/server'","const NextResponse=globalThis.__response").replace("import { supabaseAdmin } from '@/lib/supabase'","const supabaseAdmin=globalThis.__db").replaceAll("'@/lib/security'",JSON.stringify(guardUrl)).replaceAll("'@/lib/uploads.mjs'",JSON.stringify(pathToFileURL(root+'/lib/uploads.mjs').href));source=source.replaceAll("'@/lib/upload-pendente'",JSON.stringify(asUrl(helper)));}
 const api=await import(asUrl(source));
 const denied=req(null);denied.json=async()=>({candidato_id:'candidate-a',respostas:{}});denied.formData=async()=>new Map([['candidato_id','candidate-a'],['arquivo',{}]]);
 const dbBefore=globalThis.__dbCalls;assert.equal((await api.POST(denied)).status,401);assert.equal(globalThis.__dbCalls,dbBefore);count++;
 assert.equal((await api.POST(req(null,'https://evil.invalid'))).status,403);count++;
}
console.log(JSON.stringify({checks:count,mode:'local mocks; no production calls'}));
