import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authLogin } from '@/lib/db-auth'
import { jwtEncode } from '@/lib/jwt'
import { setAuthCookie } from '@/lib/auth-cookie'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

function loginErrorResponse(err: unknown): { status: number; message: string } {
  const e = err as Error & { code?: string; status?: number }
  const msg = e.message || ''
  const code = e.code || ''
  if (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Connection lost')
  ) {
    return {
      status: 503,
      message:
        'Base de données inaccessible en local. Lancez `npm run dev.vps` (tunnel SSH + Next.js).',
    }
  }
  if (e.status && e.status >= 400 && e.status < 600) {
    return { status: e.status, message: msg || 'Erreur' }
  }
  return { status: 401, message: msg || 'Identifiant ou mot de passe incorrect' }
}

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit('login', clientIp(req), { limit: 10, windowMs: 60_000 })
    if (limited) return limited
    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }
    const body = await req.json()
    const login = (body.login || body.email || '').trim()
    const password = body.password || ''
    if (!login || !password) {
      return NextResponse.json(
        { error: 'Identifiant et mot de passe requis' },
        { status: 400 }
      )
    }
    const user = await authLogin(login, password)
    const token = jwtEncode({
      sub: String(user.id),
      role: user.app_role || 'user',
      email: user.email || '',
    })
    const res = NextResponse.json({ token, user })
    setAuthCookie(res, token)
    return res
  } catch (err: unknown) {
    const { status, message } = loginErrorResponse(err)
    return NextResponse.json({ error: message }, { status })
  }
}
