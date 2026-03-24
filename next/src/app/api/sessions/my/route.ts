import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { authMe } from '@/lib/db-auth'
import { my } from '@/lib/db-sessions'
import { getAuthHeader } from '@/lib/api-auth'
import { jwtDecode } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const token = getAuthHeader(req)
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }
    const payload = jwtDecode(token)
    if (!payload) {
      return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 })
    }
    let email = payload.email || ''
    if (!email && payload.sub) {
      const user = await authMe(parseInt(payload.sub, 10))
      email = user.email || ''
    }
    const status = req.nextUrl.searchParams.get('status') || undefined
    const data = await my(email, status)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 401 }
    )
  }
}
