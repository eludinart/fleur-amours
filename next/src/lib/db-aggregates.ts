/**
 * Agrégats relationnels — MariaDB.
 *
 * Calcule des indicateurs collectifs (moyennes pétales, tendances, climat) à partir
 * de `fleur_timeline_events`, avec un seuil de k-anonymat : aucun agrégat n'est
 * renvoyé si le nombre de contributeurs distincts est inférieur au seuil. Aucune
 * donnée individuelle brute n'est exposée par ce module.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

const TBL = () => table('fleur_timeline_events')

/** Seuil minimal de répondants distincts pour exposer un agrégat (RGPD / k-anonymat). */
export const K_ANONYMITY_THRESHOLD = (() => {
  const n = parseInt(process.env.MYCELIUM_K_ANONYMITY ?? '', 10)
  return Number.isFinite(n) && n >= 3 ? n : 5
})()

const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']

export type AggregateResult = {
  available: boolean
  reason?: 'below_threshold' | 'no_data' | 'db_unavailable'
  respondents: number
  threshold: number
  petalsAverage: Record<string, number> | null
  moodAverage: number | null
  eventCount: number
  windowDays: number
}

/**
 * Agrégat de climat pour une équipe (ou une organisation si teamId omis).
 * Retourne `available: false` si le nombre de répondants est sous le seuil.
 */
export async function getTeamClimate(params: {
  orgId: number
  teamId?: number | null
  windowDays?: number
}): Promise<AggregateResult> {
  const windowDays = Math.min(Math.max(params.windowDays ?? 30, 1), 365)
  const base: AggregateResult = {
    available: false,
    respondents: 0,
    threshold: K_ANONYMITY_THRESHOLD,
    petalsAverage: null,
    moodAverage: null,
    eventCount: 0,
    windowDays,
  }
  if (!isDbConfigured()) return { ...base, reason: 'db_unavailable' }
  if (!Number.isFinite(params.orgId) || params.orgId <= 0) return { ...base, reason: 'no_data' }

  const pool = getPool()
  const conds = ['org_id = ?', 'created_at >= (NOW() - INTERVAL ? DAY)']
  const args: (number | string)[] = [params.orgId, windowDays]
  if (params.teamId != null) {
    conds.push('team_id = ?')
    args.push(params.teamId)
  }
  const where = conds.join(' AND ')

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT user_id) AS respondents, COUNT(*) AS events,
            AVG(NULLIF(mood, 0)) AS mood_avg
       FROM ${TBL()} WHERE ${where}`,
    args
  )
  const respondents = Number(countRows[0]?.respondents ?? 0)
  const eventCount = Number(countRows[0]?.events ?? 0)
  const moodAverage = countRows[0]?.mood_avg != null ? Number(countRows[0].mood_avg) : null

  if (respondents === 0) return { ...base, reason: 'no_data' }
  if (respondents < K_ANONYMITY_THRESHOLD) {
    return { ...base, respondents, eventCount, reason: 'below_threshold' }
  }

  // Moyenne des pétales : on agrège côté applicatif (petals_json) pour rester portable.
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT petals_json FROM ${TBL()} WHERE ${where} AND petals_json IS NOT NULL`,
    args
  )
  const sums = new Array(PETAL_IDS.length).fill(0)
  let n = 0
  for (const r of rows) {
    try {
      const arr = JSON.parse(r.petals_json)
      if (Array.isArray(arr) && arr.length >= PETAL_IDS.length) {
        for (let i = 0; i < PETAL_IDS.length; i++) sums[i] += Number(arr[i]) || 0
        n++
      }
    } catch {
      /* ignore ligne corrompue */
    }
  }
  let petalsAverage: Record<string, number> | null = null
  if (n > 0) {
    petalsAverage = {}
    for (let i = 0; i < PETAL_IDS.length; i++) {
      petalsAverage[PETAL_IDS[i]] = Math.round((sums[i] / n) * 100) / 100
    }
  }

  return {
    available: true,
    respondents,
    threshold: K_ANONYMITY_THRESHOLD,
    petalsAverage,
    moodAverage: moodAverage != null ? Math.round(moodAverage * 100) / 100 : null,
    eventCount,
    windowDays,
  }
}
