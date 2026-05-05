import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { usuario, senha } = await req.json()

    if (usuario !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Usuário ou senha inválidos' }, { status: 401 })
    }

    if (senha !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ ok: false, error: 'Usuário ou senha inválidos' }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Erro no login' }, { status: 500 })
  }
}
