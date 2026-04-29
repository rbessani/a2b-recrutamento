import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const EMPRESA_ID     = process.env.NEXT_PUBLIC_EMPRESA_ID
const QUESTIONARIO_ID = process.env.NEXT_PUBLIC_QUESTIONARIO_ID

export async function POST(req) {
  try {
    const body = await req.json()
    const { candidato_id, respostas } = body
    // respostas = { "1": "A", "2": "D", ... } — chave é ordem da pergunta, valor é letra

    if (!candidato_id || !respostas) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // Busca pesos da vaga
    const { data: candidato } = await supabaseAdmin
      .from('candidatos').select('vaga_id').eq('id', candidato_id).single()

    const { data: vaga } = await supabaseAdmin
      .from('vagas')
      .select('peso_perfil_a, peso_perfil_b, peso_perfil_c, peso_perfil_d')
      .eq('id', candidato.vaga_id).single()

    // Conta respostas por letra
    const contagem = { A: 0, B: 0, C: 0, D: 0 }
    Object.values(respostas).forEach(letra => {
      if (contagem[letra] !== undefined) contagem[letra]++
    })

    // Pontuação ponderada
    const pA = contagem.A * (vaga.peso_perfil_a || 1)
    const pB = contagem.B * (vaga.peso_perfil_b || 2)
    const pC = contagem.C * (vaga.peso_perfil_c || 1)
    const pD = contagem.D * (vaga.peso_perfil_d || 2)
    const total = pA + pB + pC + pD
    const nPerguntas = Object.keys(respostas).length
    const maxPeso = Math.max(vaga.peso_perfil_a, vaga.peso_perfil_b, vaga.peso_perfil_c, vaga.peso_perfil_d)
    const scoreComp = nPerguntas > 0 ? Math.round((total / (nPerguntas * maxPeso)) * 100) : 0

    const perfilDominante = Object.entries({ A: pA, B: pB, C: pC, D: pD })
      .sort((a, b) => b[1] - a[1])[0][0]

    // Salva resultado
    await supabaseAdmin
      .from('resultado_comportamental')
      .upsert({
        empresa_id: EMPRESA_ID,
        candidato_id,
        questionario_id: QUESTIONARIO_ID,
        pontuacao_a: pA,
        pontuacao_b: pB,
        pontuacao_c: pC,
        pontuacao_d: pD,
        perfil_dominante: perfilDominante,
        score_comportamental: scoreComp,
        json_resultado: { contagem, pontuacoes: { A: pA, B: pB, C: pC, D: pD } },
      }, { onConflict: 'candidato_id,questionario_id' })

    await supabaseAdmin
      .from('candidatos')
      .update({ status: 'comportamental_respondido' })
      .eq('id', candidato_id)

    await supabaseAdmin.from('logs_processamento').insert({
      empresa_id: EMPRESA_ID,
      candidato_id,
      etapa: 'comportamental',
      status: 'sucesso',
      mensagem: `Perfil: ${perfilDominante} | Score: ${scoreComp}`,
    })

    return NextResponse.json({
      resultado: { perfil_dominante: perfilDominante, score_comportamental: scoreComp, contagem }
    }, { status: 201 })

  } catch (err) {
    console.error('[POST /api/comportamental]', err)
    return NextResponse.json({ error: 'Erro ao salvar comportamental' }, { status: 500 })
  }
}
