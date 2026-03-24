import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authMe } from '@/lib/db-auth'
import { jwtDecode } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }
    const token = getAuthHeader(req)
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }
    const payload = jwtDecode(token)
    if (!payload) {
      return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 })
    }
    const userId = parseInt(payload.sub, 10)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }
    const user = await authMe(userId)
    return NextResponse.json(user)
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e.status || 401
    return NextResponse.json({ error: e.message || 'Non autorisé' }, { status })
  }
}
