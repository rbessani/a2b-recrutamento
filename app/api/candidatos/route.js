import { validId } from '@/lib/vagas.mjs'
import { candidateCookie, cookieOptions, signSession } from '@/lib/session.mjs'
import { checkOrigin, requireAdmin, requireCandidate, failure } from '@/lib/security'
import { supabaseAdmin } from '@/lib/supabase'
import { gerarCodigoBSN } from '@/lib/helpers'
import { NextResponse } from 'next/server'

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID

export const dynamic = 'force-dynamic'

export async function GET(req) {
  try {
    const denied = requireAdmin(req); if (denied) return denied
    const { searchParams } = new URL(req.url)
    const vaga_id = searchParams.has('vaga_id') ? searchParams.get('vaga_id') : process.env.NEXT_PUBLIC_VAGA_ID
    if (!validId(vaga_id)) return failure('Selecione uma vaga válida.', 400)

    let query = supabaseAdmin
      .from('vw_ranking')
      .select('*')
      .eq('empresa_id', EMPRESA_ID)
      .order('posicao_ranking', { ascending: true })

    if (vaga_id) query = query.eq('vaga_id', vaga_id)

    const { data: candidatos, error } = await query
    if (error) throw error

    const ids = (candidatos || []).map(c => c.id || c.candidato_id).filter(Boolean)

    // Data original do cadastro, sem depender dos campos da view.
    let cadastros = []
    if (ids.length > 0) {
      const { data, error: cadastroError } = await supabaseAdmin
        .from('candidatos')
        .select('id, created_at, decisao_selecao')
        .eq('empresa_id', EMPRESA_ID)
        .in('id', ids)
      if (cadastroError) throw cadastroError
      cadastros = data || []
    }
    const decisoes = new Map(cadastros.map(c => [c.id, c.decisao_selecao]))
    const datasCadastro = new Map(cadastros.map(c => [c.id, c.created_at]))

    // A view de ranking pode não expor as pontuações dos perfis.
    let resultados = []
    if (ids.length > 0) {
      let consulta = supabaseAdmin
        .from('resultado_comportamental')
        .select('candidato_id, questionario_id, pontuacao_a, pontuacao_b, pontuacao_c, pontuacao_d, perfil_dominante, json_resultado')
        .eq('empresa_id', EMPRESA_ID)
        .in('candidato_id', ids)
      const { data, error: resultadoError } = await consulta
      if (resultadoError) throw resultadoError
      resultados = data || []
    }
    const questionariosDaView = new Map((candidatos || []).map(c => [c.id || c.candidato_id, c.questionario_id]))
    const resultadosPorCandidato = new Map()
    for (const resultado of resultados) {
      if (resultado.questionario_id !== questionariosDaView.get(resultado.candidato_id)) continue
      resultadosPorCandidato.set(resultado.candidato_id, resultado)
    }

    let arquivos = []
    if (ids.length > 0) {
      const { data: arquivosData, error: arquivosError } = await supabaseAdmin
        .from('arquivos_candidatos')
        .select('id, candidato_id, tipo, bucket, caminho_storage, nome_arquivo, mime_type, tamanho_bytes, versao, ativo, status, roteiro_audio')
        .in('candidato_id', ids)
        .eq('ativo', true)

      if (arquivosError) throw arquivosError
      arquivos = arquivosData || []
    }

    const observacoes = new Map()
    if (ids.length) {
      const { data: avaliacoes, error: avalError } = await supabaseAdmin.from('avaliacoes_ia').select('candidato_id, json_avaliacao').in('candidato_id', ids).eq('empresa_id', EMPRESA_ID).eq('ativo', true)
      if (avalError) throw avalError
      for (const avaliacao of avaliacoes || []) observacoes.set(avaliacao.candidato_id, avaliacao.json_avaliacao?.avaliacao_manual?.observacao || '')
    }
    const urls = new Map()
    for (const arquivo of arquivos) {
      const { data: link, error: linkError } = await supabaseAdmin.storage.from(arquivo.bucket).createSignedUrl(arquivo.caminho_storage, 600)
      if (linkError) throw linkError
      urls.set(arquivo.id, link.signedUrl)
    }
    const candidatosComArquivos = (candidatos || []).map(candidato => {
      const arquivosDoCandidato = arquivos
        .filter(a => a.candidato_id === (candidato.id || candidato.candidato_id))
        .map(a => ({
          ...a,
          url_publica: urls.get(a.id) || null
        }))

      return {
        ...candidato,
        ...(resultadosPorCandidato.get(candidato.id || candidato.candidato_id) || {}),
        decisao_selecao: decisoes.get(candidato.id || candidato.candidato_id) || 'em_analise',
        observacao_avaliacao: observacoes.get(candidato.id || candidato.candidato_id) || '',
        data_cadastro: datasCadastro.get(candidato.id || candidato.candidato_id) || null,
        arquivos: arquivosDoCandidato,
        audio: arquivosDoCandidato.find(a => a.tipo === 'audio') || null,
        curriculo: arquivosDoCandidato.find(a => a.tipo === 'curriculo') || null
      }
    })

    return NextResponse.json({ candidatos: candidatosComArquivos }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    console.error('[GET /api/candidatos]', err)
    return NextResponse.json({ error: 'Erro ao buscar candidatos', detalhe: 'Consulte o administrador do sistema.' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const originError = checkOrigin(req); if (originError) return originError
    const body = await req.json()
    const { vaga_id, nome, email, telefone, whatsapp, cidade, estado, linkedin, lgpd_aceito } = body
    if (lgpd_aceito !== true) return failure("É necessário aceitar os termos de privacidade.", 400)
    const vagaSelecionada = vaga_id || process.env.NEXT_PUBLIC_VAGA_ID
    if (!validId(vagaSelecionada)) return failure('Vaga inválida.', 400)
    const { data: vaga, error: vagaError } = await supabaseAdmin.from("vagas").select("id").eq("id", vagaSelecionada).eq("empresa_id", EMPRESA_ID).eq("status", "ativa").maybeSingle()
    if (vagaError) throw vagaError
    if (!vaga) return failure("Vaga indisponível.", 400)

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
        vaga_id: vagaSelecionada,
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
      .select('id, codigo, nome, email, roteiro_audio_inscricao')
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

    const response = NextResponse.json({ candidato: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    response.cookies.set(candidateCookie(data.id), signSession('candidate', data.id, 24 * 3600), cookieOptions(24 * 3600))
    return response
  } catch (err) {
    console.error('[POST /api/candidatos]', err)
    return NextResponse.json({ error: 'Erro ao registrar candidato', detalhe: 'Consulte o administrador do sistema.' }, { status: 500 })
  }
}
