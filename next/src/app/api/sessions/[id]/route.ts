/**
 * GET /api/sessions/[id]
 * DELETE /api/sessions/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { listCoachPatientEmailsNormalized } from '@/lib/db-coach-patients'
import { getCoachSessionNote } from '@/lib/db-coach-session-notes'
import { getById, deleteById } from '@/lib/db-sessions'
import { getAuthHeader } from '@/lib/api-auth'
import { jwtDecode } from '@/lib/jwt'
import { authMe } from '@/lib/db-auth'

export const dynamic = 'force-dynamic'

async function getEmailFromToken(req: NextRequest): Promise<string | null> {
  const token = getAuthHeader(req)
  if (!token) return null
  const payload = jwtDecode(token)
  if (!payload?.sub) return null
  try {
    const user = await authMe(parseInt(payload.sub, 10))
    return user.email || null
  } catch {
    return null
  }
}

/** Rôle effectif : JWT, confirmé en base (un rôle révoqué ne donne plus accès). */
async function resolveStaffRole(userId: number, jwtRole: string): Promise<{ isAdmin: boolean; isCoach: boolean }> {
  try {
    const user = await authMe(userId)
    const dbRole = user.app_role || user.wp_role || ''
    return {
      isAdmin: dbRole === 'admin' || dbRole === 'administrator',
      isCoach: dbRole === 'coach',
    }
  } catch {
    // DB indisponible : ne pas accorder de privilèges staff sur la foi du seul JWT.
    void jwtRole
    return { isAdmin: false, isCoach: false }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionId = parseInt(id, 10)
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const token = getAuthHeader(req)
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }

    const payload = jwtDecode(token)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    const viewerId = parseInt(String(payload.sub), 10)
    const jwtRole = String(payload.role ?? '')
    const claimsStaff =
      jwtRole === 'admin' || jwtRole === 'administrator' || jwtRole === 'coach'
    const { isAdmin, isCoach } = claimsStaff
      ? await resolveStaffRole(viewerId, jwtRole)
      : { isAdmin: false, isCoach: false }

    // Admin : accès complet.
    if (isAdmin && Number.isFinite(viewerId) && viewerId > 0) {
      const session = await getById(sessionId)
      if (!session) {
        return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
      }
      const coach_private_note = await getCoachSessionNote({ coachUserId: viewerId, sessionId })
      return NextResponse.json({ ...session, coach_private_note: coach_private_note ?? undefined })
    }

    // Coach : uniquement les sessions de ses patients rattachés.
    if (isCoach && Number.isFinite(viewerId) && viewerId > 0) {
      const session = await getById(sessionId)
      if (!session) {
        return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
      }
      const sessionEmail = String(session.email ?? '').trim().toLowerCase()
      const allowed = sessionEmail ? await listCoachPatientEmailsNormalized(viewerId) : []
      if (!sessionEmail || !allowed.includes(sessionEmail)) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
      const coach_private_note = await getCoachSessionNote({ coachUserId: viewerId, sessionId })
      return NextResponse.json({ ...session, coach_private_note: coach_private_note ?? undefined })
    }

    // Utilisateur standard : uniquement ses propres sessions.
    const email = await getEmailFromToken(req)
    if (!email) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }
    const session = await getById(sessionId, email)
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }
    return NextResponse.json(session)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionId = parseInt(id, 10)
    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const token = getAuthHeader(req)
    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }

    const payload = jwtDecode(token)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    }

    const session = await getById(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    const jwtRole = String(payload.role ?? '')
    const { isAdmin } =
      jwtRole === 'admin' || jwtRole === 'administrator'
        ? await resolveStaffRole(parseInt(String(payload.sub), 10), jwtRole)
        : { isAdmin: false }
    if (!isAdmin) {
      const email = await getEmailFromToken(req)
      if (!email || session.email !== email) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
      }
    }

    const { deleted } = await deleteById(sessionId)
    return NextResponse.json({ ok: deleted, deleted })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur' },
      { status: e.status || 500 }
    )
  }
}
