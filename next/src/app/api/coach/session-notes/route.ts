/**
 * PATCH /api/coach/session-notes
 * Note libre coach pour une session (une note par couple coach × session).
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdminOrCoach } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { listCoachPatientEmailsNormalized } from '@/lib/db-coach-patients'
import { upsertCoachSessionNote } from '@/lib/db-coach-session-notes'
import { getById } from '@/lib/db-sessions'

export const dynamic = 'force-dynamic'

function normEmail(s: string): string {
  return String(s ?? '').trim().toLowerCase()
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'DB non configurée' }, { status: 500 })
    }
    const { userId, isAdmin } = await requireAdminOrCoach(req)
    const viewerId = parseInt(userId, 10)
    if (!Number.isFinite(viewerId) || viewerId <= 0) {
      return NextResponse.json({ error: 'Utilisateur invalide' }, { status: 400 })
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const sessionId = Number(body?.session_id ?? body?.sessionId ?? 0)
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: 'session_id requis' }, { status: 400 })
    }
    const note =
      typeof body?.note === 'string'
        ? body.note
        : body?.note === null || body?.note === undefined
          ? ''
          : String(body?.note ?? '')

    const session = await getById(sessionId)
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    const sessionEmail = normEmail(String(session.email ?? ''))
    if (!sessionEmail) {
      return NextResponse.json({ error: 'Session sans email patient' }, { status: 400 })
    }

    if (!isAdmin) {
      const allowed = await listCoachPatientEmailsNormalized(viewerId)
      if (!allowed.includes(sessionEmail)) {
        return NextResponse.json({ error: 'Accès interdit (patient non lié à ce coach)' }, { status: 403 })
      }
    }

    await upsertCoachSessionNote({
      coachUserId: viewerId,
      sessionId,
      noteText: note,
    })

    return NextResponse.json({
      ok: true,
      session_id: sessionId,
      coach_private_note: note.trim() || null,
    })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erreur'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
