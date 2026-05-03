import { supabaseAdmin } from '@/lib/supabase'
import { gerarCodigoBSN } from '@/lib/helpers'
import { NextResponse } from 'next/server'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID

export async function POST(req) {
  try {
    const body = await req.json()
    const { vaga_id, nome, email, telefone, whatsapp, cidade, estado, linkedin } = body

    if (!nome)  return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

    // Gera código único BSN
    let codigo = ''
    for (let i = 0; i < 5; i++) {
      codigo = gerarCodigoBSN()
      const { data: existe } = await supabaseAdmin
        .from('candidatos').select('id').eq('codigo', codigo).maybeSingle()
      if (!existe) break
    }

    const { data, error } = await supabaseAdmin
      .from('candidatos')
      .insert({
        empresa_id: EMPRESA_ID,
        vaga_id: vaga_id || process.env.NEXT_PUBLIC_VAGA_ID,
        codigo,
        nome, email,
        telefone: telefone || null,
        whatsapp: whatsapp || null,
        cidade: cidade || null,
        estado: estado || null,
        linkedin: linkedin || null,
        lgpd_aceito: true,
        lgpd_timestamp: new Date().toISOString(),
        status: 'novo',
      })
      .select('id, codigo, nome, email')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'E-mail já cadastrado nesta vaga.' }, { status: 409 })
      }
      throw error
    }

    await supabaseAdmin.from('logs_processamento').insert({
      empresa_id: EMPRESA_ID,
      candidato_id: data.id,
      etapa: 'inscricao',
      status: 'sucesso',
      mensagem: `Candidato ${data.codigo} inscrito.`,
    })

    return NextResponse.json({ candidato: data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/candidatos]', err)
    return NextResponse.json({ error: 'Erro ao registrar candidato' }, { status: 500 })
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const vaga_id = searchParams.get('vaga_id')

    let query = supabaseAdmin
      .from('vw_ranking')
      .select('*')
      .eq('empresa_id', EMPRESA_ID)
      .order('posicao_ranking', { ascending: true })

    if (vaga_id) query = query.eq('vaga_id', vaga_id)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ candidatos: data })
  } catch (err) {
    console.error('[POST /api/candidatos]', err)
    return NextResponse.json({ 
      error: 'Erro ao registrar candidato',
      detalhe: err.message 
    }, { status: 500 })
  }
}
