/**
 * Audit + rate limit des bonus SAP (coach / admin).
 */
import type { RowDataPacket } from 'mysql2/promise'
import { getPool, isDbConfigured, table } from '@/lib/db'

const TBL = () => table('fleur_sap_bonus_log')

const COACH_MAX_BONUS_PER_HOUR = parseInt(process.env.SAP_BONUS_COACH_MAX_PER_HOUR || '120', 10) || 120

export async function ensureSapBonusLogTable(): Promise<void> {
  if (!isDbConfigured()) return
  const pool = getPool()
  const prefix = process.env.DB_PREFIX || 'wp_'
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_sap_bonus_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actor_user_id INT NOT NULL,
      patient_user_id INT NOT NULL,
      amount INT NOT NULL,
      reason VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_actor_time (actor_user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function countCoachBonusesLastHour(actorUserId: number): Promise<number> {
  if (!isDbConfigured()) return 0
  await ensureSapBonusLogTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM ${TBL()} WHERE actor_user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
    [actorUserId]
  )
  return Math.max(0, Number((rows?.[0] as { c?: number })?.c) || 0)
}

export class BonusRateLimitError extends Error {
  constructor() {
    super('Trop de bonus SAP en une heure. Réessayez plus tard ou contactez un administrateur.')
  }
}

export async function assertCoachBonusRateLimit(actorUserId: number, isAdmin: boolean): Promise<void> {
  if (isAdmin) return
  const n = await countCoachBonusesLastHour(actorUserId)
  if (n >= COACH_MAX_BONUS_PER_HOUR) {
    throw new BonusRateLimitError()
  }
}

export async function logSapBonus(params: {
  actorUserId: number
  patientUserId: number
  amount: number
  reason: string
}): Promise<void> {
  if (!isDbConfigured()) return
  await ensureSapBonusLogTable()
  const pool = getPool()
  await pool.execute(`INSERT INTO ${TBL()} (actor_user_id, patient_user_id, amount, reason) VALUES (?, ?, ?, ?)`, [
    params.actorUserId,
    params.patientUserId,
    params.amount,
    params.reason.slice(0, 255),
  ])
}

export { COACH_MAX_BONUS_PER_HOUR }
