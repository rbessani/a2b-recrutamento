import { checkOrigin, requireAdmin, requireCandidate, failure } from '@/lib/security'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const EMPRESA_ID     = process.env.NEXT_PUBLIC_EMPRESA_ID
const QUESTIONARIO_ID = process.env.NEXT_PUBLIC_QUESTIONARIO_ID

export async function POST(req) {
  try {
    const originError = checkOrigin(req); if (originError) return originError
    const body = await req.json()
    const { candidato_id, respostas } = body
    const candidateError = await requireCandidate(req, candidato_id); if (candidateError) return candidateError
    // respostas = { "1": "A", "2": "D", ... } — chave é ordem da pergunta, valor é letra

    if (!candidato_id || !respostas) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    if (typeof respostas !== 'object' || Array.isArray(respostas) || Object.keys(respostas).length !== 25 || !Array.from({length:25}, (_,i)=>String(i+1)).every(k => Object.hasOwn(respostas,k) && ['A','B','C','D'].includes(respostas[k]))) return failure('Responda às 25 perguntas antes de continuar.', 400)
    // Resultado concluído é imutável: repetir a chamada recupera o já gravado.
    const {data:salvo,error:salvoErro}=await supabaseAdmin.from('resultado_comportamental').select('perfil_dominante,score_comportamental,json_resultado').eq('candidato_id',candidato_id).eq('empresa_id',EMPRESA_ID).eq('questionario_id',QUESTIONARIO_ID).maybeSingle();
    if(salvoErro)throw salvoErro;
    if(salvo)return NextResponse.json({resultado:{perfil_dominante:salvo.perfil_dominante,score_comportamental:salvo.score_comportamental,contagem:salvo.json_resultado?.contagem},ja_concluido:true},{headers:{'Cache-Control':'no-store'}});
    // Busca pesos da vaga
    const { data: candidato, error: candidatoError } = await supabaseAdmin
      .from('candidatos').select('vaga_id').eq('id', candidato_id).eq('empresa_id',EMPRESA_ID).single()

    if (candidatoError || !candidato) throw new Error("Inscrição não encontrada")
    const { data: vaga, error: vagaError } = await supabaseAdmin
      .from('vagas')
      .select('peso_perfil_a, peso_perfil_b, peso_perfil_c, peso_perfil_d,status')
      .eq('id', candidato.vaga_id).eq('empresa_id',EMPRESA_ID).single()

    if (vagaError || !vaga) throw new Error("Vaga não encontrada")
    if(vaga.status==='encerrada')return failure('Esta vaga foi encerrada.',409);
    if (![vaga.peso_perfil_a,vaga.peso_perfil_b,vaga.peso_perfil_c,vaga.peso_perfil_d].every(x=>Number.isFinite(Number(x)) && Number(x)>0)) return failure('Configuração comportamental inválida. Contate a empresa.', 400)
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
    const { error: resultadoError } = await supabaseAdmin
      .from('resultado_comportamental')
      .insert({
        empresa_id: EMPRESA_ID,
        candidato_id,
        questionario_id: QUESTIONARIO_ID,
        pontuacao_a: pA,
        pontuacao_b: pB,
        pontuacao_c: pC,
        pontuacao_d: pD,
        perfil_dominante: perfilDominante,
        score_comportamental: scoreComp,
        json_resultado: { respostas, contagem, pontuacoes: { A: pA, B: pB, C: pC, D: pD } },
      })

    if (resultadoError?.code==='23505') {
      const {data:concorrente,error:concorrenteErro}=await supabaseAdmin.from('resultado_comportamental').select('perfil_dominante,score_comportamental,json_resultado').eq('candidato_id',candidato_id).eq('empresa_id',EMPRESA_ID).eq('questionario_id',QUESTIONARIO_ID).maybeSingle();
      if(concorrenteErro||!concorrente)throw concorrenteErro||resultadoError;
      return NextResponse.json({resultado:{perfil_dominante:concorrente.perfil_dominante,score_comportamental:concorrente.score_comportamental,contagem:concorrente.json_resultado?.contagem},ja_concluido:true},{headers:{'Cache-Control':'no-store'}});
    }
    if (resultadoError) throw resultadoError
    const { error: statusError } = await supabaseAdmin
      .from('candidatos')
      .update({ status: 'comportamental_respondido' })
      .eq('id', candidato_id)

    if (statusError) throw statusError
    const { error: logError } = await supabaseAdmin.from('logs_processamento').insert({
      empresa_id: EMPRESA_ID,
      candidato_id,
      etapa: 'comportamental',
      status: 'sucesso',
      mensagem: `Perfil: ${perfilDominante} | Score: ${scoreComp}`,
    })

    if (logError) throw logError
    return NextResponse.json({
      resultado: { perfil_dominante: perfilDominante, score_comportamental: scoreComp, contagem }
    }, { status: 201 })

  } catch (err) {
    console.error('[POST /api/comportamental]', err)
    return NextResponse.json({ error: 'Erro ao salvar comportamental' }, { status: 500 })
  }
}
