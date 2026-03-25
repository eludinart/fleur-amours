import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authMe } from '@/lib/db-auth'
import { jwtDecodeForRefresh, jwtEncode } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export async function POST(req: NextRequest) {
  try {
    const token = getAuthHeader(req)
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }
    const payload = jwtDecodeForRefresh(token)
    if (!payload) {
      return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 })
    }
    let role = payload.role || 'user'
    let email = payload.email || ''
    if (isDbConfigured()) {
      try {
        const userId = parseInt(payload.sub, 10)
        if (!isNaN(userId)) {
          const user = await authMe(userId)
          role = user.app_role || role
          email = user.email || email
        }
      } catch {
        // Keep payload values on DB error
      }
    }
    const newToken = jwtEncode({ sub: payload.sub, role, email })
    return NextResponse.json({ token: newToken })
  } catch {
    return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 })
  }
}
