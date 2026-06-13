/**
 * POST/GET /api/auth/admin/impersonate-restore
 * Restaure la session admin après une impersonation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtDecodeForRefresh } from '@/lib/jwt'
import { authMe } from '@/lib/db-auth'
import {
  replaceAuthCookie,
  clearAdminBackupCookie,
  getAdminBackupFromCookie,
} from '@/lib/auth-cookie'
import { absolutePublicAppUrl } from '@/lib/app-public-url'

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

function wantsFormRedirect(req: NextRequest): boolean {
  if (req.method === 'GET') return req.nextUrl.searchParams.get('redirect') === '1'
  const ct = req.headers.get('content-type') || ''
  return (
    ct.includes('application/x-www-form-urlencoded') ||
    ct.includes('multipart/form-data') ||
    req.nextUrl.searchParams.get('redirect') === '1'
  )
}

async function readBackupToken(req: NextRequest): Promise<string | null> {
  const fromCookie = getAdminBackupFromCookie(req)
  if (req.method === 'GET') return fromCookie

  const ct = req.headers.get('content-type') || ''
  try {
    if (ct.includes('application/json')) {
      const body = await req.json().catch(() => ({}))
      const raw = body?.backup_token ?? body?.backupToken
      if (typeof raw === 'string' && raw.trim() && raw.trim() !== 'cookie') return raw.trim()
      return fromCookie
    }
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await req.formData()
      const raw = form.get('backup_token')?.toString().trim()
      if (raw && raw !== 'cookie') return raw
      return fromCookie
    }
  } catch {
    // ignore
  }
  return fromCookie
}

async function handleRestore(req: NextRequest): Promise<NextResponse> {
  const formRedirect = wantsFormRedirect(req)
  try {
    const backup = await readBackupToken(req)
    if (!backup) {
      if (formRedirect) {
        return NextResponse.redirect(absolutePublicAppUrl('/?impersonation_restore_error=1', req))
      }
      return NextResponse.json({ error: 'Aucune session admin à restaurer.' }, { status: 400 })
    }

    const payload = jwtDecodeForRefresh(backup)
    if (!payload?.sub) {
      if (formRedirect) {
        return NextResponse.redirect(absolutePublicAppUrl('/?impersonation_restore_error=1', req))
      }
      return NextResponse.json({ error: 'Backup invalide.' }, { status: 401 })
    }
    if (!(await isAdminPayload(payload))) {
      if (formRedirect) {
        return NextResponse.redirect(absolutePublicAppUrl('/?impersonation_restore_error=1', req))
      }
      return NextResponse.json({ error: 'Backup invalide.' }, { status: 401 })
    }

    const user = await authMe(parseInt(payload.sub, 10))

    if (formRedirect) {
      const res = NextResponse.redirect(
        absolutePublicAppUrl('/admin?impersonation_restored=1', req)
      )
      replaceAuthCookie(res, backup)
      clearAdminBackupCookie(res)
      return res
    }

    const res = NextResponse.json({ ok: true, user, token: backup })
    replaceAuthCookie(res, backup)
    clearAdminBackupCookie(res)
    return res
  } catch (err) {
    const e = err as Error
    if (formRedirect) {
      return NextResponse.redirect(absolutePublicAppUrl('/?impersonation_restore_error=1', req))
    }
    return NextResponse.json({ error: e?.message || 'Erreur.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return handleRestore(req)
}

export async function GET(req: NextRequest) {
  return handleRestore(req)
}
