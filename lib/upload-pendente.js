import { randomUUID } from 'node:crypto'
import { uploadError } from '@/lib/uploads.mjs'
import { checkOrigin, requireCandidate, failure } from '@/lib/security'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// Primeira fase: recebe somente arquivos pendentes; nunca substitui um arquivo existente.
export async function enviarPendente(req, tipo) {
  try {
    const denied = checkOrigin(req); if (denied) return denied;
    const form = await req.formData();
    const id = form.get('candidato_id'), arquivo = form.get('arquivo');
    const sessao = await requireCandidate(req,id); if (sessao) return sessao;
    const mensagem = uploadError(arquivo);
    if (mensagem) return failure(mensagem, arquivo?.size>4_000_000?413:400);
    const empresa = process.env.NEXT_PUBLIC_EMPRESA_ID;
    const {data:c,error:ce}=await supabaseAdmin.from('candidatos').select('id,vaga_id,lgpd_aceito').eq('id',id).eq('empresa_id',empresa).single();
    if (ce) throw ce;
    if (!c?.lgpd_aceito) return failure('Consentimento não registrado.',403);
    const {data:v,error:ve}=await supabaseAdmin.from('vagas').select('status').eq('id',c.vaga_id).eq('empresa_id',empresa).single();
    if (ve) throw ve;
    if (v.status==='encerrada') return failure('Esta vaga foi encerrada e não recebe novos arquivos.',409);
    const {data:resultado,error:re}=await supabaseAdmin.from('resultado_comportamental').select('id').eq('candidato_id',id).eq('empresa_id',empresa).eq('questionario_id',process.env.NEXT_PUBLIC_QUESTIONARIO_ID).maybeSingle();
    if (re) throw re;
    if (!resultado) return failure('Conclua o questionário antes de enviar arquivos.',409);
    const {data:ativos,error:ae}=await supabaseAdmin.from('arquivos_candidatos').select('id,tipo,versao,status').eq('candidato_id',id).eq('empresa_id',empresa).eq('ativo',true);
    if (ae) throw ae;
    if (ativos.some(a=>a.tipo===tipo)) return failure('Este arquivo já foi enviado. Use o resumo para continuar; a substituição ainda não está disponível.',409);
    if (tipo==='curriculo' && !ativos.some(a=>a.tipo==='audio' && ['enviado','processando','processado'].includes(a.status))) return failure('Envie o áudio antes do currículo.',409);
    const {data:avaliacao,error:ave}=await supabaseAdmin.from('avaliacoes_ia').select('score_audio,score_curriculo').eq('candidato_id',id).eq('empresa_id',empresa).eq('ativo',true).maybeSingle();
    if (ave) throw ave;
    if (Number(avaliacao?.['score_'+tipo])>0) return failure('Há uma avaliação registrada para este material. Contate o RH para atualizar.',409);
    const {data:anterior,error:antErro}=await supabaseAdmin.from('arquivos_candidatos').select('versao').eq('candidato_id',id).eq('empresa_id',empresa).eq('tipo',tipo).order('versao',{ascending:false}).limit(1).maybeSingle();
    if (antErro) throw antErro;
    const versao=(anterior?.versao||0)+1;
    const mime=String(arquivo.type||'').split(';')[0].toLowerCase();
    let ext;
    if (tipo==='curriculo') {
      ext=String(arquivo.name||'').split('.').pop().toLowerCase();
      if (!['pdf','docx'].includes(ext) || (mime && !['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(mime))) return failure('Envie um currículo em PDF ou DOCX.',400);
    } else {
      const formatos={'audio/mpeg':'mp3','audio/mp3':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/x-m4a':'m4a','audio/mp4':'m4a','audio/ogg':'ogg','application/ogg':'ogg','audio/opus':'opus','audio/webm':'webm','video/webm':'webm'};
      ext=formatos[mime];if(!ext)return failure('Formato de áudio não aceito. Grave novamente ou envie MP3, M4A, OGG, OPUS, WAV ou WEBM.',400);
    }
    const bucket=tipo==='audio'?'audios':'curriculos';
    const caminho=`${id}/${tipo}_v${versao}_${randomUUID()}.${ext}`;
    const {error:erroStorage}=await supabaseAdmin.storage.from(bucket).upload(caminho,Buffer.from(await arquivo.arrayBuffer()),{contentType:({'audio/mp4':'audio/x-m4a','audio/x-wav':'audio/wav','audio/mp3':'audio/mpeg'}[mime]||mime||'application/octet-stream'),upsert:false});
    if (erroStorage) throw erroStorage;
    const {data:registro,error:dbErro}=await supabaseAdmin.from('arquivos_candidatos').insert({empresa_id:empresa,candidato_id:id,tipo,bucket,caminho_storage:caminho,nome_arquivo:arquivo.name,mime_type:mime,tamanho_bytes:arquivo.size,versao,ativo:true,status:'enviado'}).select('id,versao').single();
    if (dbErro) {
      // Não remover objeto após resposta ambígua: o INSERT pode ter confirmado antes de um timeout.
      // Conflito confirmado de unicidade: esse objeto é exclusivo desta tentativa e não foi publicado.
      if (dbErro.code==='23505') {
        try { await supabaseAdmin.storage.from(bucket).remove([caminho]); } catch {}
        return failure('Outro envio já foi registrado. Abra o resumo para conferir e continuar.',409);
      }
      throw dbErro;
    }
    // O progresso é recuperado pelos registros reais mesmo se esta atualização auxiliar falhar.
    const {error:statusErro}=await supabaseAdmin.from('candidatos').update({status:tipo==='audio'?'audio_enviado':'curriculo_enviado'}).eq('id',id).eq('empresa_id',empresa);
    if (statusErro) console.error('[upload] Arquivo gravado; andamento auxiliar pendente.');
    return NextResponse.json({arquivo:registro},{status:201,headers:{'Cache-Control':'no-store'}});
  } catch {
    return failure('Não foi possível confirmar o envio. Use o resumo para conferir o que ficou gravado antes de tentar novamente.',500);
  }
}
