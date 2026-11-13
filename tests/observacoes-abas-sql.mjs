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
for(const m of ['04_analise_curriculo_ia.sql','05_analise_audio_ia.sql','06_audio_observacao_compacta.sql','07_observacoes_abas.sql','07_observacoes_abas.sql'])await db.exec(readFileSync(new URL('../migrations/'+m,import.meta.url),'utf8'));
await db.query('INSERT INTO empresas VALUES($1)',[E]);await db.query("INSERT INTO vagas(id,empresa_id,titulo,descricao) VALUES($1,$2,'Suporte','Atender ERP')",[V,E]);await db.query('INSERT INTO candidatos(id,empresa_id,vaga_id) VALUES($1,$2,$3)',[C,E,V]);
await db.query("INSERT INTO arquivos_candidatos(id,candidato_id,empresa_id,tipo,roteiro_audio) VALUES($1,$2,$3,'audio','Oriente')",[F,C,E]);
async function scalar(sql,p=[]){return (await db.query(sql,p)).rows[0].v;}
for(const role of ['anon','authenticated'])for(const fn of ['bsn_confirmar_analise_audio(uuid,uuid,uuid,text,jsonb)','bsn_confirmar_analise_curriculo(uuid,uuid,uuid,text)','bsn_salvar_observacao_recrutador(uuid,uuid,text,text)']){assert.equal(await scalar("SELECT has_function_privilege($1,$2,'execute') v",[role,fn]),false);checks++;}
await db.exec('SET ROLE service_role');
const note=t=>scalar('SELECT bsn_salvar_observacao_recrutador($1,$2,$3,$4) v',[E,C,t,null]);
assert.equal((await note('x'.repeat(10001))).status,400);checks++;
const texto='Anotações antigas com justificativas de currículo e áudio. '+ 'x'.repeat(9940);assert.ok(texto.length<=10000);assert.equal((await note(texto)).observacao,texto);checks++;
await db.query('INSERT INTO resultado_comportamental(candidato_id,empresa_id,score_comportamental) VALUES($1,$2,70)',[C,E]);
await db.query('INSERT INTO avaliacoes_ia(candidato_id,empresa_id,vaga_id,score_curriculo,score_audio) VALUES($1,$2,$3,80,20)',[C,E,V]);
const snapA={id:V,titulo:'Suporte',descricao:'Atender ERP',roteiro_audio:'Oriente'};
const iniciarA=await scalar('SELECT bsn_iniciar_analise_audio($1,$2,$3,$4,$5,$6,$7) v',[E,C,F,'a'.repeat(64),snapA,'fake','v1']);const a=iniciarA.registro.id;
await db.query("UPDATE analises_audio SET status='pronta',resultado=jsonb_build_object('avaliavel',true),observacao=$2 WHERE id=$1",[a,'Completa '+ 'a'.repeat(4000)]);
const criterios={diccao:100,velocidade:100,entonacao:100,seguranca:100,naturalidade:100,clareza:100,postura:100,energia:100,conducao:100,script:30};
let v=await scalar('SELECT bsn_confirmar_analise_audio($1,$2,$3,$4,$5) v',[E,C,a,texto,criterios]);assert.equal(v.ok,true);assert.equal(v.observacao,texto);assert.equal(Number(v.score_audio),97);assert.equal(Number(v.score_curriculo),80);checks+=4;
const F2='40000000-0000-4000-8000-000000000002';await db.query("INSERT INTO arquivos_candidatos(id,candidato_id,empresa_id,tipo) VALUES($1,$2,$3,'curriculo')",[F2,C,E]);const snapC={id:V,titulo:'Suporte',descricao:'Atender ERP',requisitos_obrigatorios:'',diferenciais:''};
const iniciarC=await scalar('SELECT bsn_iniciar_analise_curriculo($1,$2,$3,$4,$5,$6,$7) v',[E,C,F2,'b'.repeat(64),snapC,'fake','v1']);const cv=iniciarC.registro.id;
await db.query("UPDATE analises_curriculo SET status='pronta',resultado=jsonb_build_object('legivel',true,'nota',85),observacao=$2 WHERE id=$1",[cv,'Completa '+ 'c'.repeat(4000)]);
v=await scalar('SELECT bsn_confirmar_analise_curriculo($1,$2,$3,$4) v',[E,C,cv,texto]);assert.equal(v.ok,true);assert.equal(v.observacao,texto);assert.equal(Number(v.score_audio),97);assert.equal(Number(v.score_curriculo),85);checks+=4;
assert.equal(Number(await scalar("SELECT count(*) v FROM logs_processamento WHERE etapa='observacao_recrutador'",[])),1);checks++;
for(const table of ['analises_curriculo','analises_audio']){assert.equal(await scalar(`SELECT status v FROM ${table} LIMIT 1`),'aplicada');checks++;}
assert.equal((await scalar('SELECT bsn_confirmar_analise_audio($1,$2,$3,$4,$5) v',[E,C,a,texto,criterios])).ja_aplicada,true);checks++;
assert.equal((await scalar('SELECT bsn_confirmar_analise_curriculo($1,$2,$3,$4) v',[E,C,cv,texto])).ja_aplicada,true);checks++;
assert.equal((await scalar('SELECT bsn_salvar_observacao_recrutador($1,$2,$3,$4) v',[E,C,'Novo','Base errada'])).status,409);checks++;
console.log({checks,result:'Abas SQL passed; notas e observações separadas; 10.000 caracteres'});await db.close();
