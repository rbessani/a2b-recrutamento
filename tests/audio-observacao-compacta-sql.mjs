// Banco PostgreSQL local isolado, nunca usa credenciais de produção.
import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_TEST_MODULE||'@electric-sql/pglite');
const db=new PGlite();let checks=0;
const E='10000000-0000-4000-8000-000000000001',V='20000000-0000-4000-8000-000000000001',C='30000000-0000-4000-8000-000000000001',F='40000000-0000-4000-8000-000000000001';
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
CREATE TABLE empresas(id uuid PRIMARY KEY);
CREATE TABLE vagas(id uuid PRIMARY KEY,empresa_id uuid,titulo text,descricao text,requisitos_obrigatorios text,diferenciais text);
CREATE TABLE candidatos(id uuid PRIMARY KEY,empresa_id uuid REFERENCES empresas(id),vaga_id uuid REFERENCES vagas(id),decisao_selecao text DEFAULT 'em_analise');
CREATE TABLE arquivos_candidatos(id uuid PRIMARY KEY,candidato_id uuid REFERENCES candidatos(id),empresa_id uuid,tipo text,ativo boolean DEFAULT true,roteiro_audio text);
CREATE TABLE avaliacoes_ia(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidato_id uuid REFERENCES candidatos(id),empresa_id uuid,vaga_id uuid,ativo boolean DEFAULT true,versao_avaliacao int NOT NULL DEFAULT 1,score_curriculo numeric,score_audio numeric,score_comportamental numeric,score_final numeric,json_avaliacao jsonb,updated_at timestamptz DEFAULT now(),UNIQUE(candidato_id,versao_avaliacao));
CREATE UNIQUE INDEX uq_avaliacoes_ia_candidato_ativa ON avaliacoes_ia(candidato_id) WHERE ativo=true;
CREATE TABLE resultado_comportamental(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),candidato_id uuid,empresa_id uuid,score_comportamental numeric,updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now());
CREATE TABLE logs_processamento(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid,candidato_id uuid,etapa text,status text,mensagem text,detalhes jsonb,created_at timestamptz DEFAULT now());
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;`);
await db.exec(readFileSync(new URL('../migrations/05_analise_audio_ia.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../migrations/05_analise_audio_ia.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../migrations/06_audio_observacao_compacta.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../migrations/06_audio_observacao_compacta.sql',import.meta.url),'utf8'));
await db.query('INSERT INTO empresas VALUES($1)',[E]);await db.query("INSERT INTO vagas(id,empresa_id,titulo,descricao) VALUES($1,$2,'Suporte','Atender ERP')",[V,E]);await db.query('INSERT INTO candidatos(id,empresa_id,vaga_id) VALUES($1,$2,$3)',[C,E,V]);await db.query("INSERT INTO arquivos_candidatos(id,candidato_id,empresa_id,tipo,roteiro_audio) VALUES($1,$2,$3,'audio','Oriente e pergunte')",[F,C,E]);
const snap={id:V,titulo:'Suporte',descricao:'Atender ERP',roteiro_audio:'Oriente e pergunte'};
async function scalar(sql,p=[]){return (await db.query(sql,p)).rows[0].v;}
const claim=(hash='a'.repeat(64))=>scalar('SELECT bsn_iniciar_analise_audio($1,$2,$3,$4,$5,$6,$7) v',[E,C,F,hash,snap,'fake','bsn-audio-v1']);
const criterios={diccao:100,velocidade:100,entonacao:100,seguranca:100,naturalidade:100,clareza:100,postura:100,energia:100,conducao:100,script:30};
const confirm=(id,base='Nota anterior',values=criterios)=>scalar('SELECT bsn_confirmar_analise_audio($1,$2,$3,$4,$5) v',[E,C,id,base,values]);
for(const role of ['anon','authenticated'])for(const fn of ['bsn_iniciar_analise_audio(uuid,uuid,uuid,text,jsonb,text,text)','bsn_confirmar_analise_audio(uuid,uuid,uuid,text,jsonb)']){assert.equal(await scalar("SELECT has_function_privilege($1,$2,'execute') v",[role,fn]),false);checks++;}
assert.equal(await scalar("SELECT relrowsecurity v FROM pg_class WHERE oid='analises_audio'::regclass"),true);checks++;
await db.exec('SET ROLE service_role');
await db.query("INSERT INTO logs_processamento(empresa_id,candidato_id,etapa,detalhes) VALUES($1,$2,'observacao_recrutador',jsonb_build_object('observacao','Nota anterior'))",[E,C]);
await db.query('INSERT INTO resultado_comportamental(candidato_id,empresa_id,score_comportamental) VALUES($1,$2,70)',[C,E]);
await db.query("INSERT INTO avaliacoes_ia(candidato_id,empresa_id,vaga_id,score_curriculo,score_audio,json_avaliacao) VALUES($1,$2,$3,83,20,jsonb_build_object('curriculo_ia',jsonb_build_object('nota',83),'avaliacao_manual',jsonb_build_object('observacao','legado')))",[C,E,V]);
let q=await claim();let id=q.registro.id;assert.equal((await claim()).status,409);checks++;
await db.query("UPDATE analises_audio SET status='pronta',resultado=jsonb_build_object('avaliavel',true),observacao='Roteiro: faltou pergunta final' WHERE id=$1",[id]);
assert.equal((await claim()).nova,false);checks++;
assert.equal((await confirm(id,'base errada')).status,409);checks++;
assert.equal((await confirm(id,'Nota anterior',{...criterios,script:99})).status,400);checks++;
await db.query("UPDATE arquivos_candidatos SET roteiro_audio='Mudou' WHERE id=$1",[F]);assert.equal((await confirm(id)).status,409);checks++;await db.query("UPDATE arquivos_candidatos SET roteiro_audio='Oriente e pergunte' WHERE id=$1",[F]);
await db.query('UPDATE arquivos_candidatos SET ativo=false WHERE id=$1',[F]);assert.equal((await confirm(id)).status,409);checks++;await db.query('UPDATE arquivos_candidatos SET ativo=true WHERE id=$1',[F]);
// Rollback integral: falha no log não altera score nem status.
await db.exec('RESET ROLE');await db.exec(`CREATE FUNCTION falhar_audio() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.detalhes->>'origem'='audio_ia' THEN RAISE EXCEPTION 'Falha simulada'; END IF; RETURN NEW; END $$;CREATE TRIGGER falha_audio BEFORE INSERT ON logs_processamento FOR EACH ROW EXECUTE FUNCTION falhar_audio();`);await db.exec('SET ROLE service_role');await assert.rejects(confirm(id),/Falha simulada/);assert.equal(Number(await scalar('SELECT score_audio v FROM avaliacoes_ia WHERE candidato_id=$1',[C])),20);checks++;
await db.exec('RESET ROLE');await db.exec('DROP TRIGGER falha_audio ON logs_processamento');await db.exec('SET ROLE service_role');
const saved=await confirm(id);assert.equal(Number(saved.score_audio),97);assert.equal(Number(saved.score_curriculo),83);assert.equal(Number(saved.score_comportamental),70);assert.equal(Number(saved.score_final),82);assert.ok(saved.observacao.startsWith('Nota anterior'));checks+=5;
assert.equal(await scalar("SELECT json_avaliacao->'avaliacao_manual'->>'observacao' v FROM avaliacoes_ia WHERE candidato_id=$1",[C]),'legado');assert.equal(await scalar("SELECT json_avaliacao->'curriculo_ia'->>'nota' v FROM avaliacoes_ia WHERE candidato_id=$1",[C]),'83');checks+=2;
assert.equal(Number(await scalar("SELECT (resultado->>'nota_confirmada')::numeric v FROM analises_audio WHERE id=$1",[id])),97);checks++;assert.equal((await confirm(id)).ja_aplicada,true);assert.equal(Number(await scalar("SELECT count(*) v FROM logs_processamento WHERE detalhes->>'analise_id'=$1",[id])),1);checks+=2;
q=await claim('b'.repeat(64));id=q.registro.id;await db.query("UPDATE analises_audio SET status='pronta',resultado=jsonb_build_object('avaliavel',true),observacao=$2 WHERE id=$1",[id,'x'.repeat(3000)]);const compact=await confirm(id,saved.observacao);assert.equal(compact.ok,true);assert.ok(compact.aviso.includes('resumo'));assert.ok(compact.observacao.startsWith(saved.observacao));assert.ok(compact.observacao.length<=3000);assert.equal(await scalar("SELECT length(observacao) v FROM analises_audio WHERE id=$1",[id]),3000);checks+=5;
q=await claim('c'.repeat(64));id=q.registro.id;await db.query("UPDATE analises_audio SET status='pronta',resultado=jsonb_build_object('avaliavel',true),observacao='Análise completa preservada' WHERE id=$1",[id]);await db.query("INSERT INTO logs_processamento(empresa_id,candidato_id,etapa,detalhes,created_at) VALUES($1,$2,'observacao_recrutador',jsonb_build_object('observacao',$3::text),now()+interval '1 second')",[E,C,'x'.repeat(3000)]);const cheio=await confirm(id,'x'.repeat(3000));assert.equal(cheio.ok,true);assert.equal(cheio.observacao,'x'.repeat(3000));assert.ok(cheio.aviso.includes('sem espaço'));assert.equal(await scalar("SELECT status v FROM analises_audio WHERE id=$1",[id]),'aplicada');checks+=4;
await db.query("UPDATE analises_audio SET status='erro'");await db.query("INSERT INTO analises_audio(empresa_id,candidato_id,arquivo_id,contexto_hash,vaga_snapshot,modelo,versao_prompt,status) SELECT $1,$2,$3,repeat('d',64),'{}','m','v','erro' FROM generate_series(1,30)",[E,C,F]);assert.equal((await claim('e'.repeat(64))).status,429);checks++;
console.log({checks,result:'audio SQL passed',engine:'PGlite isolado'});await db.close();
