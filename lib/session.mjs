import { createHmac, timingSafeEqual } from 'node:crypto'
export const ADMIN_COOKIE = 'bsn_admin'
export function candidateCookie(id) { return 'bsn_inscricao_' + createHmac('sha256', 'cookie-name').update(String(id)).digest('hex').slice(0, 20) }
function secret() {
  const key = process.env.SESSION_SECRET
  if (!key || key.length < 32) throw new Error('SESSION_SECRET deve ter ao menos 32 caracteres')
  return key
}
export function equalSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const aa = createHmac('sha256', 'comparison').update(a).digest()
  const bb = createHmac('sha256', 'comparison').update(b).digest()
  return timingSafeEqual(aa, bb)
}
export function signSession(role, subject, ttl, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ role, subject, company: process.env.NEXT_PUBLIC_EMPRESA_ID, exp: Math.floor(now / 1000) + ttl })).toString('base64url')
  return body + '.' + createHmac('sha256', secret()).update(body).digest('base64url')
}
export function verifySession(token, role, subject, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2048) return false
  const pieces = token.split('.')
  if (pieces.length !== 2) return false
  const expected = createHmac('sha256', secret()).update(pieces[0]).digest('base64url')
  if (!equalSecret(pieces[1], expected)) return false
  try {
    const data = JSON.parse(Buffer.from(pieces[0], 'base64url').toString())
    return data.role === role && data.subject === subject && data.company === process.env.NEXT_PUBLIC_EMPRESA_ID && Number.isFinite(data.exp) && data.exp > Math.floor(now / 1000)
  } catch { return false }
}
export function cookieOptions(maxAge) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge }
}
