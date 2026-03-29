import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authMe } from '@/lib/db-auth'
import { jwtDecodeForRefresh, jwtEncode } from '@/lib/jwt'
import { getAuthHeader } from '@/lib/api-auth'
import { setAuthCookie } from '@/lib/auth-cookie'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Lit le token depuis le cookie httpOnly (web) ou Authorization: Bearer (Capacitor)
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
        // En cas d'erreur DB, on garde les valeurs du payload
      }
    }
    const newToken = jwtEncode({ sub: payload.sub, role, email })
    const res = NextResponse.json({ token: newToken })
    // Renouvelle le cookie httpOnly (web) + retourne le token dans le body (Capacitor)
    setAuthCookie(res, newToken)
    return res
  } catch {
    return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 })
  }
}
