import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ADMIN_COOKIE, candidateCookie, verifySession } from '@/lib/session.mjs'
export function failure(message, status) { return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } }) }
export function checkOrigin(req) {
  const origin = req.headers.get('origin')
  const expected = process.env.APP_ORIGIN
  if (!expected) return failure('Configure APP_ORIGIN no servidor.', 503)
  try {
    if (!origin || new URL(origin).origin !== new URL(expected).origin) return failure('Origem não autorizada.', 403)
  } catch { return failure('Origem inválida.', 403) }
  return null
}
export function isAdmin(req) { return verifySession(req.cookies.get(ADMIN_COOKIE)?.value, 'admin', 'admin') }
export function requireAdmin(req) { return isAdmin(req) ? null : failure('Faça login para acessar o painel.', 401) }
export async function requireCandidate(req, id) {
  if (!id || typeof id !== 'string') return failure('Inscrição inválida.', 400)
  if (!isAdmin(req) && !verifySession(req.cookies.get(candidateCookie(id))?.value, 'candidate', id)) return failure('Sessão da inscrição inválida ou expirada.', 401)
  const { data, error } = await supabaseAdmin.from('candidatos').select('id,prazo_conclusao,encerrada_incompleta_em').eq('id', id).eq('empresa_id', process.env.NEXT_PUBLIC_EMPRESA_ID).maybeSingle()
  if (error) return failure('Não foi possível validar a inscrição.', 500)
  if(data && !isAdmin(req) && data.prazo_conclusao && (data.encerrada_incompleta_em || Date.now()>=new Date(data.prazo_conclusao).getTime())) return failure('O prazo de conclusão terminou. Contate o recrutador.',409)
  return data ? null : failure('Inscrição não encontrada.', 404)
}
