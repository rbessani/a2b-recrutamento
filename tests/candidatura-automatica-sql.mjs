import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();let checks=0;
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
CREATE TABLE empresas(id uuid PRIMARY KEY);
CREATE TABLE candidatos(id uuid PRIMARY KEY,empresa_id uuid REFERENCES empresas(id),status text DEFAULT 'novo');
CREATE TABLE arquivos_candidatos(id uuid PRIMARY KEY,candidato_id uuid REFERENCES candidatos(id) ON DELETE CASCADE,empresa_id uuid,tipo text,ativo boolean DEFAULT true);
INSERT INTO empresas VALUES('10000000-0000-4000-8000-000000000001');
INSERT INTO candidatos VALUES('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','antigo');`);
const E='10000000-0000-4000-8000-000000000001';
const c=n=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const f=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scalar=async(s,p=[])=>(await db.query(s,p)).rows[0].v;
for(let n=0;n<2;n++)await db.exec(readFileSync('migrations/08_candidatura_automatica.sql','utf8'));
assert.equal(await scalar('SELECT prazo_conclusao v FROM candidatos LIMIT 1'),null);checks++;
await db.query('INSERT INTO config_candidaturas VALUES($1,true)',[E]);
await db.query('INSERT INTO candidatos(id,empresa_id) VALUES($1,$2)',[c(2),E]);
assert.equal(await scalar("SELECT prazo_conclusao>now()+interval '23 hours' v FROM candidatos WHERE id=$1",[c(2)]),true);checks++;
await db.query("INSERT INTO arquivos_candidatos VALUES($1,$2,$3,'audio',true)",[f(1),c(2),E]);
assert.equal(Number(await scalar('SELECT count(*) v FROM fila_analises')),1);checks++;
const task=await scalar('SELECT bsn_reservar_analise($1) v',[E]);assert.equal(task.arquivo_id,f(1));assert.equal(await scalar('SELECT bsn_reservar_analise($1) v',[E]),null);checks+=2;
// Não reenvia chamadas incertas após queda.
await db.exec("UPDATE fila_analises SET iniciada_em=now()-interval '6 minutes'");
assert.equal(await scalar('SELECT bsn_reservar_analise($1) v',[E]),null);assert.equal(await scalar('SELECT status v FROM fila_analises'),'erro');checks+=2;
await db.query('UPDATE candidatos SET prazo_conclusao=now()-interval \'1 minute\' WHERE id=$1',[c(2)]);
await assert.rejects(()=>db.query("INSERT INTO arquivos_candidatos VALUES($1,$2,$3,'curriculo',true)",[f(2),c(2),E]),/Prazo encerrado/);checks++;
assert.equal(Number(await scalar('SELECT bsn_encerrar_incompletas($1) v',[E])),1);checks++;
assert.equal(await scalar('SELECT status v FROM candidatos WHERE id=$1',[c(2)]),'novo');checks++;
assert.equal(await scalar('SELECT encerrada_incompleta_em IS NOT NULL v FROM candidatos WHERE id=$1',[c(2)]),true);checks++;
assert.equal(Number(await scalar('SELECT bsn_encerrar_incompletas($1) v',[E])),0);checks++;
// Completa antes do prazo continua válida, mesmo após vencimento.
await db.query('INSERT INTO candidatos(id,empresa_id) VALUES($1,$2)',[c(3),E]);
for(const [n,t] of [[3,'audio'],[4,'curriculo']])await db.query('INSERT INTO arquivos_candidatos VALUES($1,$2,$3,$4,true)',[f(n),c(3),E,t]);
await db.query("UPDATE candidatos SET prazo_conclusao=now()-interval '1 minute' WHERE id=$1",[c(3)]);
assert.equal(Number(await scalar('SELECT bsn_encerrar_incompletas($1) v',[E])),0);checks++;
assert.equal(await scalar('SELECT encerrada_incompleta_em v FROM candidatos WHERE id=$1',[c(3)]),null);checks++;
// Legado recebe arquivo sem prazo e sem enfileiramento retroativo.
const before=await scalar('SELECT count(*) v FROM fila_analises');
await db.query("INSERT INTO arquivos_candidatos VALUES($1,$2,$3,'audio',true)",[f(5),c(1),E]);
assert.equal(await scalar('SELECT count(*) v FROM fila_analises'),before);checks++;
for(const role of ['anon','authenticated'])for(const fn of ['bsn_reservar_analise(uuid)','bsn_encerrar_incompletas(uuid)']){assert.equal(await scalar("SELECT has_function_privilege($1,$2,'EXECUTE') v",[role,fn]),false);checks++;}
await db.exec('UPDATE config_candidaturas SET ativa=false');
assert.equal(await scalar('SELECT bsn_reservar_analise($1) v',[E]),null);checks++;
await db.query('DELETE FROM candidatos WHERE id=$1',[c(3)]);
assert.equal(Number(await scalar('SELECT count(*) v FROM fila_analises WHERE candidato_id=$1',[c(3)])),0);checks++;
console.log(`${checks} verificações SQL: prazo, legado preservado, fila, interrupção, conclusão e permissões passaram.`);await db.close();
