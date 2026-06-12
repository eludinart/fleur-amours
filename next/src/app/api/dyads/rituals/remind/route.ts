/**
 * POST /api/dyads/rituals/remind
 * Relance les rituels de couple échus via notifications in-app.
 * Sécurisé par header `x-cron-secret: $CRON_SECRET` ou par un admin authentifié.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { findDueRituals } from '@/lib/db-dyads'
import { createNotification } from '@/lib/db-notifications'

export const dynamic = 'force-dynamic'

async function authorize(req: NextRequest): Promise<void> {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  if (secret && provided && provided === secret) return
  await requireAdmin(req)
}

export async function POST(req: NextRequest) {
  try {
    await authorize(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const due = await findDueRituals()
    let sent = 0
    for (const r of due) {
      const recipients = [r.userA, r.userB].filter((u): u is number => typeof u === 'number' && u > 0)
      for (const recipientId of recipients) {
        try {
          await createNotification({
            type: 'dyad_ritual',
            title: 'Votre rituel de couple vous attend',
            body: r.title || 'Un moment à partager avec votre partenaire.',
            action_url: '/couple',
            action_label: 'Ouvrir le Jardin du couple',
            recipient_type: 'user',
            recipient_id: recipientId,
            priority: 'normal',
            source_type: 'dyad_ritual',
            source_id: r.ritualId,
          })
          sent++
        } catch {
          /* continue */
        }
      }
    }
    return NextResponse.json({ due: due.length, sent })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const status = err instanceof ApiError ? err.status : e.status || 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
