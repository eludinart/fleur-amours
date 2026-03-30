/**
 * Bonus de quota mensuel (tokens gratuits) — MariaDB.
 * Ajoute des unités au quota du mois (limite + bonus) au lieu de réduire l'usage.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise'
import { getPool, isDbConfigured, table } from '@/lib/db'

type SqlExecutor = Pick<Pool, 'execute'>

export type QuotaKey = 'chat_messages' | 'sessions' | 'tirages' | 'fleur_submits'

export type QuotaBonus = Record<`${QuotaKey}_bonus`, number> & { period: string }

const TBL = () => table('fleur_user_quota_bonus_monthly')

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

export async function ensureQuotaBonusTable(exec: SqlExecutor): Promise<void> {
  const prefix = process.env.DB_PREFIX || 'wp_'
  await exec.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_user_quota_bonus_monthly (
      user_id INT NOT NULL,
      period CHAR(7) NOT NULL,
      chat_messages_bonus INT NOT NULL DEFAULT 0,
      sessions_bonus INT NOT NULL DEFAULT 0,
      tirages_bonus INT NOT NULL DEFAULT 0,
      fleur_submits_bonus INT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, period)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function ensureRow(exec: SqlExecutor, userId: number, period: string): Promise<void> {
  await exec.execute(
    `INSERT IGNORE INTO ${TBL()} (user_id, period) VALUES (?, ?)`,
    [userId, period]
  )
}

export async function readQuotaBonus(userId: number, period = currentPeriod()): Promise<QuotaBonus> {
  if (!isDbConfigured()) {
    return {
      period,
      chat_messages_bonus: 0,
      sessions_bonus: 0,
      tirages_bonus: 0,
      fleur_submits_bonus: 0,
    }
  }
  const pool = getPool()
  await ensureQuotaBonusTable(pool)
  await ensureRow(pool, userId, period)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT chat_messages_bonus, sessions_bonus, tirages_bonus, fleur_submits_bonus
     FROM ${TBL()} WHERE user_id = ? AND period = ? LIMIT 1`,
    [userId, period]
  )
  const r = rows?.[0] ?? {}
  return {
    period,
    chat_messages_bonus: Math.max(0, Number(r.chat_messages_bonus) || 0),
    sessions_bonus: Math.max(0, Number(r.sessions_bonus) || 0),
    tirages_bonus: Math.max(0, Number(r.tirages_bonus) || 0),
    fleur_submits_bonus: Math.max(0, Number(r.fleur_submits_bonus) || 0),
  }
}

export async function addQuotaBonus(
  userId: number,
  bonus: Partial<Record<QuotaKey, number>>,
  period = currentPeriod()
): Promise<QuotaBonus> {
  if (!isDbConfigured()) {
    return {
      period,
      chat_messages_bonus: 0,
      sessions_bonus: 0,
      tirages_bonus: 0,
      fleur_submits_bonus: 0,
    }
  }
  const pool = getPool()
  await ensureQuotaBonusTable(pool)
  await ensureRow(pool, userId, period)

  const updates: string[] = []
  const params: number[] = []
  const map: Array<[QuotaKey, string]> = [
    ['chat_messages', 'chat_messages_bonus'],
    ['sessions', 'sessions_bonus'],
    ['tirages', 'tirages_bonus'],
    ['fleur_submits', 'fleur_submits_bonus'],
  ]
  for (const [k, col] of map) {
    const n = Math.floor(Number(bonus[k] ?? 0))
    if (n > 0) {
      updates.push(`${col} = ${col} + ?`)
      params.push(n)
    }
  }
  if (updates.length > 0) {
    params.push(userId)
    // @ts-expect-error - period string in params ok
    params.push(period as unknown as number)
    await pool.execute(
      `UPDATE ${TBL()} SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = ? AND period = ?`,
      params as unknown as (string | number)[]
    )
  }

  return readQuotaBonus(userId, period)
}

