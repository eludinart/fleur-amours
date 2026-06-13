/**
 * Entretiens bien-être pro Mycelium — historique salarié (non exposé aux RH en clair).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { ensureMyceliumTables } from './db-mycelium'

const T_INTERVIEW = () => table('fleur_mycelium_interviews')

export type InterviewMessage = {
  role: 'assistant' | 'user'
  content: string
  at: string
}

export type InterviewClosure = {
  mood: number
  employeeSummary: string
  pulseNote: string
  dimensions: string[]
  provider: string
}

export type MyceliumInterview = {
  id: number
  userId: number
  orgId: number
  teamId: number | null
  topicSlug: string
  topicLabel: string
  status: 'in_progress' | 'completed' | 'abandoned'
  messages: InterviewMessage[]
  closure: InterviewClosure | null
  createdAt: string
  completedAt: string | null
}

let _ensurePromise: Promise<void> | null = null

export function ensureMyceliumInterviewTables(): Promise<void> {
  if (!isDbConfigured()) return Promise.resolve()
  if (!_ensurePromise) {
    _ensurePromise = _doEnsure().catch((err) => {
      _ensurePromise = null
      throw err
    })
  }
  return _ensurePromise
}

async function _doEnsure(): Promise<void> {
  await ensureMyceliumTables()
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${T_INTERVIEW()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      org_id INT NOT NULL,
      team_id INT DEFAULT NULL,
      topic_slug VARCHAR(64) NOT NULL,
      topic_label VARCHAR(200) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'in_progress',
      messages_json TEXT NOT NULL,
      closure_json TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL,
      INDEX idx_user_org (user_id, org_id),
      INDEX idx_org_status (org_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

function mapRow(r: RowDataPacket): MyceliumInterview {
  let messages: InterviewMessage[] = []
  let closure: InterviewClosure | null = null
  try {
    messages = JSON.parse(String(r.messages_json || '[]'))
  } catch {
    messages = []
  }
  if (r.closure_json) {
    try {
      closure = JSON.parse(String(r.closure_json)) as InterviewClosure
    } catch {
      closure = null
    }
  }
  return {
    id: Number(r.id),
    userId: Number(r.user_id),
    orgId: Number(r.org_id),
    teamId: r.team_id != null ? Number(r.team_id) : null,
    topicSlug: String(r.topic_slug),
    topicLabel: String(r.topic_label),
    status: String(r.status) as MyceliumInterview['status'],
    messages,
    closure,
    createdAt: String(r.created_at ?? ''),
    completedAt: r.completed_at != null ? String(r.completed_at) : null,
  }
}

export async function createInterview(input: {
  userId: number
  orgId: number
  teamId: number | null
  topicSlug: string
  topicLabel: string
  initialMessages: InterviewMessage[]
}): Promise<MyceliumInterview> {
  await ensureMyceliumInterviewTables()
  const pool = getPool()
  const [res] = await exec(
    pool,
    `INSERT INTO ${T_INTERVIEW()} (user_id, org_id, team_id, topic_slug, topic_label, messages_json, status)
     VALUES (?, ?, ?, ?, ?, ?, 'in_progress')`,
    [
      input.userId,
      input.orgId,
      input.teamId,
      input.topicSlug,
      input.topicLabel,
      JSON.stringify(input.initialMessages),
    ]
  )
  const id = Number((res as ResultSetHeader).insertId)
  const row = await getInterviewById(id, input.userId)
  if (!row) throw new Error('Entretien introuvable')
  return row
}

export async function getInterviewById(id: number, userId: number): Promise<MyceliumInterview | null> {
  if (!isDbConfigured()) return null
  await ensureMyceliumInterviewTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_INTERVIEW()} WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  )
  return rows?.length ? mapRow(rows[0]) : null
}

export async function getActiveInterview(userId: number, orgId: number): Promise<MyceliumInterview | null> {
  if (!isDbConfigured()) return null
  await ensureMyceliumInterviewTables()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_INTERVIEW()} WHERE user_id = ? AND org_id = ? AND status = 'in_progress'
     ORDER BY created_at DESC LIMIT 1`,
    [userId, orgId]
  )
  return rows?.length ? mapRow(rows[0]) : null
}

export async function listRecentInterviews(userId: number, orgId: number, limit = 8): Promise<MyceliumInterview[]> {
  if (!isDbConfigured()) return []
  await ensureMyceliumInterviewTables()
  const pool = getPool()
  const safe = Math.min(Math.max(limit, 1), 20)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${T_INTERVIEW()} WHERE user_id = ? AND org_id = ? ORDER BY created_at DESC LIMIT ${safe}`,
    [userId, orgId]
  )
  return rows.map(mapRow)
}

export async function updateInterviewMessages(
  id: number,
  userId: number,
  messages: InterviewMessage[]
): Promise<void> {
  await ensureMyceliumInterviewTables()
  const pool = getPool()
  await exec(pool, `UPDATE ${T_INTERVIEW()} SET messages_json = ? WHERE id = ? AND user_id = ?`, [
    JSON.stringify(messages),
    id,
    userId,
  ])
}

export async function completeInterview(
  id: number,
  userId: number,
  closure: InterviewClosure
): Promise<MyceliumInterview | null> {
  await ensureMyceliumInterviewTables()
  const pool = getPool()
  await exec(
    pool,
    `UPDATE ${T_INTERVIEW()} SET status = 'completed', closure_json = ?, completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    [JSON.stringify(closure), id, userId]
  )
  return getInterviewById(id, userId)
}

export async function abandonInterview(id: number, userId: number): Promise<void> {
  await ensureMyceliumInterviewTables()
  const pool = getPool()
  await exec(
    pool,
    `UPDATE ${T_INTERVIEW()} SET status = 'abandoned', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
    [id, userId]
  )
}
