import {NextResponse} from 'next/server';
import {supabaseAdmin} from '@/lib/supabase';
import {MAX_UPLOAD_BYTES} from '@/lib/uploads.mjs';
import {analisarAudio,contextoAudio,hashAudio,AUDIO_PROMPT_VERSION} from '@/lib/audio-ia.mjs';
import {converterAudio} from '@/lib/audio-converter.mjs';
import {failure} from '@/lib/security';
export async function executarAnaliseAudio(candidatoId,arquivoEsperado=null){
  let analiseId;
  try{
    if(process.env.OPENAI_AUDIO_ENABLED!=='true'||!process.env.OPENAI_API_KEY)return failure('A análise por IA ainda não foi configurada. A avaliação manual continua disponível.',503);
    const empresa=process.env.NEXT_PUBLIC_EMPRESA_ID,modelo=process.env.OPENAI_AUDIO_MODEL||'gpt-audio-1.5';
    const {data:c,error:ce}=await supabaseAdmin.from('candidatos').select('id,vaga_id').eq('id',candidatoId).eq('empresa_id',empresa).single();if(ce)throw ce;
    const {data:vaga,error:ve}=await supabaseAdmin.from('vagas').select('id,titulo,descricao,requisitos_obrigatorios,diferenciais').eq('id',c.vaga_id).eq('empresa_id',empresa).single();if(ve)throw ve;
    if(!vaga.descricao?.trim())return failure('Preencha a descrição da vaga antes de usar a análise por IA.',400);
    const {data:arquivo,error:ae}=await supabaseAdmin.from('arquivos_candidatos').select('id,bucket,caminho_storage,nome_arquivo,mime_type,tamanho_bytes,versao,roteiro_audio').eq('candidato_id',c.id).eq('empresa_id',empresa).eq('tipo','audio').eq('ativo',true).maybeSingle();if(ae)throw ae;
    if(!arquivo)return failure('Este candidato ainda não enviou áudio.',400);
    if(arquivoEsperado && arquivo.id!==arquivoEsperado)return failure('O arquivo ativo mudou. Análise automática cancelada.',409);
    if(arquivo.tamanho_bytes>MAX_UPLOAD_BYTES)return failure('A análise aceita áudio de até 4 MB.',400);
    let contexto;try{contexto=contextoAudio(vaga,arquivo);}catch(e){return failure(e.message,409);}
    const hash=hashAudio(contexto,arquivo,modelo);
    const {data:inicio,error:ie}=await supabaseAdmin.rpc('bsn_iniciar_analise_audio',{p_empresa:empresa,p_candidato:c.id,p_arquivo:arquivo.id,p_contexto:hash,p_vaga:contexto,p_modelo:modelo,p_prompt:AUDIO_PROMPT_VERSION});
    if(ie)return failure('Não foi possível iniciar. Confira se a migração 05 foi instalada.',503);
    if(inicio.erro)return failure(inicio.erro,inicio.status||409);
    if(!inicio.nova)return NextResponse.json({analise:inicio.registro},{headers:{'Cache-Control':'private, no-store'}});
    analiseId=inicio.registro.id;
    const {data:blob,error:be}=await supabaseAdmin.storage.from(arquivo.bucket).download(arquivo.caminho_storage);if(be)throw new Error('Não foi possível ler o áudio salvo.');
    if(!blob||blob.size<=0||blob.size>MAX_UPLOAD_BYTES)throw new Error('Áudio vazio ou maior que 4 MB. Faça a avaliação manual.');
    const preparado=await converterAudio(await blob.arrayBuffer());
    const resultado=await analisarAudio({...preparado,contexto,modelo,key:process.env.OPENAI_API_KEY});
    const texto=[resultado.analise.resumo,...resultado.analise.criterios.map(c=>`${c.grupo}: ${c.justificativa}`),'Roteiro: '+resultado.analise.roteiro.map(p=>`${p.pedido}: ${p.status}`).join('; ')].join('\n');
    const {data:registro,error:re}=await supabaseAdmin.from('analises_audio').update({status:'pronta',resultado:resultado.analise,observacao:texto,modelo:resultado.modelo,request_id:resultado.request_id,uso:resultado.usage}).eq('id',analiseId).eq('empresa_id',empresa).eq('status','processando').select('id,status,resultado,observacao,modelo,created_at').single();if(re)throw new Error('Não foi possível guardar a análise. Nenhuma nota foi alterada.');
    return NextResponse.json({analise:registro},{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){
    if(analiseId)await supabaseAdmin.from('analises_audio').update({status:'erro'}).eq('id',analiseId).eq('empresa_id',process.env.NEXT_PUBLIC_EMPRESA_ID).eq('status','processando');
    return failure(e?.message?.startsWith('A API')||e?.message?.startsWith('A resposta')||e?.message?.startsWith('Análise')||e?.message?.startsWith('Não foi possível')||e?.message?.startsWith('Limite')||e?.message?.startsWith('Áudio')?e.message:'Não foi possível analisar o áudio. Nenhuma nota foi alterada.',502);
  }
}
