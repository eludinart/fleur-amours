/**
 * Clôture one-shot du plan 14 jours (session terminée, plan à 100 %).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import { loadEngagementPersonalization } from './engagement-context'
import { sendEngagementNotification } from './send-engagement-notification'
import { filterOutDemoUserIds } from './demo-accounts-filter'
import { assertCampaignAllowed } from './notification-prefs'
import { authMe } from './db-auth'

export async function runPlan14jClosingNudges(params: {
  limit?: number
}): Promise<{ sent: number; skipped: number }> {
  if (!isDbConfigured()) return { sent: 0, skipped: 0 }
  const limit = Math.min(Math.max(params.limit ?? 40, 1), 100)
  const pool = getPool()
  const tSessions = table('fleur_sessions')

  let rows: RowDataPacket[] = []
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT id, user_id, user_email, plan14j_json, status
         FROM ${tSessions}
        WHERE plan14j_json IS NOT NULL AND plan14j_json != ''
          AND status IN ('completed','done','finished','closed')
          AND updated_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
        ORDER BY updated_at DESC
        LIMIT ?`,
      [limit * 3]
    )
    rows = r ?? []
  } catch {
    return { sent: 0, skipped: 0 }
  }

  const real = new Set(
    await filterOutDemoUserIds(rows.map((r) => Number(r.user_id)).filter(Boolean))
  )
  let sent = 0
  let skipped = 0
  const seen = new Set<number>()

  for (const r of rows) {
    const userId = Number(r.user_id)
    if (!userId || !real.has(userId) || seen.has(userId)) {
      skipped++
      continue
    }
    let progress = 0
    try {
      const plan = JSON.parse(String(r.plan14j_json)) as { progressPct?: number; currentDay?: number }
      progress = Number(plan.progressPct ?? 0)
      const day = Number(plan.currentDay ?? 0)
      if (progress < 95 && day < 14) {
        skipped++
        continue
      }
    } catch {
      skipped++
      continue
    }

    if (!(await assertCampaignAllowed(userId, 'plan14j_closing'))) {
      skipped++
      continue
    }

    const tN = table('fleur_notifications')
    const tD = table('fleur_notification_deliveries')
    const sessionId = Number(r.id)
    const [recent] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM ${tD} d INNER JOIN ${tN} n ON n.id = d.notification_id
        WHERE d.user_id = ? AND n.source_type = 'engagement_plan14j_closing'
          AND (n.source_id = ? OR d.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
        LIMIT 1`,
      [userId, sessionId]
    )
    if (recent?.length) {
      skipped++
      continue
    }

    try {
      const email = String(r.user_email ?? '').trim() || (await authMe(userId)).email
      const personalization = await loadEngagementPersonalization(userId, email)
      const result = await sendEngagementNotification({
        userId,
        email,
        campaignId: 'plan14j_closing',
        personalization,
        source_id: sessionId,
        vars: { sessionId, personalization },
      })
      if (result.sent) {
        sent++
        seen.add(userId)
      } else skipped++
    } catch {
      skipped++
    }
  }

  return { sent, skipped }
}
