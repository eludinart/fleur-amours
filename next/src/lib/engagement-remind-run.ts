/**
 * Logique métier des relances engagement (route API + cron Coolify).
 */
import type { EngagementCandidate } from '@/lib/db-engagement'
import { isDbConfigured } from '@/lib/db'
import { findEngagementCandidates } from '@/lib/db-engagement'
import { loadEngagementPersonalization } from '@/lib/engagement-context'
import { sendEngagementNotification } from '@/lib/send-engagement-notification'
import { isNotificationOutboundRestricted } from '@/lib/notification-outbound'

export type EngagementRemindInput = {
  limit?: number
  activityDays?: number
  cooldownHours?: number
  tirageStaleDays?: number
  dreamscapeStaleDays?: number
  dryRun?: boolean
}

export type EngagementRemindResult =
  | {
      dryRun: true
      devRestricted: boolean
      candidates: number
      sample: Array<Pick<EngagementCandidate, 'userId' | 'campaignId' | 'vars'>>
    }
  | {
      candidates: number
      sent: number
      byCampaign: Record<string, number>
      devRestricted: boolean
    }
  | { error: string; status: number }

export async function runEngagementRemind(
  body: EngagementRemindInput
): Promise<EngagementRemindResult> {
  if (!isDbConfigured()) {
    return { error: 'Backend non configuré', status: 503 }
  }

  const candidates = await findEngagementCandidates({
    limit: body.limit,
    activityDays: body.activityDays,
    cooldownHours: body.cooldownHours,
    tirageStaleDays: body.tirageStaleDays,
    dreamscapeStaleDays: body.dreamscapeStaleDays,
  })

  if (body.dryRun) {
    return {
      dryRun: true,
      devRestricted: isNotificationOutboundRestricted(),
      candidates: candidates.length,
      sample: candidates.slice(0, 15).map((c) => ({
        userId: c.userId,
        campaignId: c.campaignId,
        vars: c.vars,
      })) as Array<Pick<EngagementCandidate, 'userId' | 'campaignId' | 'vars'>>,
    }
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

  return {
    candidates: candidates.length,
    sent,
    byCampaign,
    devRestricted: isNotificationOutboundRestricted(),
  }
}
