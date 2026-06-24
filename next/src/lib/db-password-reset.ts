/**
 * Réinitialisation de mot de passe — MariaDB.
 *
 * Flux :
 * - L'utilisateur demande une réinitialisation via son e-mail.
 * - Un token à usage unique (valable 1h) est créé dans `fleur_password_resets`.
 * - Un e-mail contenant un lien `/reset-password?token=...` est envoyé.
 * - L'utilisateur saisit un nouveau mot de passe ; le token est consommé et le
 *   `user_pass` WordPress est réécrit en bcrypt (compatible login existant).
 *
 * Sécurité : pas d'énumération de compte (la route renvoie toujours un succès
 * générique), tokens hachés au repos, anciens tokens invalidés à chaque demande.
 */
import { createHash, randomBytes } from 'crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { hash } from 'bcryptjs'
import { getPool, isDbConfigured, table } from './db'

const TBL = () => table('fleur_password_resets')

/** Durée de validité d'un lien de réinitialisation (1 heure). */
const TOKEN_TTL_MS = 60 * 60 * 1000

/** Longueur minimale du mot de passe (alignée sur l'inscription). */
export const MIN_PASSWORD_LENGTH = 6

function normalizeEmail(s: unknown): string {
  return String(s ?? '').trim().toLowerCase()
}

/** Hash du token stocké en base (le token clair n'est jamais persisté). */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function ensureTable(): Promise<void> {
  if (!isDbConfigured()) return
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TBL()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      email VARCHAR(255) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_token_hash (token_hash),
      KEY idx_user (user_id),
      KEY idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

function toMysqlDateTime(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export type PasswordResetRequest = {
  token: string
  userId: number
  email: string
  displayName: string
  expiresAt: Date
}

/**
 * Crée un token de réinitialisation pour l'e-mail donné.
 * Renvoie `null` si aucun compte ne correspond (sans révéler l'information à l'appelant).
 * Invalide les éventuels tokens non utilisés du même compte.
 */
export async function createPasswordResetToken(
  emailRaw: string
): Promise<PasswordResetRequest | null> {
  if (!isDbConfigured()) return null
  const email = normalizeEmail(emailRaw)
  if (!email || !email.includes('@')) return null

  await ensureTable()
  const pool = getPool()
  const usersTbl = table('users')

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ID, user_email, display_name FROM ${usersTbl} WHERE user_email = ? LIMIT 1`,
    [email]
  )
  const user = rows[0]
  if (!user) return null

  const userId = Number(user.ID)
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  // Invalide les anciens tokens encore valides de ce compte.
  await pool.execute(
    `UPDATE ${TBL()} SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`,
    [userId]
  )

  await pool.execute(
    `INSERT INTO ${TBL()} (user_id, email, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
    [userId, email, tokenHash, toMysqlDateTime(expiresAt)]
  )

  return {
    token,
    userId,
    email: String(user.user_email || email),
    displayName: String(user.display_name || ''),
    expiresAt,
  }
}

export type ConsumeResult =
  | { ok: true; userId: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'weak_password' | 'db' }

/**
 * Consomme un token et réécrit le mot de passe (bcrypt) sur `wp_users`.
 */
export async function consumePasswordResetToken(
  token: string,
  newPassword: string
): Promise<ConsumeResult> {
  if (!isDbConfigured()) return { ok: false, reason: 'db' }
  const cleanToken = String(token ?? '').trim()
  if (!cleanToken) return { ok: false, reason: 'invalid' }
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: 'weak_password' }
  }

  await ensureTable()
  const pool = getPool()
  const tokenHash = hashToken(cleanToken)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, expires_at, used_at FROM ${TBL()} WHERE token_hash = ? LIMIT 1`,
    [tokenHash]
  )
  const row = rows[0]
  if (!row || row.used_at) return { ok: false, reason: 'invalid' }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  const userId = Number(row.user_id)
  const userPass = await hash(newPassword, 10)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // Marque le token consommé en s'assurant qu'il ne l'était pas déjà (anti-rejeu concurrent).
    const [upd] = await conn.execute<ResultSetHeader>(
      `UPDATE ${TBL()} SET used_at = NOW() WHERE id = ? AND used_at IS NULL`,
      [row.id]
    )
    if (upd.affectedRows !== 1) {
      await conn.rollback()
      return { ok: false, reason: 'invalid' }
    }
    await conn.execute(
      `UPDATE ${table('users')} SET user_pass = ? WHERE ID = ?`,
      [userPass, userId]
    )
    // Invalide tout autre token en attente pour ce compte.
    await conn.execute(
      `UPDATE ${TBL()} SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`,
      [userId]
    )
    await conn.commit()
  } catch {
    await conn.rollback()
    return { ok: false, reason: 'db' }
  } finally {
    conn.release()
  }

  return { ok: true, userId }
}
