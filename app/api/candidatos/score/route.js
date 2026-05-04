import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const body = await req.json()
    const { candidato_id, score_curriculo, score_audio, score_comportamental } = body

    if (!candidato_id) {
      return NextResponse.json({ error: 'candidato_id obrigatório' }, { status: 400 })
    }

    const curriculo = Number(score_curriculo || 0)
    const audio = Number(score_audio || 0)
    const comportamental = Number(score_comportamental || 0)

    const score_final = Math.round(
      (comportamental * 0.4) +
      (curriculo * 0.3) +
      (audio * 0.3)
    )

    const { data, error } = await supabaseAdmin
      .from('avaliacoes_ia')
      .upsert({
        candidato_id,
        score_curriculo: curriculo,
        score_audio: audio,
        score_comportamental: comportamental,
        score_final
      }, { onConflict: 'candidato_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ avaliacao: data }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/candidatos/score]', err)
    return NextResponse.json({
      error: 'Erro ao salvar score',
      detalhe: err.message
    }, { status: 500 })
  }
}
