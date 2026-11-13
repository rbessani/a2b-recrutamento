// Banco PostgreSQL local isolado, nunca usa credenciais de produção.
import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_TEST_MODULE||'@electric-sql/pglite');
const db=new PGlite();let checks=0;
const E='10000000-0000-4000-8000-000000000001',V='20000000-0000-4000-8000-000000000001',C='30000000-0000-4000-8000-000000000001',F='40000000-0000-4000-8000-000000000001';
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
CREATE TABLE empresas(id uuid PRIMARY KEY);
CREATE TABLE vagas(id uuid PRIMARY KEY,empresa_id uuid,titulo text,descricao text,requisitos_obrigatorios text,diferenciais text);
CREATE TABLE candidatos(id uuid PRIMARY KEY,empresa_id uuid REFERENCES empresas(id),vaga_id uuid REFERENCES vagas(id),decisao_selecao text DEFAULT 'em_analise');
CREATE TABLE arquivos_candidatos(id uuid PRIMARY KEY,candidato_id uuid REFERENCES candidatos(id),empresa_id uuid,tipo text,ativo boolean DEFAULT true);
CREATE TABLE avaliacoes_ia(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidato_id uuid REFERENCES candidatos(id),empresa_id uuid,vaga_id uuid,ativo boolean DEFAULT true,versao_avaliacao int NOT NULL DEFAULT 1,score_curriculo numeric,score_audio numeric,score_comportamental numeric,score_final numeric,json_avaliacao jsonb,updated_at timestamptz DEFAULT now(),UNIQUE(candidato_id,versao_avaliacao));
CREATE UNIQUE INDEX uq_avaliacoes_ia_candidato_ativa ON avaliacoes_ia(candidato_id) WHERE ativo=true;
CREATE TABLE resultado_comportamental(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidato_id uuid,empresa_id uuid,score_comportamental numeric,updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now());
CREATE TABLE logs_processamento(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid,candidato_id uuid,etapa text,status text,mensagem text,detalhes jsonb,created_at timestamptz DEFAULT now());
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;`);
const migration=readFileSync(new URL('../migrations/04_analise_curriculo_ia.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);checks++;
await db.query('INSERT INTO empresas VALUES($1)',[E]);await db.query("INSERT INTO vagas(id,empresa_id,titulo,descricao) VALUES($1,$2,'Suporte','Atender ERP')",[V,E]);await db.query('INSERT INTO candidatos(id,empresa_id,vaga_id) VALUES($1,$2,$3)',[C,E,V]);await db.query("INSERT INTO arquivos_candidatos(id,candidato_id,empresa_id,tipo) VALUES($1,$2,$3,'curriculo')",[F,C,E]);
const snap={id:V,titulo:'Suporte',descricao:'Atender ERP',requisitos_obrigatorios:'',diferenciais:''};
async function scalar(sql,p=[]){return (await db.query(sql,p)).rows[0].v;}
const claim=(hash='a'.repeat(64))=>scalar('SELECT bsn_iniciar_analise_curriculo($1,$2,$3,$4,$5,$6,$7) v',[E,C,F,hash,snap,'modelo-ficticio','bsn-curriculo-v1']);
const confirm=(id,base='Texto do recrutador')=>scalar('SELECT bsn_confirmar_analise_curriculo($1,$2,$3,$4) v',[E,C,id,base]);
const note=(text,base=null)=>scalar('SELECT bsn_salvar_observacao_recrutador($1,$2,$3,$4) v',[E,C,text,base]);
for(const fn of ['bsn_iniciar_analise_curriculo(uuid,uuid,uuid,text,jsonb,text,text)','bsn_confirmar_analise_curriculo(uuid,uuid,uuid,text)','bsn_salvar_observacao_recrutador(uuid,uuid,text,text)']){assert.equal(await scalar("SELECT has_function_privilege('service_role',$1,'execute') v",[fn]),true);checks++;for(const role of ['anon','authenticated']){assert.equal(await scalar("SELECT has_function_privilege($1,$2,'execute') v",[role,fn]),false);checks++;}}
assert.equal(await scalar("SELECT has_table_privilege('anon','analises_curriculo','SELECT') v"),false);checks++;
await db.exec('SET ROLE service_role');assert.equal(await scalar('SELECT rolsuper v FROM pg_roles WHERE rolname=current_user'),false);checks++;
assert.equal((await note('Texto do recrutador')).observacao,'Texto do recrutador');checks++;
assert.equal((await note('Não substituir','base errada')).status,409);checks++;
await db.query('INSERT INTO resultado_comportamental(candidato_id,empresa_id,score_comportamental) VALUES($1,$2,70)',[C,E]);
await db.query("INSERT INTO avaliacoes_ia(candidato_id,empresa_id,vaga_id,score_curriculo,score_audio,json_avaliacao) VALUES($1,$2,$3,60,89,'{\"avaliacao_manual\":{\"criterios_audio\":{\"diccao\":100}}}')",[C,E,V]);
let r=await claim(),id=r.registro.id;assert.equal(r.nova,true);checks++;
assert.equal((await claim()).status,409);checks++;assert.equal((await claim('b'.repeat(64))).status,409);checks++;
await db.query("UPDATE analises_curriculo SET status='pronta',resultado=$2,observacao='Justificativa da IA' WHERE id=$1",[id,{legivel:true,nota:83}]);
assert.equal((await claim()).nova,false);checks++;
assert.equal((await confirm(id,'base errada')).status,409);checks++;assert.equal(Number(await scalar('SELECT score_curriculo v FROM avaliacoes_ia WHERE candidato_id=$1',[C])),60);checks++;
await db.query("UPDATE vagas SET descricao='Mudou' WHERE id=$1",[V]);assert.equal((await confirm(id)).status,409);checks++;await db.query("UPDATE vagas SET descricao='Atender ERP' WHERE id=$1",[V]);
await db.query('UPDATE arquivos_candidatos SET ativo=false WHERE id=$1',[F]);assert.equal((await confirm(id)).status,409);checks++;await db.query('UPDATE arquivos_candidatos SET ativo=true WHERE id=$1',[F]);
let saved=await confirm(id);assert.equal(saved.score_curriculo,83);assert.equal(saved.score_audio,89);assert.equal(saved.score_final,80);assert.equal(saved.observacao,'Texto do recrutador\n\nJustificativa da IA');checks+=4;
assert.equal(await scalar("SELECT json_avaliacao->'avaliacao_manual'->'criterios_audio'->>'diccao' v FROM avaliacoes_ia WHERE candidato_id=$1",[C]),'100');checks++;
assert.equal(await scalar('SELECT decisao_selecao v FROM candidatos WHERE id=$1',[C]),'em_analise');checks++;
assert.equal((await confirm(id)).ja_aplicada,true);checks++;
assert.equal(Number(await scalar("SELECT count(*) v FROM logs_processamento WHERE detalhes->>'analise_id'=$1",[id])),1);checks++;
assert.equal((await note('Rascunho antigo','Texto do recrutador')).status,409);checks++;
// Novo contexto: limites de texto e rollback integral se o log falhar.
r=await claim('c'.repeat(64));id=r.registro.id;await db.query("UPDATE analises_curriculo SET status='pronta',resultado=$2,observacao=$3 WHERE id=$1",[id,{legivel:true,nota:90},'x'.repeat(2999)]);
assert.equal((await confirm(id,saved.observacao)).status,409);checks++;
assert.equal(Number(await scalar('SELECT score_curriculo v FROM avaliacoes_ia WHERE candidato_id=$1',[C])),83);checks++;
await db.query("UPDATE analises_curriculo SET observacao='Nova justificativa' WHERE id=$1",[id]);
await db.exec('RESET ROLE');await db.exec(`CREATE FUNCTION falhar_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.detalhes->>'origem'='curriculo_ia' THEN RAISE EXCEPTION 'Falha simulada'; END IF; RETURN NEW; END $$;CREATE TRIGGER falha BEFORE INSERT ON logs_processamento FOR EACH ROW EXECUTE FUNCTION falhar_log();`);await db.exec('SET ROLE service_role');
await assert.rejects(confirm(id,saved.observacao),/Falha simulada/);checks++;
assert.equal(Number(await scalar('SELECT score_curriculo v FROM avaliacoes_ia WHERE candidato_id=$1',[C])),83);checks++;
assert.equal(await scalar('SELECT status v FROM analises_curriculo WHERE id=$1',[id]),'pronta');checks++;
await db.exec('RESET ROLE');await db.exec('DROP TRIGGER falha ON logs_processamento');await db.exec('SET ROLE service_role');
assert.equal((await scalar('SELECT bsn_confirmar_analise_curriculo($1,$2,$3,$4) v',['10000000-0000-4000-8000-000000000002',C,id,saved.observacao])).status,404);checks++;
// Simular 30 chamadas contadas, sem fazer chamadas reais.
await db.query("UPDATE analises_curriculo SET status='erro'");await db.query("INSERT INTO analises_curriculo(empresa_id,candidato_id,arquivo_id,contexto_hash,vaga_snapshot,modelo,versao_prompt,status) SELECT $1,$2,$3,repeat('d',64),'{}','m','v','erro' FROM generate_series(1,30)",[E,C,F]);
assert.equal((await claim('e'.repeat(64))).status,429);checks++;
await db.exec('RESET ROLE');assert.equal(await scalar("SELECT relrowsecurity v FROM pg_class WHERE oid='analises_curriculo'::regclass"),true);checks++;
console.log({checks,result:'passed',engine:'PGlite/PostgreSQL isolado, com service_role não superusuário'});await db.close();
