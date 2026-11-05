import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite();let checks=0;
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
CREATE TABLE vagas(id uuid PRIMARY KEY,empresa_id uuid,titulo text,status text,peso_perfil_a numeric DEFAULT 1,peso_perfil_b numeric DEFAULT 2,peso_perfil_c numeric DEFAULT 1,peso_perfil_d numeric DEFAULT 2);
CREATE TABLE candidatos(id uuid PRIMARY KEY,empresa_id uuid,vaga_id uuid REFERENCES vagas(id),codigo text,nome text,email text,telefone text,whatsapp text,cidade text,estado text,status text,created_at timestamptz DEFAULT now());
CREATE TABLE arquivos_candidatos(id uuid PRIMARY KEY,candidato_id uuid REFERENCES candidatos(id),empresa_id uuid,tipo text);
CREATE TABLE resultado_comportamental(id uuid PRIMARY KEY,candidato_id uuid,empresa_id uuid,questionario_id uuid,perfil_dominante text,score_comportamental numeric,updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now());
CREATE TABLE avaliacoes_ia(id uuid PRIMARY KEY,candidato_id uuid,empresa_id uuid,vaga_id uuid,score_curriculo numeric,score_audio numeric,ativo boolean,updated_at timestamptz DEFAULT now());`);
const E='10000000-0000-0000-0000-000000000001',V='20000000-0000-0000-0000-000000000001',W='20000000-0000-0000-0000-000000000002',C='30000000-0000-0000-0000-000000000001',D='30000000-0000-0000-0000-000000000002';
await db.query("INSERT INTO vagas(id,empresa_id,titulo,status) VALUES($1,$2,'Legado','ativa'),($3,$2,'Nova','ativa')",[V,E,W]);
await db.query('INSERT INTO candidatos(id,empresa_id,vaga_id) VALUES($1,$2,$3)',[C,E,V]);
await db.exec(fs.readFileSync(new URL('../migrations/03_vagas.sql',import.meta.url),'utf8'));
async function scalar(sql,params=[]){return (await db.query(sql,params)).rows[0].v}
assert.equal(await scalar('SELECT pesos_bloqueados v FROM vagas WHERE id=$1',[V]),true);checks++;
assert.equal(await scalar('SELECT pesos_bloqueados v FROM vagas WHERE id=$1',[W]),false);checks++;
await db.query("UPDATE vagas SET peso_perfil_b=1,peso_perfil_c=2,roteiro_audio='Texto inicial' WHERE id=$1",[W]);checks++;
await db.query('INSERT INTO candidatos(id,empresa_id,vaga_id) VALUES($1,$2,$3)',[D,E,W]);
assert.equal(await scalar('SELECT roteiro_audio_inscricao v FROM candidatos WHERE id=$1',[D]),'Texto inicial');checks++;
assert.equal(await scalar('SELECT pesos_bloqueados v FROM vagas WHERE id=$1',[W]),true);checks++;
await assert.rejects(db.query('UPDATE vagas SET peso_perfil_a=2 WHERE id=$1',[W]),/Pesos bloqueados/);checks++;
await assert.rejects(db.query('UPDATE vagas SET pesos_bloqueados=false WHERE id=$1',[W]),/bloqueados/);checks++;
await db.query("UPDATE vagas SET roteiro_audio='Texto novo',titulo='Renomeada' WHERE id=$1",[W]);
await db.query("INSERT INTO arquivos_candidatos(id,candidato_id,empresa_id,tipo) VALUES('40000000-0000-0000-0000-000000000001',$1,$2,'audio')",[D,E]);
assert.equal(await scalar("SELECT roteiro_audio v FROM arquivos_candidatos WHERE candidato_id=$1",[D]),'Texto inicial');checks++;
await db.query("UPDATE vagas SET status='encerrada' WHERE id=$1",[V]);
await assert.rejects(db.query("INSERT INTO candidatos(id,empresa_id,vaga_id) VALUES('30000000-0000-0000-0000-000000000003',$1,$2)",[E,V]),/Vaga indisponível/);checks++;
await assert.rejects(db.query("INSERT INTO candidatos(id,empresa_id,vaga_id) VALUES('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002',$1)",[W]),/Vaga indisponível/);checks++;
await db.query(`INSERT INTO avaliacoes_ia(id,candidato_id,empresa_id,vaga_id,score_curriculo,score_audio,ativo) VALUES ('50000000-0000-0000-0000-000000000001',$1,$2,$3,100,100,false),('50000000-0000-0000-0000-000000000002',$1,$2,$3,60,80,true)`,[D,E,W]);
await db.query(`INSERT INTO resultado_comportamental(id,candidato_id,empresa_id,questionario_id,score_comportamental,updated_at) VALUES ('60000000-0000-0000-0000-000000000001',$1,$2,'70000000-0000-0000-0000-000000000001',100,'2026-01-01'),('60000000-0000-0000-0000-000000000002',$1,$2,'70000000-0000-0000-0000-000000000002',50,'2026-02-01')`,[D,E]);
assert.equal(await scalar('SELECT count(*)::int v FROM vw_ranking WHERE id=$1',[D]),1);checks++;
assert.equal(Number(await scalar('SELECT score_final v FROM vw_ranking WHERE id=$1',[D])),62);checks++;
assert.equal(await scalar('SELECT questionario_id v FROM vw_ranking WHERE id=$1',[D]),'70000000-0000-0000-0000-000000000002');checks++;
assert.equal(await scalar("SELECT has_table_privilege('anon','vw_ranking','SELECT') v"),false);checks++;
await db.query('DELETE FROM arquivos_candidatos WHERE candidato_id=$1',[D]);await db.query('DELETE FROM candidatos WHERE id=$1',[D]);
await assert.rejects(db.query('UPDATE vagas SET peso_perfil_a=2 WHERE id=$1',[W]),/Pesos bloqueados/);checks++;
await db.exec(fs.readFileSync(new URL('../migrations/03_vagas.sql',import.meta.url),'utf8'));checks++;
// Simular o papel de API sem privilégios de superusuário.
await db.exec(`ALTER ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO service_role;
 GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
 ALTER TABLE vagas ENABLE ROW LEVEL SECURITY;
 ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;
 ALTER TABLE arquivos_candidatos ENABLE ROW LEVEL SECURITY;`);
const functions=['bsn_proteger_pesos_vaga','bsn_inscricao_vaga','bsn_contexto_audio'];
for(const name of functions){
 assert.equal(await scalar("SELECT has_function_privilege('service_role', ('public.'||$1||'()')::regprocedure, 'EXECUTE') v",[name]),true);checks++;
 for(const role of ['anon','authenticated']) {assert.equal(await scalar("SELECT has_function_privilege($1, ('public.'||$2||'()')::regprocedure, 'EXECUTE') v",[role,name]),false);checks++;}
}
await db.exec('SET ROLE service_role');
assert.equal(await scalar('SELECT current_user::text v'),'service_role');checks++;
assert.equal(await scalar("SELECT rolsuper v FROM pg_roles WHERE rolname=current_user"),false);checks++;
const X='20000000-0000-0000-0000-000000000004',Y='30000000-0000-0000-0000-000000000004';
await db.query("INSERT INTO vagas(id,empresa_id,titulo,status,roteiro_audio) VALUES($1,$2,'API teste','ativa','Roteiro API')",[X,E]);
await db.query('UPDATE vagas SET peso_perfil_a=2 WHERE id=$1',[X]);checks++;
await db.query('INSERT INTO candidatos(id,empresa_id,vaga_id) VALUES($1,$2,$3)',[Y,E,X]);
assert.equal(await scalar('SELECT roteiro_audio_inscricao v FROM candidatos WHERE id=$1',[Y]),'Roteiro API');checks++;
assert.equal(await scalar('SELECT pesos_bloqueados v FROM vagas WHERE id=$1',[X]),true);checks++;
await db.query("INSERT INTO arquivos_candidatos(id,candidato_id,empresa_id,tipo) VALUES('40000000-0000-0000-0000-000000000004',$1,$2,'audio')",[Y,E]);
assert.equal(await scalar('SELECT roteiro_audio v FROM arquivos_candidatos WHERE candidato_id=$1',[Y]),'Roteiro API');checks++;
await assert.rejects(db.query('UPDATE vagas SET peso_perfil_b=1 WHERE id=$1',[X]),/Pesos bloqueados/);checks++;
await db.exec('RESET ROLE');
// Experimento separado: revogar EXECUTE não impede automaticamente disparar trigger já criado.
// Não deixar o banco final dessa suíte sem as concessões do pacote corrigido.
for(const name of functions)await db.exec(`REVOKE EXECUTE ON FUNCTION public.${name}() FROM service_role`);
assert.equal(await scalar("SELECT has_function_privilege('service_role','public.bsn_inscricao_vaga()','EXECUTE') v"),false);checks++;
await db.exec('SET ROLE service_role');
await db.query("INSERT INTO candidatos(id,empresa_id,vaga_id) VALUES('30000000-0000-0000-0000-000000000005',$1,$2)",[E,X]);
assert.equal(await scalar("SELECT roteiro_audio_inscricao v FROM candidatos WHERE id='30000000-0000-0000-0000-000000000005'"),'Roteiro API');checks++;
await db.query("INSERT INTO arquivos_candidatos(id,candidato_id,empresa_id,tipo) VALUES('40000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000005',$1,'audio')",[E]);
assert.equal(await scalar("SELECT roteiro_audio v FROM arquivos_candidatos WHERE id='40000000-0000-0000-0000-000000000005'"),'Roteiro API');checks++;
await db.exec('RESET ROLE');
for(const name of functions)await db.exec(`GRANT EXECUTE ON FUNCTION public.${name}() TO service_role`);
console.log({sqlChecks:checks,result:'passed',engine:'PostgreSQL embedded PGlite; isolated schema, no production'});await db.close();
