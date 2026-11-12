import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { candidateCookie, verifySession } from '@/lib/session.mjs'
import { validId, DEFAULT_SCRIPT } from '@/lib/vagas.mjs'
import { failure } from '@/lib/security'
import { progressoInscricao, contagemPersistida } from '@/lib/retomada.mjs'
export const dynamic = 'force-dynamic'
const ok = value => NextResponse.json(value, {headers:{'Cache-Control':'private, no-store'}})

export async function GET(req) {
  try {
    const params = new URL(req.url).searchParams;
    const vagaId = params.has('vaga') ? params.get('vaga') : process.env.NEXT_PUBLIC_VAGA_ID;
    const candidatoId = params.get('candidato');
    if (!validId(vagaId) || (candidatoId && !validId(candidatoId))) return failure('Link de inscrição inválido.',400);
    if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)return failure('Retomada indisponível. Contate o RH para orientação.',503);
    const autorizados = new Map();
    for (const cookie of req.cookies.getAll().filter(c=>c.name.startsWith('bsn_inscricao_')).slice(0,50)) {
      try {
        if (typeof cookie.value!=='string' || cookie.value.length>2048) continue;
        const body = JSON.parse(Buffer.from(cookie.value.split('.')[0], 'base64url').toString());
        if (validId(body.subject) && cookie.name===candidateCookie(body.subject) && verifySession(cookie.value,'candidate',body.subject)) autorizados.set(body.subject, body.exp);
      } catch { /* Cookie malformado não identifica nem autoriza ninguém. */ }
    }
    if (!autorizados.size) return candidatoId ? failure('Sua sessão expirou ou não está disponível neste navegador. Contate o RH para orientação.',401) : ok({inscricoes:[]});
    if (candidatoId && !autorizados.has(candidatoId)) return failure('Sessão da inscrição inválida ou expirada.',401);
    const empresa = process.env.NEXT_PUBLIC_EMPRESA_ID;
    const {data: candidatos,error} = await supabaseAdmin.from('candidatos')
      .select('id,codigo,nome,email,telefone,whatsapp,cidade,estado,created_at,roteiro_audio_inscricao,lgpd_aceito')
      .eq('empresa_id',empresa).eq('vaga_id',vagaId).in('id',candidatoId?[candidatoId]:[...autorizados.keys()]).order('created_at',{ascending:false});
    if (error) throw error;
    if (!candidatos?.length) return candidatoId ? failure('Inscrição não encontrada neste acesso.',404) : ok({inscricoes:[]});
    const {data:vaga,error:erroVaga} = await supabaseAdmin.from('vagas').select('id,titulo,descricao,status').eq('id',vagaId).eq('empresa_id',empresa).maybeSingle();
    if (erroVaga) throw erroVaga;
    if (!vaga) return failure('Vaga não encontrada.',404);
    if (!candidatoId) return ok({vaga,inscricoes:candidatos.map(c=>({id:c.id,codigo:c.codigo,nome:c.nome,expira_em:new Date(autorizados.get(c.id)*1000).toISOString()}))});
    const c = candidatos[0];
    const [{data:resultado,error:erroResultado},{data:arquivos,error:erroArquivos}] = await Promise.all([
      supabaseAdmin.from('resultado_comportamental').select('id,json_resultado').eq('candidato_id',c.id).eq('empresa_id',empresa).eq('questionario_id',process.env.NEXT_PUBLIC_QUESTIONARIO_ID).maybeSingle(),
      supabaseAdmin.from('arquivos_candidatos').select('id,tipo,ativo,status,nome_arquivo,versao').eq('candidato_id',c.id).eq('empresa_id',empresa).eq('ativo',true),
    ]);
    if (erroResultado || erroArquivos) throw erroResultado || erroArquivos;
    const progresso = progressoInscricao(resultado,arquivos);
    return ok({vaga,inscricao:{id:c.id,codigo:c.codigo,nome:c.nome,expira_em:new Date(autorizados.get(c.id)*1000).toISOString()},
      data:{candidato_id:c.id,codigo:c.codigo,cand:{nome:c.nome,email:c.email,tel:c.telefone||c.whatsapp||'',cidade:c.cidade,uf:c.estado},roteiro_audio:c.roteiro_audio_inscricao||DEFAULT_SCRIPT,contagem:contagemPersistida(resultado)},
      progresso,pode_continuar:c.lgpd_aceito===true && vaga.status!=='encerrada',
      motivo:c.lgpd_aceito!==true?'Consentimento não registrado. Contate o RH.':vaga.status==='encerrada'?'Esta vaga foi encerrada. Sua inscrição permanece registrada.':null,
      arquivos:(arquivos||[]).map(a=>({tipo:a.tipo,nome:a.nome_arquivo,versao:a.versao,status:a.status}))});
  } catch {
    return failure('Não foi possível consultar o progresso. Tente novamente sem refazer o cadastro.',500);
  }
}
