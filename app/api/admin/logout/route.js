import { NextResponse } from 'next/server'
import { checkOrigin } from '@/lib/security'
import { ADMIN_COOKIE, cookieOptions } from '@/lib/session.mjs'
export async function POST(req) {
  const denied = checkOrigin(req); if (denied) return denied
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  response.cookies.set(ADMIN_COOKIE, '', cookieOptions(0))
  return response
}
