/**
 * POST /api/checkins/remind
 * Relance check-in avec contenu personnalisé et multilingue.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { findCheckinReminderCandidates } from '@/lib/db-checkins'
import { findRecentlyNudgedUserIds } from '@/lib/db-engagement'
import { loadEngagementPersonalization } from '@/lib/engagement-context'
import { sendEngagementNotification } from '@/lib/send-engagement-notification'
import { isNotificationOutboundRestricted } from '@/lib/notification-outbound'

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
    const recentlyNudged = await findRecentlyNudgedUserIds(20)

    let sent = 0
    for (const c of candidates) {
      if (recentlyNudged.has(c.userId)) continue
      try {
        const personalization = await loadEngagementPersonalization(c.userId, c.email)
        const result = await sendEngagementNotification({
          userId: c.userId,
          email: c.email,
          campaignId: 'checkin',
          personalization,
        })
        if (result.sent) sent++
      } catch {
        /* continuer */
      }
    }

    return NextResponse.json({
      candidates: candidates.length,
      sent,
      devRestricted: isNotificationOutboundRestricted(),
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const status = err instanceof ApiError ? err.status : e.status || 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
