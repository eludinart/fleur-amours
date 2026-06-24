/**
 * POST /api/engagement/remind
 * Relances d'engagement unifiées : 1 nudge / utilisateur / fenêtre de cooldown.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { findEngagementCandidates } from '@/lib/db-engagement'
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
      limit?: number
      activityDays?: number
      cooldownHours?: number
      tirageStaleDays?: number
      dreamscapeStaleDays?: number
      dryRun?: boolean
    }

    const candidates = await findEngagementCandidates({
      limit: body.limit,
      activityDays: body.activityDays,
      cooldownHours: body.cooldownHours,
      tirageStaleDays: body.tirageStaleDays,
      dreamscapeStaleDays: body.dreamscapeStaleDays,
    })

    if (body.dryRun) {
      return NextResponse.json({
        dryRun: true,
        devRestricted: isNotificationOutboundRestricted(),
        candidates: candidates.length,
        sample: candidates.slice(0, 15).map((c) => ({
          userId: c.userId,
          campaignId: c.campaignId,
          vars: c.vars,
        })),
      })
    }

    let sent = 0
    const byCampaign: Record<string, number> = {}

    for (const c of candidates) {
      try {
        const personalization = await loadEngagementPersonalization(c.userId, c.email)
        const result = await sendEngagementNotification({
          userId: c.userId,
          email: c.email,
          campaignId: c.campaignId,
          vars: c.vars,
          personalization,
          source_id: c.source_id ?? null,
        })
        if (!result.sent) continue
        sent++
        byCampaign[c.campaignId] = (byCampaign[c.campaignId] ?? 0) + 1
      } catch {
        /* continuer */
      }
    }

    return NextResponse.json({
      candidates: candidates.length,
      sent,
      byCampaign,
      devRestricted: isNotificationOutboundRestricted(),
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const status = err instanceof ApiError ? err.status : e.status || 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
