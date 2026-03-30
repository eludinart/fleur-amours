/**
 * POST /api/auth/admin/impersonate
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { getAuthHeader } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { setAuthCookie } from '@/lib/auth-cookie'
import { jwtEncode } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

const ADMIN_BACKUP_COOKIE = 'auth_token_admin_backup'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const targetUserId = body.user_id ?? body.userId
    if (!targetUserId) {
      return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
    }
    const currentToken = getAuthHeader(req)
    const user = await authMe(parseInt(String(targetUserId), 10))
    const token = jwtEncode({
      sub: String(user.id),
      role: user.app_role || 'user',
      email: user.email || '',
    })
    const res = NextResponse.json({ token, user })
    if (currentToken) {
      res.cookies.set(ADMIN_BACKUP_COOKIE, currentToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin',
        maxAge: 24 * 3600,
      })
    }
    setAuthCookie(res, token)
    return res
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
