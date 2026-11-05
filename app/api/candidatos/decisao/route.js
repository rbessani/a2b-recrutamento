import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkOrigin, requireAdmin, requireCandidate, failure } from '@/lib/security'
export async function POST(req) {
 try {
  const originError = checkOrigin(req); if (originError) return originError
  const adminError = requireAdmin(req); if (adminError) return adminError
  const { candidato_id, decisao } = await req.json()
  const candidateError = await requireCandidate(req, candidato_id); if (candidateError) return candidateError
  if (!['em_analise', 'aprovado', 'reprovado'].includes(decisao)) return failure('Decisão inválida.', 400)
  const { error } = await supabaseAdmin.from('candidatos').update({ decisao_selecao: decisao }).eq('id', candidato_id).eq('empresa_id', process.env.NEXT_PUBLIC_EMPRESA_ID)
  if (error) throw error
  const { error: logError } = await supabaseAdmin.from('logs_processamento').insert({ empresa_id: process.env.NEXT_PUBLIC_EMPRESA_ID, candidato_id, etapa: 'decisao_selecao', status: 'sucesso', mensagem: 'Decisão atualizada por admin.', detalhes: { decisao, responsavel: 'admin', atualizado_em: new Date().toISOString() } })
  if (logError) throw logError
  return NextResponse.json({ ok: true })
 } catch { return failure('Não foi possível salvar a decisão.', 500) }
}
