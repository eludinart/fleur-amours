/**
 * POST /api/checkins/remind
 * Relance check-in : crée des notifications in-app pour les utilisateurs actifs
 * n'ayant pas fait de check-in récemment. À déclencher par un planificateur
 * (header `x-cron-secret: $CRON_SECRET`) ou par un admin authentifié.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { findCheckinReminderCandidates } from '@/lib/db-checkins'
import { createNotification } from '@/lib/db-notifications'

export const dynamic = 'force-dynamic'

async function authorize(req: NextRequest): Promise<void> {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  if (secret && provided && provided === secret) return
  // Sinon, exiger un admin authentifié.
  await requireAdmin(req)
}

export async function POST(req: NextRequest) {
  try {
    await authorize(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      staleDays?: number
      activityDays?: number
      limit?: number
    }
    const candidates = await findCheckinReminderCandidates({
      staleDays: body.staleDays,
      activityDays: body.activityDays,
      limit: body.limit,
    })

    let sent = 0
    for (const c of candidates) {
      try {
        await createNotification({
          type: 'checkin_reminder',
          title: 'Comment vous sentez-vous aujourd’hui ?',
          body: 'Prenez 30 secondes pour un check-in : humeur, tension relationnelle, une note.',
          action_url: '/checkin',
          action_label: 'Faire mon check-in',
          recipient_type: 'user',
          recipient_id: c.userId,
          priority: 'low',
          source_type: 'checkin_reminder',
        })
        sent++
      } catch {
        /* on continue sur les autres candidats */
      }
    }

    return NextResponse.json({ candidates: candidates.length, sent })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const status = err instanceof ApiError ? err.status : e.status || 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
