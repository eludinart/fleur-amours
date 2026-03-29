/**
 * Sessions — MariaDB
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, table } from './db'

const tbl = () => table('fleur_sessions')

/** Renvoie l'email lié à une session (pour vérification d'ownership). */
export async function getSessionEmail(id: number): Promise<string | null> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT email FROM ${tbl()} WHERE id = ?`,
    [id]
  )
  return rows[0]?.email ?? null
}

export async function ensureTable(): Promise<void> {
  const pool = getPool()
  const t = tbl()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${t} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) DEFAULT NULL,
      first_words TEXT,
      door_suggested VARCHAR(50) DEFAULT NULL,
      petals_json TEXT,
      history_json MEDIUMTEXT,
      cards_json TEXT,
      anchors_json TEXT,
      plan14j_json TEXT,
      step_data_json MEDIUMTEXT DEFAULT NULL,
      doors_locked VARCHAR(255) DEFAULT NULL,
      turn_count INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'completed',
      duration_seconds INT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export async function save(body: Record<string, unknown>): Promise<{ id: number }> {
  const pool = getPool()
  await ensureTable()
  const t = tbl()
  const stepDataJson = Object.prototype.hasOwnProperty.call(body, 'step_data')
    ? JSON.stringify(body.step_data)
    : null
  const sql = `INSERT INTO ${t} (email, first_words, door_suggested, petals_json, history_json, cards_json, anchors_json, plan14j_json, step_data_json, doors_locked, turn_count, status, duration_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  const values = [
    body.email ?? null,
    body.first_words ?? '',
    body.door_suggested ?? null,
    JSON.stringify(body.petals ?? []),
    JSON.stringify(body.history ?? []),
    JSON.stringify(body.cards_drawn ?? []),
    JSON.stringify(body.anchors ?? []),
    JSON.stringify(body.plan14j ?? null),
    stepDataJson,
    body.doors_locked ?? '',
    parseInt(String(body.turn_count ?? 0), 10),
    body.status ?? 'completed',
    parseInt(String(body.duration_seconds ?? 0), 10),
  ]
  await exec(pool, sql, values)
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() as id')
  return { id: Number(rows[0]?.id) }
}

export async function update(body: Record<string, unknown>): Promise<{ updated: boolean }> {
  const pool = getPool()
  const t = tbl()
  const id = parseInt(String(body.id ?? 0), 10)
  if (!id) throw new Error('id requis')
  const updates: string[] = []
  const params: (string | number | boolean | null)[] = []
  const fieldMap: [string, string, boolean][] = [
    ['petals', 'petals_json', true],
    ['history', 'history_json', true],
    ['cards_drawn', 'cards_json', true],
    ['anchors', 'anchors_json', true],
    ['plan14j', 'plan14j_json', true],
    ['step_data', 'step_data_json', true],
    ['first_words', 'first_words', false],
    ['door_suggested', 'door_suggested', false],
    ['doors_locked', 'doors_locked', false],
    ['status', 'status', false],
  ]
  for (const [key, col, isJson] of fieldMap) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updates.push(`${col} = ?`)
      params.push(isJson ? JSON.stringify(body[key]) : (body[key] as string | number | boolean | null))
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'turn_count')) {
    updates.push('turn_count = ?')
    params.push(parseInt(String(body.turn_count), 10))
  }
  if (Object.prototype.hasOwnProperty.call(body, 'duration_seconds')) {
    updates.push('duration_seconds = ?')
    params.push(parseInt(String(body.duration_seconds), 10))
  }
  if (updates.length === 0) throw new Error('Rien à mettre à jour')
  params.push(id)
  const sql = `UPDATE ${t} SET ${updates.join(', ')} WHERE id = ?`
  const [result] = await exec(pool, sql, params)
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0
  return { updated: affected > 0 }
}

export async function my(email: string, status?: string): Promise<{ items: Record<string, unknown>[] }> {
  const pool = getPool()
  await ensureTable()
  const t = tbl()
  let sql = `SELECT id, email, first_words, door_suggested, petals_json, history_json, cards_json, anchors_json, step_data_json, doors_locked, turn_count, status, duration_seconds, created_at
     FROM ${t} WHERE email = ?`
  const params: (string | number)[] = [email]
  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  sql += ' ORDER BY created_at DESC LIMIT 10'
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params)
  const items = rows.map((r) => {
    const cardsRaw = JSON.parse(r.cards_json || '[]')
    const cards = Array.isArray(cardsRaw) ? cardsRaw : []
    return {
      id: Number(r.id),
      first_words: (r.first_words || '').slice(0, 120),
      door_suggested: r.door_suggested,
      petals: JSON.parse(r.petals_json || '{}'),
      history: JSON.parse(r.history_json || '[]'),
      cards_drawn: cards,
      anchors: JSON.parse(r.anchors_json || '[]'),
      step_data: JSON.parse(r.step_data_json || 'null'),
      doors_locked: r.doors_locked ? r.doors_locked.split(',') : [],
      turn_count: Number(r.turn_count),
      status: r.status,
      duration_seconds: Number(r.duration_seconds),
      created_at: r.created_at,
    }
  })
  return { items }
}

export async function list(params: {
  page?: number
  per_page?: number
  search?: string
  status?: string
}): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const pool = getPool()
  await ensureTable()
  const t = tbl()
  const perPage = Math.min(50, Math.max(1, params.per_page ?? 20))
  const page = Math.max(1, params.page ?? 1)
  const offset = (page - 1) * perPage

  let where = '1=1'
  const values: (string | number)[] = []
  if (params.search) {
    where += ' AND (email LIKE ? OR first_words LIKE ?)'
    const s = `%${params.search}%`
    values.push(s, s)
  }
  if (params.status) {
    where += ' AND status = ?'
    values.push(params.status)
  }

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM ${t} WHERE ${where}`,
    values as (string | number)[]
  )
  const total = Number(countRows[0]?.total ?? 0)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, email, first_words, door_suggested, turn_count, status, duration_seconds, created_at
     FROM ${t} WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...values, perPage, offset] as (string | number)[]
  )
  const items = rows.map((r) => ({
    id: Number(r.id),
    email: r.email,
    first_words: (r.first_words || '').slice(0, 120),
    door_suggested: r.door_suggested,
    turn_count: Number(r.turn_count),
    status: r.status,
    duration_seconds: Number(r.duration_seconds),
    created_at: r.created_at,
  }))
  return { items, total }
}

export async function stats(): Promise<{
  total: number
  by_status: Record<string, number>
  in_progress: number
  completed: number
  avg_turns: string
  avg_duration?: number
  door_distribution: Array<{ door: string; count: number }>
  avg_petals: Record<string, number>
}> {
  const pool = getPool()
  await ensureTable()
  const t = tbl()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT status, COUNT(*) as cnt FROM ${t} GROUP BY status`
  )
  let total = 0
  const by_status: Record<string, number> = {}
  for (const r of rows) {
    const cnt = Number(r.cnt ?? 0)
    by_status[String(r.status ?? '')] = cnt
    total += cnt
  }
  const in_progress = by_status['in_progress'] ?? 0
  const completed = by_status['completed'] ?? 0

  const [aggRows] = await pool.execute<RowDataPacket[]>(
    `SELECT AVG(turn_count) as avg_turns, AVG(duration_seconds) as avg_dur FROM ${t}`
  )
  const avgTurns = aggRows[0]?.avg_turns != null ? Number(aggRows[0].avg_turns).toFixed(1) : '-'
  const avgDuration = aggRows[0]?.avg_dur != null ? Math.round(Number(aggRows[0].avg_dur)) : undefined

  const [doorRows] = await pool.execute<RowDataPacket[]>(
    `SELECT door_suggested as door, COUNT(*) as cnt FROM ${t} WHERE door_suggested IS NOT NULL AND door_suggested != '' GROUP BY door_suggested ORDER BY cnt DESC`
  )
  const door_distribution = doorRows.map((r) => ({
    door: String(r.door ?? ''),
    count: Number(r.cnt ?? 0),
  }))

  const avg_petals: Record<string, number> = {}
  const petalKeys = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']
  for (const k of petalKeys) avg_petals[k] = 0

  return {
    total,
    by_status,
    in_progress,
    completed,
    avg_turns: avgTurns,
    avg_duration: avgDuration,
    door_distribution,
    avg_petals,
  }
}

export async function shadowStats(): Promise<{ total: number; by_level: Record<string, number> }> {
  return { total: 0, by_level: {} }
}

export async function getById(id: number, email?: string): Promise<Record<string, unknown> | null> {
  const pool = getPool()
  await ensureTable()
  const t = tbl()
  let sql = `SELECT id, email, first_words, door_suggested, petals_json, history_json, cards_json, anchors_json, plan14j_json, step_data_json, doors_locked, turn_count, status, duration_seconds, created_at FROM ${t} WHERE id = ?`
  const params: (number | string)[] = [id]
  if (email) {
    sql += ' AND email = ?'
    params.push(email)
  }
  const [rows] = await pool.execute<RowDataPacket[]>(sql, params)
  const r = rows[0]
  if (!r) return null
  const cardsRaw = JSON.parse(r.cards_json || '[]')
  const cards = Array.isArray(cardsRaw) ? cardsRaw : []
  return {
    id: Number(r.id),
    email: r.email,
    first_words: r.first_words,
    door_suggested: r.door_suggested,
    petals: JSON.parse(r.petals_json || '{}'),
    history: JSON.parse(r.history_json || '[]'),
    cards_drawn: cards,
    anchors: JSON.parse(r.anchors_json || '[]'),
    plan14j: JSON.parse(r.plan14j_json || 'null'),
    step_data: JSON.parse(r.step_data_json || 'null'),
    doors_locked: r.doors_locked ? r.doors_locked.split(',') : [],
    turn_count: Number(r.turn_count),
    status: r.status,
    duration_seconds: Number(r.duration_seconds),
    created_at: r.created_at,
  }
}

export async function deleteById(id: number): Promise<{ deleted: boolean }> {
  const pool = getPool()
  await ensureTable()
  const t = tbl()
  const [result] = await pool.execute(`DELETE FROM ${t} WHERE id = ?`, [id])
  const affected = (result as { affectedRows?: number }).affectedRows ?? 0
  return { deleted: affected > 0 }
}
