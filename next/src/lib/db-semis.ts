/**
 * Semis — pépite anonyme 1/jour, taguée par pétale (flux du Pouls).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool, table } from './db'

const VALID_PETALS = new Set([
  'agape',
  'philautia',
  'mania',
  'storge',
  'pragma',
  'philia',
  'ludus',
  'eros',
])

const MAX_BODY = 280

let _ensureSemisPromise: Promise<void> | null = null

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function ensureSemisTable(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
  if (!_ensureSemisPromise) {
    const t = table('fleur_semis')
    _ensureSemisPromise = pool
      .execute(`
      CREATE TABLE IF NOT EXISTS ${t} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        petal_id VARCHAR(20) NOT NULL,
        body VARCHAR(320) NOT NULL,
        day_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_day (user_id, day_date),
        INDEX idx_day (day_date, created_at),
        INDEX idx_petal (petal_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
      .then(() => undefined)
      .catch(() => {
        _ensureSemisPromise = null
      })
  }
  return _ensureSemisPromise
}

export type SemisItem = {
  id: number
  petalId: string
  body: string
  createdAt: string
}

export type SemisStatus = {
  canPostToday: boolean
  todaySemis: SemisItem | null
}

export async function getSemisStatus(userId: number): Promise<SemisStatus> {
  const pool = getPool()
  await ensureSemisTable(pool)
  const t = table('fleur_semis')
  const day = todayIso()
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, petal_id, body, created_at FROM ${t} WHERE user_id = ? AND day_date = ? LIMIT 1`,
      [userId, day]
    )
    const row = rows?.[0]
    if (!row) return { canPostToday: true, todaySemis: null }
    return {
      canPostToday: false,
      todaySemis: {
        id: Number(row.id),
        petalId: String(row.petal_id),
        body: String(row.body),
        createdAt: String(row.created_at ?? ''),
      },
    }
  } catch {
    return { canPostToday: true, todaySemis: null }
  }
}

export async function postSemis(
  userId: number,
  petalId: string,
  body: string
): Promise<SemisItem> {
  const pool = getPool()
  await ensureSemisTable(pool)
  const p = String(petalId ?? '').trim()
  if (!VALID_PETALS.has(p)) {
    const err = new Error('Pétale invalide') as Error & { code?: string }
    err.code = 'invalid_petal'
    throw err
  }
  const text = String(body ?? '').trim().slice(0, MAX_BODY)
  if (text.length < 8) {
    const err = new Error('Le Semis doit contenir au moins 8 caractères.') as Error & { code?: string }
    err.code = 'body_too_short'
    throw err
  }

  const status = await getSemisStatus(userId)
  if (!status.canPostToday) {
    const err = new Error('Un seul Semis par jour — revenez demain.') as Error & { code?: string }
    err.code = 'semis_daily_limit'
    throw err
  }

  const t = table('fleur_semis')
  const day = todayIso()
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${t} (user_id, petal_id, body, day_date) VALUES (?, ?, ?, ?)`,
    [userId, p, text, day]
  )
  return {
    id: Number(result.insertId),
    petalId: p,
    body: text,
    createdAt: new Date().toISOString(),
  }
}

export async function getSemisFeed(opts: {
  limit?: number
  petalId?: string | null
}): Promise<SemisItem[]> {
  const pool = getPool()
  await ensureSemisTable(pool)
  const t = table('fleur_semis')
  const limit = Math.min(80, Math.max(1, opts.limit ?? 40))
  const petal = opts.petalId ? String(opts.petalId).trim() : ''
  const params: (string | number)[] = []
  let where = 'WHERE day_date >= (CURDATE() - INTERVAL 14 DAY)'
  if (petal && VALID_PETALS.has(petal)) {
    where += ' AND petal_id = ?'
    params.push(petal)
  }
  params.push(limit)
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, petal_id, body, created_at FROM ${t} ${where} ORDER BY created_at DESC LIMIT ?`,
      params
    )
    return (rows ?? []).map((r) => ({
      id: Number(r.id),
      petalId: String(r.petal_id),
      body: String(r.body),
      createdAt: String(r.created_at ?? ''),
    }))
  } catch {
    return []
  }
}

/** Compteur du jour pour le Pouls. */
export async function countSemisToday(): Promise<number> {
  const pool = getPool()
  await ensureSemisTable(pool)
  const t = table('fleur_semis')
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM ${t} WHERE day_date = CURDATE()`
    )
    return Number(r?.[0]?.c ?? 0)
  } catch {
    return 0
  }
}