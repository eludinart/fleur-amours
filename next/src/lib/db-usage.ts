/**
 * Usage mensuel (tokens) — MariaDB.
 * Stocke l'usage par période YYYY-MM pour permettre les quotas + crédits admin.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise'
import { getPool, isDbConfigured, table } from '@/lib/db'

type SqlExecutor = Pick<Pool, 'execute'>

export type UsageKey = 'chat_messages' | 'sessions' | 'tirages' | 'fleur_submits'

export type UsageCounters = Record<`${UsageKey}_count`, number> & { period: string }

const TBL = () => table('fleur_user_usage_monthly')

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}

export async function ensureUsageTable(exec: SqlExecutor): Promise<void> {
  const prefix = process.env.DB_PREFIX || 'wp_'
  await exec.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_user_usage_monthly (
      user_id INT NOT NULL,
      period CHAR(7) NOT NULL,
      chat_messages_count INT NOT NULL DEFAULT 0,
      sessions_count INT NOT NULL DEFAULT 0,
      tirages_count INT NOT NULL DEFAULT 0,
      fleur_submits_count INT NOT NULL DEFAULT 0,
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

export async function readMonthlyUsage(userId: number, period = currentPeriod()): Promise<UsageCounters> {
  if (!isDbConfigured()) {
    return {
      period,
      chat_messages_count: 0,
      sessions_count: 0,
      tirages_count: 0,
      fleur_submits_count: 0,
    }
  }
  const pool = getPool()
  await ensureUsageTable(pool)
  await ensureRow(pool, userId, period)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT chat_messages_count, sessions_count, tirages_count, fleur_submits_count
     FROM ${TBL()} WHERE user_id = ? AND period = ? LIMIT 1`,
    [userId, period]
  )
  const r = rows?.[0] ?? {}
  return {
    period,
    chat_messages_count: Math.max(0, Number(r.chat_messages_count) || 0),
    sessions_count: Math.max(0, Number(r.sessions_count) || 0),
    tirages_count: Math.max(0, Number(r.tirages_count) || 0),
    fleur_submits_count: Math.max(0, Number(r.fleur_submits_count) || 0),
  }
}

export async function incrementMonthlyUsage(
  userId: number,
  delta: Partial<Record<UsageKey, number>>,
  period = currentPeriod()
): Promise<void> {
  if (!isDbConfigured()) return
  const pool = getPool()
  await ensureUsageTable(pool)
  await ensureRow(pool, userId, period)

  const updates: string[] = []
  const params: number[] = []
  const map: Array<[UsageKey, string]> = [
    ['chat_messages', 'chat_messages_count'],
    ['sessions', 'sessions_count'],
    ['tirages', 'tirages_count'],
    ['fleur_submits', 'fleur_submits_count'],
  ]
  for (const [k, col] of map) {
    const n = Math.floor(Number(delta[k] ?? 0))
    if (n > 0) {
      updates.push(`${col} = ${col} + ?`)
      params.push(n)
    }
  }
  if (updates.length === 0) return
  const sqlParams: (string | number)[] = [...params, userId, period]
  await pool.execute(
    `UPDATE ${TBL()} SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = ? AND period = ?`,
    sqlParams
  )
}

export async function creditMonthlyUsage(
  userId: number,
  credit: Partial<Record<UsageKey, number>>,
  period = currentPeriod()
): Promise<void> {
  if (!isDbConfigured()) return
  const pool = getPool()
  await ensureUsageTable(pool)
  await ensureRow(pool, userId, period)

  // Crédit = réduction du compteur d'usage, sans descendre sous 0.
  const updates: string[] = []
  const params: number[] = []
  const map: Array<[UsageKey, string]> = [
    ['chat_messages', 'chat_messages_count'],
    ['sessions', 'sessions_count'],
    ['tirages', 'tirages_count'],
    ['fleur_submits', 'fleur_submits_count'],
  ]
  for (const [k, col] of map) {
    const n = Math.floor(Number(credit[k] ?? 0))
    if (n > 0) {
      updates.push(`${col} = GREATEST(0, ${col} - ?)`)
      params.push(n)
    }
  }
  if (updates.length === 0) return
  const sqlParams: (string | number)[] = [...params, userId, period]
  await pool.execute(
    `UPDATE ${TBL()} SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = ? AND period = ?`,
    sqlParams
  )
}

