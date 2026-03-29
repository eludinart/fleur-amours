/**
 * Messages de contact — MariaDB
 *
 * Table (créée par migration_v0.7.sql) :
 *   wp_fleur_contact_messages
 */
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { getPool, table } from './db'

const TBL = () => table('fleur_contact_messages')

export type ContactMessageStatus = 'new' | 'read' | 'replied' | 'closed'

export type ContactMessage = {
  id: number
  user_id: number | null
  email: string
  name: string | null
  subject: string | null
  message: string
  status: ContactMessageStatus
  ip_address: string | null
  created_at: Date
  updated_at: Date
}

export type InsertContactPayload = {
  user_id?: number | null
  email: string
  name?: string | null
  subject?: string | null
  message: string
  ip_address?: string | null
}

export async function insertContactMessage(payload: InsertContactPayload): Promise<{ id: number }> {
  const pool = getPool()
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${TBL()} (user_id, email, name, subject, message, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.user_id ?? null,
      payload.email,
      payload.name ?? null,
      payload.subject ?? null,
      payload.message,
      payload.ip_address ?? null,
    ]
  )
  return { id: result.insertId }
}

export async function listContactMessages(params: {
  status?: ContactMessageStatus
  page?: number
  per_page?: number
}): Promise<{ items: ContactMessage[]; total: number }> {
  const pool = getPool()
  const { status, page = 1, per_page = 20 } = params
  const offset = (Math.max(1, page) - 1) * per_page

  const whereClause = status ? 'WHERE status = ?' : ''
  const whereParams: (string | number)[] = status ? [status] : []

  const [[{ total }]] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM ${TBL()} ${whereClause}`,
    whereParams
  )

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, email, name, subject, message, status, ip_address, created_at, updated_at
     FROM ${TBL()} ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...whereParams, per_page, offset]
  )

  return { items: rows as ContactMessage[], total: Number(total) }
}

export async function getContactMessage(id: number): Promise<ContactMessage | null> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, email, name, subject, message, status, ip_address, created_at, updated_at
     FROM ${TBL()} WHERE id = ? LIMIT 1`,
    [id]
  )
  return (rows[0] as ContactMessage) ?? null
}

export async function updateContactMessage(
  id: number,
  fields: { status?: ContactMessageStatus }
): Promise<{ updated: boolean }> {
  const pool = getPool()
  const sets: string[] = []
  const params: (string | number)[] = []

  if (fields.status) {
    sets.push('status = ?')
    params.push(fields.status)
  }
  if (!sets.length) return { updated: false }
  params.push(id)

  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE ${TBL()} SET ${sets.join(', ')} WHERE id = ?`,
    params
  )
  return { updated: result.affectedRows > 0 }
}
