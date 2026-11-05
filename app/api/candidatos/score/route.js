import { checkOrigin, requireAdmin, requireCandidate, failure } from '@/lib/security'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const originError = checkOrigin(req); if (originError) return originError
    const adminError = requireAdmin(req); if (adminError) return adminError
    const body = await req.json()
    const { candidato_id, score_curriculo, score_audio, score_comportamental, criterios_audio, observacao } = body
    const candidateError = await requireCandidate(req, candidato_id); if (candidateError) return candidateError

    if (!candidato_id) {
      return NextResponse.json({ error: 'candidato_id obrigatório' }, { status: 400 })
    }

    const { data: candidato, error: candError } = await supabaseAdmin
      .from('candidatos')
      .select('id, empresa_id, vaga_id')
      .eq('id', candidato_id)
      .single()

    if (candError) throw candError

    const curriculo = Number(score_curriculo || 0)
    const audio = Number(score_audio || 0)
    const comportamental = Number(score_comportamental || 0)

    if (![curriculo, audio, comportamental].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) return failure('As notas devem estar entre 0 e 100.', 400)
    if (observacao !== undefined && (typeof observacao !== 'string' || observacao.length > 3000)) return failure('Observação inválida.', 400)
    const regrasAudio = { diccao:[.10,[100,80,60,20]], velocidade:[.08,[100,60]], entonacao:[.10,[100,80,40]], seguranca:[.15,[100,70,30]], naturalidade:[.10,[100,70,30]], clareza:[.15,[100,70,30]], postura:[.10,[100,80,20]], energia:[.07,[100,70,30]], conducao:[.10,[100,70,30]], script:[.05,[100,85,30]] }
    if (criterios_audio !== undefined) {
      if (!criterios_audio || Array.isArray(criterios_audio) || Object.keys(criterios_audio).length !== 10 || !Object.entries(regrasAudio).every(([k, [, options]]) => options.includes(criterios_audio[k]))) return failure('Checklist de áudio incompleto ou inválido.', 400)
      const calculada = Math.round(Object.entries(regrasAudio).reduce((sum, [k, [peso]]) => sum + criterios_audio[k] * peso, 0))
      if (calculada !== audio) return failure('Nota diferente dos critérios de áudio.', 400)
    }
    const score_final = Math.round(
      (comportamental * 0.4) +
      (curriculo * 0.3) +
      (audio * 0.3)
    )

    const payload = {
      empresa_id: candidato.empresa_id,
      vaga_id: candidato.vaga_id,
      candidato_id,
      score_curriculo: curriculo,
      score_audio: audio,
      score_comportamental: comportamental,
      score_final
    }

    const { data: existente, error: existenteError } = await supabaseAdmin
      .from('avaliacoes_ia')
      .select('id, json_avaliacao')
      .eq('candidato_id', candidato_id)
      .eq('ativo', true)
      .maybeSingle()

    if (existenteError) throw existenteError
    const registroManual = {
      ...(existente?.json_avaliacao?.avaliacao_manual || {}),
      observacao: observacao ?? existente?.json_avaliacao?.avaliacao_manual?.observacao ?? '',
      ...(criterios_audio ? { criterios_audio } : {}),
      responsavel: 'admin', atualizado_em: new Date().toISOString(),
      score_curriculo: curriculo, score_audio: audio, score_comportamental: comportamental
    }
    payload.json_avaliacao = { ...(existente?.json_avaliacao || {}), avaliacao_manual: registroManual }
    if (!existente) {
      const { data: anterior, error: versaoError } = await supabaseAdmin.from('avaliacoes_ia').select('versao_avaliacao').eq('candidato_id', candidato_id).order('versao_avaliacao', { ascending: false }).limit(1).maybeSingle()
      if (versaoError) throw versaoError
      payload.versao_avaliacao = (anterior?.versao_avaliacao || 0) + 1
    }
    let result

    if (existente?.id) {
      result = await supabaseAdmin
        .from('avaliacoes_ia')
        .update(payload)
        .eq('id', existente.id)
        .select()
        .single()
    } else {
      result = await supabaseAdmin
        .from('avaliacoes_ia')
        .insert(payload)
        .select()
        .single()
    }

    if (result.error) throw result.error

    const { error: auditError } = await supabaseAdmin.from('logs_processamento').insert({ empresa_id: candidato.empresa_id, candidato_id, etapa: 'avaliacao_manual', status: 'sucesso', mensagem: 'Avaliação salva pelo usuário administrativo compartilhado.', detalhes: { ...registroManual, score_final } })
    if (auditError) throw auditError
    return NextResponse.json({ avaliacao: result.data }, { status: 200 })

  } catch (err) {
    console.error('[POST /api/candidatos/score]', err)
    return NextResponse.json({
      error: 'Erro ao salvar score',
      detalhe: 'Consulte o administrador do sistema.'
    }, { status: 500 })
  }
}
