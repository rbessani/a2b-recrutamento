import {fileURLToPath} from 'node:url';
import fs from 'node:fs'
import assert from 'node:assert/strict'
const root = fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/, '')
process.env.NEXT_PUBLIC_EMPRESA_ID = 'test-company'
process.env.NEXT_PUBLIC_QUESTIONARIO_ID = 'test-questionnaire'
let fault = null
let calls = []
const fakeError = { message: 'Simulated database failure' }
const db = { from(table) {
 const q = {
  select() { return q }, eq() { return q },
  async maybeSingle() { return {data:null,error:null} },
  async single() { return { data: table === 'candidatos' ? { vaga_id: 'test-vaga' } : { peso_perfil_a: 1, peso_perfil_b: 2, peso_perfil_c: 1, peso_perfil_d: 2 }, error: null } },
  async upsert() { calls.push('resultado'); return { error: fault === 'resultado' ? fakeError : null } },
  update() { q.operation = 'status'; return q },
  then(resolve, reject) { calls.push('status'); return Promise.resolve({error: fault === 'status' ? fakeError : null}).then(resolve, reject) },
  async insert() { const acao=table==='resultado_comportamental'?'resultado':'log';calls.push(acao);return {error:fault===acao?fakeError:null} }
 }; return q
}}
globalThis.__behaviorDb = db
const source = fs.readFileSync(root + '/app/api/comportamental/route.js', 'utf8')
 .replace("import { checkOrigin, requireAdmin, requireCandidate, failure } from '@/lib/security'", "const checkOrigin = () => null; const requireCandidate = async () => null; const failure = (error, status) => Response.json({error}, {status});")
 .replace("import { supabaseAdmin } from '@/lib/supabase'", 'const supabaseAdmin = globalThis.__behaviorDb')
 .replace("import { NextResponse } from 'next/server'", 'const NextResponse = Response')
const { POST } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const respostas = Object.fromEntries(Array.from({length:25}, (_, i) => [String(i+1), 'B']))
async function run(body, expected, expectedCalls) {
 calls = []
 const result = await POST({json: async () => body})
 assert.equal(result.status, expected)
 const json = await result.json()
 assert.equal(typeof json, 'object')
 if (expected >= 400) assert.equal(typeof json.error, 'string')
 if (expected === 201) assert.equal(json.resultado.score_comportamental, 100)
 assert.deepEqual(calls, expectedCalls)
}
let count = 0
await run({candidato_id:'test'}, 400, []); count++
await run({candidato_id:'test',respostas:{}}, 400, []); count++
await run({candidato_id:'test',respostas:{...respostas,'25':'INVALID'}}, 400, []); count++
await run({candidato_id:'test',respostas}, 201, ['resultado','status','log']); count++
const savedError = console.error
console.error = () => {}
try {
 for (const [step, expectedCalls] of [['resultado',['resultado']],['status',['resultado','status']],['log',['resultado','status','log']]]) {
  fault = step
  await run({candidato_id:'test',respostas}, 500, expectedCalls); count++
 }
} finally { console.error = savedError }
fault = null
await run({candidato_id:'test',respostas}, 201, ['resultado','status','log']); count++
console.log(JSON.stringify({behavioralScenarios:count,result:'passed',scope:'mocked API; no production calls'}))
