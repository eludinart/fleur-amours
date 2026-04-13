/**
 * Demandes « devenir accompagnant » (usermeta WordPress).
 * Statuts : pending | rejected (absence de clé = jamais demandé).
 * À l’attribution du rôle coach/admin, les métas sont effacées (voir users/update).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from './db'

export const COACH_REQUEST_STATUS_PENDING = 'pending'
/** Refus manuel (usermeta) : l’utilisateur peut renvoyer une demande. */
export const COACH_REQUEST_STATUS_REJECTED = 'rejected'

const META_STATUS = 'fleur_coach_request_status'
const META_AT = 'fleur_coach_request_at'
const META_MESSAGE = 'fleur_coach_request_message'

async function upsertUserMeta(userId: number, metaKey: string, metaValue: string): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tbl} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, metaKey]
  )
  if (existing.length > 0) {
    await pool.execute(`UPDATE ${tbl} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`, [
      metaValue,
      userId,
      metaKey,
    ])
  } else {
    await pool.execute(`INSERT INTO ${tbl} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
      userId,
      metaKey,
      metaValue,
    ])
  }
}

export async function submitCoachRequest(userId: number, message?: string): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${tbl} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, META_STATUS]
  )
  const current = rows[0]?.meta_value ? String(rows[0].meta_value) : ''
  if (current === COACH_REQUEST_STATUS_PENDING) {
    const err = new Error('COACH_REQUEST_ALREADY_PENDING') as Error & { code?: string }
    err.code = 'COACH_REQUEST_ALREADY_PENDING'
    throw err
  }
  const safeMessage = (message ?? '').trim().slice(0, 2000)
  const now = new Date().toISOString()
  await upsertUserMeta(userId, META_STATUS, COACH_REQUEST_STATUS_PENDING)
  await upsertUserMeta(userId, META_AT, now)
  await upsertUserMeta(userId, META_MESSAGE, safeMessage)
}

export async function clearCoachRequestMeta(userId: number): Promise<void> {
  const pool = getPool()
  const tbl = table('usermeta')
  await pool.execute(
    `DELETE FROM ${tbl} WHERE user_id = ? AND meta_key IN (?, ?, ?)`,
    [userId, META_STATUS, META_AT, META_MESSAGE]
  )
}
