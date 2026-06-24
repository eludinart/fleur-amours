/**
 * POST /api/sessions/plan14j-remind
 * Relance plan 14 jours : notification matinale avec le jour en cours.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { findRecentlyNudgedUserIds } from '@/lib/db-engagement'
import { findPlan14jReminderCandidates } from '@/lib/db-plan14j-remind'
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
    const body = (await req.json().catch(() => ({}))) as { limit?: number }
    const candidates = await findPlan14jReminderCandidates(body.limit ?? 80)
    const recentlyNudged = await findRecentlyNudgedUserIds(20)

    let sent = 0
    for (const c of candidates) {
      if (recentlyNudged.has(c.userId)) continue
      try {
        const personalization = await loadEngagementPersonalization(c.userId, c.email)
        const result = await sendEngagementNotification({
          userId: c.userId,
          email: c.email,
          campaignId: 'plan14j',
          vars: {
            day: c.currentDay,
            action: c.action,
            planProgressPct: Math.round((c.currentDay / 14) * 100),
          },
          personalization,
          source_id: c.sessionId,
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
