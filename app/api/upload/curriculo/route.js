import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID

export async function POST(req) {
  try {
    const formData = await req.formData()
    const candidato_id = formData.get('candidato_id')
    const arquivo = formData.get('arquivo')

    if (!candidato_id || !arquivo) {
      return NextResponse.json({ error: 'candidato_id e arquivo obrigatórios' }, { status: 400 })
    }

    const tiposPermitidos = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!tiposPermitidos.includes(arquivo.type)) {
      return NextResponse.json({ error: 'Use PDF ou DOCX.' }, { status: 400 })
    }

    // Busca versão atual
    const { data: atual } = await supabaseAdmin
      .from('arquivos_candidatos')
      .select('versao')
      .eq('candidato_id', candidato_id)
      .eq('tipo', 'curriculo')
      .eq('ativo', true)
      .maybeSingle()

    const novaVersao = atual ? atual.versao + 1 : 1

    // Desativa versão anterior
    if (atual) {
      await supabaseAdmin
        .from('arquivos_candidatos')
        .update({ ativo: false, substituido_at: new Date().toISOString() })
        .eq('candidato_id', candidato_id)
        .eq('tipo', 'curriculo')
        .eq('ativo', true)
    }

    // Upload no Storage
    const ext = arquivo.name.split('.').pop()
    const caminho = `${candidato_id}/curriculo_v${novaVersao}.${ext}`
    const buffer = Buffer.from(await arquivo.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('curriculos')
      .upload(caminho, buffer, { contentType: arquivo.type, upsert: false })

    if (uploadError) throw uploadError

    // Registra no banco
    const { data: registro, error: dbError } = await supabaseAdmin
      .from('arquivos_candidatos')
      .insert({
        empresa_id: EMPRESA_ID,
        candidato_id,
        tipo: 'curriculo',
        bucket: 'curriculos',
        caminho_storage: caminho,
        nome_arquivo: arquivo.name,
        mime_type: arquivo.type,
        tamanho_bytes: arquivo.size,
        versao: novaVersao,
        ativo: true,
        status: 'enviado',
      })
      .select()
      .single()

    if (dbError) throw dbError

    await supabaseAdmin
      .from('candidatos')
      .update({ status: 'curriculo_enviado' })
      .eq('id', candidato_id)

    return NextResponse.json({ arquivo: { id: registro.id, versao: novaVersao } }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/upload/curriculo]', err)
    return NextResponse.json({ error: 'Erro no upload do currículo' }, { status: 500 })
  }
}
