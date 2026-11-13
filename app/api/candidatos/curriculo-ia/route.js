import {NextResponse} from 'next/server';
import {checkOrigin,requireAdmin,requireCandidate,failure} from '@/lib/security';
import {supabaseAdmin} from '@/lib/supabase';
import {validId} from '@/lib/vagas.mjs';
import {MAX_UPLOAD_BYTES} from '@/lib/uploads.mjs';
import {analisarArquivo,contextoVaga,contextoHash,PROMPT_VERSION} from '@/lib/curriculo-ia.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function POST(req){
  let analiseId;
  try{
    const denied=checkOrigin(req)||requireAdmin(req);if(denied)return denied;
    let body;try{body=await req.json();}catch{return failure('Dados inválidos.',400);}
    if(!body||Object.keys(body).some(k=>k!=='candidato_id')||!validId(body.candidato_id))return failure('Inscrição inválida.',400);
    const negado=await requireCandidate(req,body.candidato_id);if(negado)return negado;
    if(process.env.OPENAI_CURRICULO_ENABLED!=='true'||!process.env.OPENAI_API_KEY)return failure('A análise por IA ainda não foi configurada. A avaliação manual continua disponível.',503);
    const empresa=process.env.NEXT_PUBLIC_EMPRESA_ID,modelo=process.env.OPENAI_CURRICULO_MODEL||'gpt-4.1';
    const {data:c,error:ce}=await supabaseAdmin.from('candidatos').select('id,vaga_id').eq('id',body.candidato_id).eq('empresa_id',empresa).single();if(ce)throw ce;
    const {data:vaga,error:ve}=await supabaseAdmin.from('vagas').select('id,titulo,descricao,requisitos_obrigatorios,diferenciais').eq('id',c.vaga_id).eq('empresa_id',empresa).single();if(ve)throw ve;
    if(!vaga.descricao?.trim())return failure('Preencha a descrição da vaga antes de usar a análise por IA.',400);
    const {data:arquivo,error:ae}=await supabaseAdmin.from('arquivos_candidatos').select('id,bucket,caminho_storage,nome_arquivo,mime_type,tamanho_bytes,versao').eq('candidato_id',c.id).eq('empresa_id',empresa).eq('tipo','curriculo').eq('ativo',true).maybeSingle();if(ae)throw ae;
    if(!arquivo)return failure('Este candidato ainda não enviou currículo.',400);
    if(!/\.(pdf|docx)$/i.test(arquivo.nome_arquivo||'')||arquivo.tamanho_bytes>MAX_UPLOAD_BYTES)return failure('A análise aceita PDF ou DOCX de até 4 MB. Use a avaliação manual para este arquivo.',400);
    const hash=contextoHash(vaga,arquivo,modelo);
    const {data:inicio,error:ie}=await supabaseAdmin.rpc('bsn_iniciar_analise_curriculo',{p_empresa:empresa,p_candidato:c.id,p_arquivo:arquivo.id,p_contexto:hash,p_vaga:contextoVaga(vaga),p_modelo:modelo,p_prompt:PROMPT_VERSION});
    if(ie)return failure('Não foi possível iniciar. Confira se a migração 04 foi instalada.',503);
    if(inicio.erro)return failure(inicio.erro,inicio.status||409);
    if(!inicio.nova)return NextResponse.json({analise:inicio.registro},{headers:{'Cache-Control':'private, no-store'}});
    analiseId=inicio.registro.id;
    const {data:blob,error:be}=await supabaseAdmin.storage.from(arquivo.bucket).download(arquivo.caminho_storage);if(be)throw new Error('Não foi possível ler o currículo salvo.');
    if(!blob||blob.size<=0||blob.size>MAX_UPLOAD_BYTES)throw new Error('Currículo vazio ou maior que 4 MB. Faça a avaliação manual.');
    const resultado=await analisarArquivo({arquivo,vaga,bytes:await blob.arrayBuffer(),modelo,key:process.env.OPENAI_API_KEY});
    const {data:registro,error:re}=await supabaseAdmin.from('analises_curriculo').update({status:'pronta',resultado:resultado.analise,observacao:resultado.observacao,modelo:resultado.modelo,request_id:resultado.request_id,uso:resultado.usage}).eq('id',analiseId).eq('empresa_id',empresa).eq('status','processando').select('id,status,resultado,observacao,modelo,created_at').single();if(re)throw new Error('Não foi possível guardar a análise. Nenhuma nota foi alterada.');
    return NextResponse.json({analise:registro},{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){
    if(analiseId)await supabaseAdmin.from('analises_curriculo').update({status:'erro'}).eq('id',analiseId).eq('empresa_id',process.env.NEXT_PUBLIC_EMPRESA_ID).eq('status','processando');
    return failure(e?.message?.startsWith('A API')||e?.message?.startsWith('A resposta')||e?.message?.startsWith('Análise')||e?.message?.startsWith('Não foi possível')||e?.message?.startsWith('Limite')||e?.message?.startsWith('Currículo')?e.message:'Não foi possível analisar o currículo. Nenhuma nota foi alterada.',502);
  }
}
