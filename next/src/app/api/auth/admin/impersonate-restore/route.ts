/**
 * POST /api/auth/admin/impersonate-restore
 * Restaure la session admin après une impersonation (web/httpOnly).
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtDecodeForRefresh } from '@/lib/jwt'
import { setAuthCookie } from '@/lib/auth-cookie'

export const dynamic = 'force-dynamic'

const ADMIN_BACKUP_COOKIE = 'auth_token_admin_backup'

export async function POST(req: NextRequest) {
  try {
    const backup = req.cookies.get(ADMIN_BACKUP_COOKIE)?.value ?? null
    if (!backup) {
      return NextResponse.json({ error: 'Aucune session admin à restaurer.' }, { status: 400 })
    }
    const payload = jwtDecodeForRefresh(backup)
    const role = String(payload?.role ?? '').toLowerCase()
    if (!payload?.sub || !(role === 'admin' || role === 'administrator')) {
      return NextResponse.json({ error: 'Backup invalide.' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    // Remet le cookie d'auth principal sur l'admin
    setAuthCookie(res, backup)
    // Efface le backup
    res.cookies.set(ADMIN_BACKUP_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin',
      maxAge: 0,
    })
    return res
  } catch (err) {
    const e = err as Error
    return NextResponse.json({ error: e?.message || 'Erreur.' }, { status: 500 })
  }
}

