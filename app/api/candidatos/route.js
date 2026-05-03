import { supabaseAdmin } from '@/lib/supabase'
import { gerarCodigoBSN } from '@/lib/helpers'
import { NextResponse } from 'next/server'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID

function publicUrl(bucket, caminho) {
  if (!bucket || !caminho) return null
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(caminho)
  return data?.publicUrl || null
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

    const { data: candidatos, error } = await query
    if (error) throw error

    const ids = (candidatos || []).map(c => c.id).filter(Boolean)

    let arquivos = []
    if (ids.length > 0) {
      const { data: arquivosData, error: arquivosError } = await supabaseAdmin
        .from('arquivos_candidatos')
        .select('id, candidato_id, tipo, bucket, caminho_storage, nome_arquivo, mime_type, tamanho_bytes, versao, ativo, status')
        .in('candidato_id', ids)
        .eq('ativo', true)

      if (arquivosError) throw arquivosError
      arquivos = arquivosData || []
    }

    const candidatosComArquivos = (candidatos || []).map(candidato => {
      const arquivosDoCandidato = arquivos
        .filter(a => a.candidato_id === candidato.id)
        .map(a => ({
          ...a,
          url_publica: publicUrl(a.bucket, a.caminho_storage)
        }))

      return {
        ...candidato,
        arquivos: arquivosDoCandidato,
        audio: arquivosDoCandidato.find(a => a.tipo === 'audio') || null,
        curriculo: arquivosDoCandidato.find(a => a.tipo === 'curriculo') || null
      }
    })

    return NextResponse.json({ candidatos: candidatosComArquivos })
  } catch (err) {
    console.error('[GET /api/candidatos]', err)
    return NextResponse.json({ error: 'Erro ao buscar candidatos', detalhe: err.message }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { vaga_id, nome, email, telefone, whatsapp, cidade, estado, linkedin } = body

    if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

    let codigo = ''
    for (let i = 0; i < 5; i++) {
      codigo = gerarCodigoBSN()
      const { data: existe } = await supabaseAdmin
        .from('candidatos')
        .select('id')
        .eq('codigo', codigo)
        .maybeSingle()
      if (!existe) break
    }

    const { data, error } = await supabaseAdmin
      .from('candidatos')
      .insert({
        empresa_id: EMPRESA_ID,
        vaga_id: vaga_id || process.env.NEXT_PUBLIC_VAGA_ID,
        codigo,
        nome,
        email,
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
    return NextResponse.json({ error: 'Erro ao registrar candidato', detalhe: err.message }, { status: 500 })
  }
}
