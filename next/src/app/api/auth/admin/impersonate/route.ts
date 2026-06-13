/**
 * POST /api/auth/admin/impersonate
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { getAuthHeader } from '@/lib/api-auth'
import { authMe } from '@/lib/db-auth'
import { setAuthCookie, setAdminBackupCookie } from '@/lib/auth-cookie'
import { jwtEncode } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

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
      setAdminBackupCookie(res, currentToken)
    }
    setAuthCookie(res, token)
    return res
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
