/**
 * POST /api/auth/admin/impersonate-restore
 * Restaure la session admin après une impersonation (web/httpOnly).
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtDecodeForRefresh } from '@/lib/jwt'
import { authMe } from '@/lib/db-auth'
import { setAuthCookie, clearAdminBackupCookie, getAdminBackupFromCookie } from '@/lib/auth-cookie'

export const dynamic = 'force-dynamic'

async function isAdminPayload(payload: { sub: string; role?: string }): Promise<boolean> {
  const role = String(payload.role ?? '').toLowerCase()
  if (role === 'admin' || role === 'administrator') return true
  try {
    const user = await authMe(parseInt(payload.sub, 10))
    const dbRole = user.app_role || user.wp_role || ''
    return dbRole === 'admin' || dbRole === 'administrator'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const backup = getAdminBackupFromCookie(req)
    if (!backup) {
      return NextResponse.json({ error: 'Aucune session admin à restaurer.' }, { status: 400 })
    }
    const payload = jwtDecodeForRefresh(backup)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Backup invalide.' }, { status: 401 })
    }
    if (!(await isAdminPayload(payload))) {
      return NextResponse.json({ error: 'Backup invalide.' }, { status: 401 })
    }

    const user = await authMe(parseInt(payload.sub, 10))
    const res = NextResponse.json({ ok: true, user })
    setAuthCookie(res, backup)
    clearAdminBackupCookie(res)
    return res
  } catch (err) {
    const e = err as Error
    return NextResponse.json({ error: e?.message || 'Erreur.' }, { status: 500 })
  }
}
