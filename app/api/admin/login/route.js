import { NextResponse } from 'next/server'
import { checkOrigin, failure } from '@/lib/security'
import { ADMIN_COOKIE, cookieOptions, equalSecret, signSession } from '@/lib/session.mjs'
// Best effort por instância: não substitui limitação de tentativas no provedor.
const attempts = new Map()
export async function POST(req) {
  const originError = checkOrigin(req)
  if (originError) return originError
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16) return failure('Configure uma senha administrativa forte (mínimo 16 caracteres).', 503)
  const key = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const now = Date.now()
  for (const [k, value] of attempts) if (value.until <= now) attempts.delete(k)
  const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 }
  if (attempt.count >= 10 || attempts.size >= 10000) return failure('Muitas tentativas. Aguarde e tente novamente.', 429)
  attempt.count++; attempts.set(key, attempt)
  try {
    const { usuario, senha } = await req.json()
    if (usuario !== 'admin' || !equalSecret(senha, process.env.ADMIN_PASSWORD)) return failure('Usuário ou senha inválidos.', 401)
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
    response.cookies.set(ADMIN_COOKIE, signSession('admin', 'admin', 8 * 3600), cookieOptions(8 * 3600))
    attempts.delete(key)
    return response
  } catch { return failure('Não foi possível concluir o login.', 500) }
}
