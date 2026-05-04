import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const body = await req.json()
    const { candidato_id, score_curriculo, score_audio, score_comportamental } = body

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

    const { data: existente } = await supabaseAdmin
      .from('avaliacoes_ia')
      .select('id')
      .eq('candidato_id', candidato_id)
      .maybeSingle()

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

    return NextResponse.json({ avaliacao: result.data }, { status: 200 })

  } catch (err) {
    console.error('[POST /api/candidatos/score]', err)
    return NextResponse.json({
      error: 'Erro ao salvar score',
      detalhe: err.message
    }, { status: 500 })
  }
}
