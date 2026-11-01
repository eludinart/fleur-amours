/**
 * Envoi quotidien carte du jour (+ série J2/J3, dimanche) — hors cooldown hebdo.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import { filterOutDemoUserIds } from './demo-accounts-filter'
import { loadEngagementPersonalization } from './engagement-context'
import { sendEngagementNotification } from './send-engagement-notification'
import { readNotificationPrefs } from './notification-prefs'
import {
  isSundayParis,
  markSeriesAdvanced,
  markSeriesDay1Sent,
  peekSeriesDue,
  seriesMicroGeste,
  seriesQuestionForCard,
} from './daily-card-series'
import type { EngagementCampaignId } from './engagement-templates'
import { pickDailyCardForUser } from './daily-card'

export type DailyCardRunResult = {
  ok: true
  dryRun: boolean
  candidates: number
  sent: number
  skipped: number
  byCampaign: Record<string, number>
}

function parisHour(d = new Date()): number {
  return parseInt(
    new Intl.DateTimeFormat('fr-FR', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Europe/Paris',
    }).format(d),
    10
  )
}

/** Fenêtre matin 7–11h Paris pour carte du jour. */
export function isMorningParisWindow(d = new Date()): boolean {
  const h = parisHour(d)
  return h >= 7 && h < 11
}

async function listEligibleUserIds(limit: number): Promise<Array<{ userId: number; email: string }>> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  const tUsers = table('users')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ID AS user_id, user_email AS email
       FROM ${tUsers}
      WHERE user_email IS NOT NULL AND user_email != ''
        AND user_status = 0
      ORDER BY ID ASC
      LIMIT ?`,
    [limit]
  )
  return (rows ?? [])
    .map((r) => ({
      userId: Number(r.user_id),
      email: String(r.email ?? '').trim(),
    }))
    .filter((r) => r.userId && r.email.includes('@'))
}

async function alreadySentToday(userId: number, campaign: string): Promise<boolean> {
  const pool = getPool()
  const tN = table('fleur_notifications')
  const tD = table('fleur_notification_deliveries')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1
       FROM ${tD} d
       INNER JOIN ${tN} n ON n.id = d.notification_id
      WHERE d.user_id = ?
        AND n.source_type = ?
        AND d.created_at >= CURDATE()
      LIMIT 1`,
    [userId, `engagement_${campaign}`]
  )
  return (rows?.length ?? 0) > 0
}

export async function runDailyCardEngagement(params: {
  limit?: number
  dryRun?: boolean
  force?: boolean
  skipWindowCheck?: boolean
}): Promise<DailyCardRunResult | { error: string; status: number }> {
  if (!isDbConfigured()) return { error: 'Backend non configuré', status: 503 }

  const limit = Math.min(Math.max(params.limit ?? 400, 1), 800)
  const dryRun = !!params.dryRun
  if (!params.skipWindowCheck && !params.force && !isMorningParisWindow()) {
    return {
      ok: true,
      dryRun,
      candidates: 0,
      sent: 0,
      skipped: 0,
      byCampaign: { outside_morning_window: 1 },
    }
  }

  const users = await listEligibleUserIds(limit)
  const realIds = new Set(await filterOutDemoUserIds(users.map((u) => u.userId)))
  const byCampaign: Record<string, number> = {}
  let sent = 0
  let skipped = 0
  let candidates = 0

  const sunday = isSundayParis()

  for (const u of users) {
    if (!realIds.has(u.userId)) {
      skipped++
      continue
    }
    const prefs = await readNotificationPrefs(u.userId)
    if (!prefs.topics.carte_du_jour) {
      skipped++
      continue
    }

    // Série J2/J3 prioritaire si due
    const advance = await peekSeriesDue(u.userId)
    if (advance.campaign) {
      candidates++
      if (await alreadySentToday(u.userId, advance.campaign)) {
        skipped++
        continue
      }
      if (dryRun) {
        byCampaign[advance.campaign] = (byCampaign[advance.campaign] ?? 0) + 1
        sent++
        continue
      }
      const personalization = await loadEngagementPersonalization(u.userId, u.email)
      const cardName = personalization.dailyCard?.name ?? ''
      const result = await sendEngagementNotification({
        userId: u.userId,
        email: u.email,
        campaignId: advance.campaign,
        personalization,
        vars: {
          personalization,
          question: seriesQuestionForCard(personalization.locale, cardName),
          microGeste: seriesMicroGeste(personalization.locale),
        },
        skipDevGuard: false,
      })
      if (result.sent) {
        sent++
        byCampaign[advance.campaign] = (byCampaign[advance.campaign] ?? 0) + 1
        await markSeriesAdvanced(u.userId, advance.campaign)
      } else skipped++
      continue
    }

    const campaignId: EngagementCampaignId = sunday ? 'carte_dimanche' : 'carte_du_jour'
    if (await alreadySentToday(u.userId, campaignId)) {
      skipped++
      continue
    }

    candidates++
    if (dryRun) {
      byCampaign[campaignId] = (byCampaign[campaignId] ?? 0) + 1
      sent++
      continue
    }

    const personalization = await loadEngagementPersonalization(u.userId, u.email)
    if (!personalization.dailyCard) {
      const card = await pickDailyCardForUser(u.userId)
      personalization.dailyCard = card
    }
    if (!personalization.dailyCard) {
      skipped++
      continue
    }

    const result = await sendEngagementNotification({
      userId: u.userId,
      email: u.email,
      campaignId,
      personalization,
      vars: {
        personalization,
        question: seriesQuestionForCard(
          personalization.locale,
          personalization.dailyCard.name
        ),
      },
      skipDevGuard: false,
    })
    if (result.sent) {
      sent++
      byCampaign[campaignId] = (byCampaign[campaignId] ?? 0) + 1
      await markSeriesDay1Sent(u.userId, personalization.dailyCard.slug)
    } else {
      skipped++
    }
  }

  return { ok: true, dryRun, candidates, sent, skipped, byCampaign }
}
