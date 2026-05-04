import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { candidato_id } = await req.json()

    if (!candidato_id) {
      return NextResponse.json({ error: 'candidato_id obrigatório' }, { status: 400 })
    }

    const { data: arquivos, error: arquivosError } = await supabaseAdmin
      .from('arquivos_candidatos')
      .select('id, bucket, caminho_storage')
      .eq('candidato_id', candidato_id)

    if (arquivosError) throw arquivosError

    for (const arquivo of arquivos || []) {
      if (arquivo.bucket && arquivo.caminho_storage) {
        await supabaseAdmin.storage
          .from(arquivo.bucket)
          .remove([arquivo.caminho_storage])
      }
    }

    await supabaseAdmin.from('arquivos_candidatos').delete().eq('candidato_id', candidato_id)
    await supabaseAdmin.from('resultado_comportamental').delete().eq('candidato_id', candidato_id)
    await supabaseAdmin.from('avaliacoes_ia').delete().eq('candidato_id', candidato_id)
    await supabaseAdmin.from('logs_processamento').delete().eq('candidato_id', candidato_id)

    const { error: candidatoError } = await supabaseAdmin
      .from('candidatos')
      .delete()
      .eq('id', candidato_id)

    if (candidatoError) throw candidatoError

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/candidatos/delete]', err)
    return NextResponse.json({
      error: 'Erro ao excluir candidato',
      detalhe: err.message
    }, { status: 500 })
  }
}
