/**
 * Candidats duo « même pétale dominant » (À-deux / dyads).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import { loadEngagementPersonalization } from './engagement-context'
import { sendEngagementNotification } from './send-engagement-notification'
import { filterOutDemoUserIds } from './demo-accounts-filter'
import { assertCampaignAllowed } from './notification-prefs'
import { authMe } from './db-auth'

export async function runDuoSamePetalNudges(params: {
  limit?: number
  dryRun?: boolean
}): Promise<{ sent: number; skipped: number; pairs: number }> {
  if (!isDbConfigured()) return { sent: 0, skipped: 0, pairs: 0 }
  const limit = Math.min(Math.max(params.limit ?? 40, 1), 100)
  const pool = getPool()

  // Paires a-deux actives (table pairing si présente)
  let pairs: Array<{ a: number; b: number }> = []
  try {
    const t = table('fleur_a_deux_pairings')
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id_a AS a, user_id_b AS b FROM ${t}
        WHERE status IN ('active','accepted','paired')
        ORDER BY id DESC LIMIT ?`,
      [limit]
    )
    pairs = (rows ?? [])
      .map((r) => ({ a: Number(r.a), b: Number(r.b) }))
      .filter((p) => p.a && p.b)
  } catch {
    try {
      const t = table('fleur_dyads')
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT user_id AS a, partner_user_id AS b FROM ${t}
          WHERE partner_user_id IS NOT NULL
          ORDER BY id DESC LIMIT ?`,
        [limit]
      )
      pairs = (rows ?? [])
        .map((r) => ({ a: Number(r.a), b: Number(r.b) }))
        .filter((p) => p.a && p.b)
    } catch {
      return { sent: 0, skipped: 0, pairs: 0 }
    }
  }

  const real = new Set(
    await filterOutDemoUserIds(pairs.flatMap((p) => [p.a, p.b]))
  )
  let sent = 0
  let skipped = 0

  for (const pair of pairs) {
    if (!real.has(pair.a) || !real.has(pair.b)) {
      skipped++
      continue
    }
    const [pa, pb] = await Promise.all([
      loadEngagementPersonalization(pair.a, null),
      loadEngagementPersonalization(pair.b, null),
    ])
    if (!pa.dominantPetalId || pa.dominantPetalId !== pb.dominantPetalId) {
      skipped++
      continue
    }
    if (params.dryRun) {
      sent += 2
      continue
    }

    for (const [uid, pers] of [
      [pair.a, pa] as const,
      [pair.b, pb] as const,
    ]) {
      if (!(await assertCampaignAllowed(uid, 'duo_same_petal'))) {
        skipped++
        continue
      }
      // Cooldown 7j par user
      const tN = table('fleur_notifications')
      const tD = table('fleur_notification_deliveries')
      const [recent] = await pool.execute<RowDataPacket[]>(
        `SELECT 1 FROM ${tD} d INNER JOIN ${tN} n ON n.id = d.notification_id
          WHERE d.user_id = ? AND n.source_type = 'engagement_duo_same_petal'
            AND d.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) LIMIT 1`,
        [uid]
      )
      if (recent?.length) {
        skipped++
        continue
      }
      try {
        const me = await authMe(uid)
        const result = await sendEngagementNotification({
          userId: uid,
          email: me.email,
          campaignId: 'duo_same_petal',
          personalization: pers,
        })
        if (result.sent) sent++
        else skipped++
      } catch {
        skipped++
      }
    }
  }

  return { sent, skipped, pairs: pairs.length }
}
