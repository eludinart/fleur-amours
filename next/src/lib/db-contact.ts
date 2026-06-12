/**
 * Messages du formulaire de contact (wp_fleur_contact_messages).
 */
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

const T_CONTACT = () => table('fleur_contact_messages')

let _ensurePromise: Promise<void> | null = null

export function ensureContactTable(): Promise<void> {
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
  const pool = getPool()
  const t = T_CONTACT()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${t} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT DEFAULT NULL,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT NULL,
      subject VARCHAR(255) DEFAULT NULL,
      message TEXT NOT NULL,
      status ENUM('new','read','replied','closed') NOT NULL DEFAULT 'new',
      ip_address VARCHAR(45) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

export type ContactMessageInput = {
  userId?: number | null
  email: string
  name?: string | null
  subject?: string | null
  message: string
  ipAddress?: string | null
}

export async function createContactMessage(input: ContactMessageInput): Promise<{ id: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureContactTable()
  const pool = getPool()
  const t = T_CONTACT()
  const email = String(input.email ?? '').trim().slice(0, 255)
  const message = String(input.message ?? '').trim()
  if (!email || !email.includes('@')) throw new Error('Email invalide')
  if (!message) throw new Error('Message requis')

  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${t} (user_id, email, name, subject, message, status, ip_address)
     VALUES (?, ?, ?, ?, ?, 'new', ?)`,
    [
      input.userId ?? null,
      email,
      input.name ? String(input.name).trim().slice(0, 255) : null,
      input.subject ? String(input.subject).trim().slice(0, 255) : null,
      message.slice(0, 10000),
      input.ipAddress ? String(input.ipAddress).slice(0, 45) : null,
    ]
  )
  return { id: Number(res.insertId) }
}

export async function listContactMessages(params: {
  page?: number
  per_page?: number
  status?: string
}): Promise<{ items: Record<string, unknown>[]; total: number; pages: number }> {
  if (!isDbConfigured()) return { items: [], total: 0, pages: 1 }
  await ensureContactTable()
  const pool = getPool()
  const t = T_CONTACT()
  const perPage = Math.min(100, Math.max(1, params.per_page ?? 20))
  const page = Math.max(1, params.page ?? 1)
  const offset = (page - 1) * perPage
  const status = String(params.status ?? '').trim()
  const where = status ? 'WHERE status = ?' : ''
  const values: (string | number)[] = status ? [status] : []

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM ${t} ${where}`,
    values
  )
  const total = Number(countRows[0]?.total ?? 0)
  const pages = Math.max(1, Math.ceil(total / perPage))

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, email, name, subject, message, status, created_at, updated_at
     FROM ${t} ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, perPage, offset]
  )

  const items = rows.map((r) => ({
    id: Number(r.id),
    user_id: r.user_id != null ? Number(r.user_id) : null,
    email: String(r.email ?? ''),
    name: r.name ?? null,
    subject: r.subject ?? null,
    message: String(r.message ?? ''),
    status: String(r.status ?? 'new'),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  }))
  return { items, total, pages }
}

export async function getContactMessage(id: number): Promise<Record<string, unknown> | null> {
  if (!isDbConfigured()) return null
  await ensureContactTable()
  const pool = getPool()
  const t = T_CONTACT()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${t} WHERE id = ? LIMIT 1`, [id])
  const r = rows[0]
  if (!r) return null
  return {
    id: Number(r.id),
    user_id: r.user_id != null ? Number(r.user_id) : null,
    email: String(r.email ?? ''),
    name: r.name ?? null,
    subject: r.subject ?? null,
    message: String(r.message ?? ''),
    status: String(r.status ?? 'new'),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  }
}

export async function updateContactMessageStatus(
  id: number,
  status: 'new' | 'read' | 'replied' | 'closed'
): Promise<void> {
  if (!isDbConfigured()) return
  await ensureContactTable()
  const pool = getPool()
  const t = T_CONTACT()
  await pool.execute(`UPDATE ${t} SET status = ? WHERE id = ?`, [status, id])
}
