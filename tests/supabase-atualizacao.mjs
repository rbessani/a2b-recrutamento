import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY='placeholder-local-test';
const realFetch=globalThis.fetch;
const chamadas=[];let texto='Descrição antiga';let anterior;
globalThis.fetch=async (url,init)=>{
 chamadas.push({url:String(url),init});
 // Simula uma camada que reaproveita o resultado quando não recebe no-store.
 let descricao=init.cache==='no-store'?texto:(anterior??=texto);
 return new Response(JSON.stringify({id:'vaga-teste',descricao}),{status:200,headers:{'Content-Type':'application/json'}});
};
try{
 let s=fs.readFileSync(new URL('../lib/supabase.js',import.meta.url),'utf8').replace("import 'server-only'",'').replace("'@supabase/supabase-js'",JSON.stringify(pathToFileURL(require.resolve('@supabase/supabase-js')).href));
 const {supabaseAdmin}=await import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
 const primeira=await supabaseAdmin.from('vagas').select('id,descricao').eq('id','vaga-teste').maybeSingle();
 assert.equal(primeira.error,null);assert.equal(primeira.data.descricao,'Descrição antiga');
 texto='Descrição atualizada';
 const segunda=await supabaseAdmin.from('vagas').select('id,descricao').eq('id','vaga-teste').maybeSingle();
 assert.equal(segunda.error,null);assert.equal(segunda.data.descricao,texto);
 assert.equal(chamadas.length,2);
 for(const c of chamadas){assert.equal(c.init.cache,'no-store');const h=new Headers(c.init.headers);assert.equal(h.get('apikey'),'placeholder-local-test');assert.equal(h.get('authorization'),'Bearer placeholder-local-test');assert(c.url.includes('/rest/v1/vagas?'));assert(c.url.includes('id=eq.vaga-teste'));}
 console.log('SDK real: nova consulta lê alteração, usa no-store e preserva autenticação/filtros. Transporte simulado; sem produção.');
}finally{globalThis.fetch=realFetch;}
