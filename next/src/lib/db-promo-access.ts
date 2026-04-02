/**
 * Promo codes (accès gratuit) — MariaDB
 *
 * Tables:
 * - fleur_promo_codes        : définition
 * - fleur_promo_redemptions  : utilisations / accès attribués
 */
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { getPool, isDbConfigured, table } from '@/lib/db'

type SqlExecutor = Pick<Pool, 'execute'>

const TBL_CODES = () => table('fleur_promo_codes')
const TBL_REDS = () => table('fleur_promo_redemptions')

export type PromoCodeRow = {
  id: number
  code: string
  duration_days: number | null
  max_uses: number | null
  uses_count: number
  expires_at: string | null
  note: string | null
}

export type RedemptionRow = {
  id: number
  user_id: number
  promo_code: string
  redeemed_at: string
  free_until: string | null
  unlimited: boolean
  active: boolean
  promo_note: string | null
}

function nowSql(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function addDaysSql(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + Math.max(0, Math.floor(days)))
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export async function ensurePromoTables(exec: SqlExecutor): Promise<void> {
  const prefix = process.env.DB_PREFIX || 'wp_'
  await exec.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_promo_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(60) NOT NULL UNIQUE,
      duration_days INT NULL DEFAULT NULL,
      max_uses INT NULL DEFAULT NULL,
      uses_count INT NOT NULL DEFAULT 0,
      expires_at DATETIME NULL DEFAULT NULL,
      note TEXT NULL DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await exec.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_promo_redemptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      code_id INT NULL DEFAULT NULL,
      promo_code VARCHAR(60) NOT NULL,
      redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      free_until DATETIME NULL DEFAULT NULL,
      unlimited TINYINT(1) NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      promo_note TEXT NULL DEFAULT NULL,
      INDEX idx_user (user_id),
      INDEX idx_code (promo_code),
      INDEX idx_active (active),
      INDEX idx_redeemed_at (redeemed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // Migrations idempotentes (compat avec anciens schémas)
  // MariaDB supporte ADD COLUMN IF NOT EXISTS.
  const migrations = [
    `ALTER TABLE ${prefix}fleur_promo_redemptions ADD COLUMN IF NOT EXISTS promo_code VARCHAR(60) NOT NULL DEFAULT '—'`,
    `ALTER TABLE ${prefix}fleur_promo_redemptions ADD COLUMN IF NOT EXISTS promo_note TEXT NULL DEFAULT NULL`,
    `ALTER TABLE ${prefix}fleur_promo_redemptions ADD COLUMN IF NOT EXISTS free_until DATETIME NULL DEFAULT NULL`,
    `ALTER TABLE ${prefix}fleur_promo_redemptions ADD COLUMN IF NOT EXISTS unlimited TINYINT(1) NOT NULL DEFAULT 0`,
    `ALTER TABLE ${prefix}fleur_promo_redemptions ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1`,
    `ALTER TABLE ${prefix}fleur_promo_redemptions ADD COLUMN IF NOT EXISTS redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE ${prefix}fleur_promo_codes ADD COLUMN IF NOT EXISTS duration_days INT NULL DEFAULT NULL`,
    `ALTER TABLE ${prefix}fleur_promo_codes ADD COLUMN IF NOT EXISTS max_uses INT NULL DEFAULT NULL`,
    `ALTER TABLE ${prefix}fleur_promo_codes ADD COLUMN IF NOT EXISTS uses_count INT NOT NULL DEFAULT 0`,
    `ALTER TABLE ${prefix}fleur_promo_codes ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL DEFAULT NULL`,
    `ALTER TABLE ${prefix}fleur_promo_codes ADD COLUMN IF NOT EXISTS note TEXT NULL DEFAULT NULL`,
  ]
  for (const sql of migrations) {
    await exec.execute(sql).catch(() => {
      /* ignore */
    })
  }
}

export async function listPromoCodes(): Promise<PromoCodeRow[]> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  await ensurePromoTables(pool)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, code, duration_days, max_uses, uses_count, expires_at, note
     FROM ${TBL_CODES()} ORDER BY id DESC LIMIT 500`
  )
  return rows.map((r) => ({
    id: Number(r.id),
    code: String(r.code),
    duration_days: r.duration_days != null ? Number(r.duration_days) : null,
    max_uses: r.max_uses != null ? Number(r.max_uses) : null,
    uses_count: Number(r.uses_count ?? 0),
    expires_at: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    note: r.note != null ? String(r.note) : null,
  }))
}

export async function createPromoCode(input: {
  code: string
  duration_days: number | null
  max_uses: number | null
  expires_at: string | null
  note?: string
}): Promise<{ id: number }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  const pool = getPool()
  await ensurePromoTables(pool)
  const code = input.code.trim().toUpperCase()
  const duration = input.duration_days != null ? Math.max(1, Math.floor(input.duration_days)) : null
  const maxUses = input.max_uses != null ? Math.max(1, Math.floor(input.max_uses)) : null
  const expiresAt = input.expires_at ? String(input.expires_at).slice(0, 19).replace('T', ' ') : null
  const note = (input.note ?? '').trim() || null
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ${TBL_CODES()} (code, duration_days, max_uses, expires_at, note) VALUES (?, ?, ?, ?, ?)`,
    [code, duration, maxUses, expiresAt, note]
  )
  return { id: Number(res.insertId) }
}

export async function updatePromoCode(input: {
  id: number
  code: string
  duration_days: number | null
  max_uses: number | null
  expires_at: string | null
  note?: string
}): Promise<{ updated: boolean }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  const pool = getPool()
  await ensurePromoTables(pool)
  const id = Math.max(1, Math.floor(input.id))
  const code = input.code.trim().toUpperCase()
  const duration = input.duration_days != null ? Math.max(1, Math.floor(input.duration_days)) : null
  const maxUses = input.max_uses != null ? Math.max(1, Math.floor(input.max_uses)) : null
  const expiresAt = input.expires_at ? String(input.expires_at).slice(0, 19).replace('T', ' ') : null
  const note = (input.note ?? '').trim() || null
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE ${TBL_CODES()} SET code = ?, duration_days = ?, max_uses = ?, expires_at = ?, note = ? WHERE id = ?`,
    [code, duration, maxUses, expiresAt, note, id]
  )
  return { updated: (res.affectedRows ?? 0) > 0 }
}

export async function deletePromoCode(id: number): Promise<{ deleted: boolean }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  const pool = getPool()
  await ensurePromoTables(pool)
  const pid = Math.max(1, Math.floor(id))
  await pool.execute(`DELETE FROM ${TBL_REDS()} WHERE code_id = ?`, [pid]).catch(() => {})
  const [res] = await pool.execute<ResultSetHeader>(`DELETE FROM ${TBL_CODES()} WHERE id = ?`, [pid])
  return { deleted: (res.affectedRows ?? 0) > 0 }
}

export async function listRedemptions(params?: { user_id?: number }): Promise<RedemptionRow[]> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  await ensurePromoTables(pool)
  const userId = params?.user_id ? Math.max(1, Math.floor(params.user_id)) : null
  const where = userId ? 'WHERE user_id = ?' : ''
  const values = userId ? [userId] : []
  let rows: RowDataPacket[]
  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT id, user_id, promo_code, redeemed_at, free_until, unlimited, active, promo_note
       FROM ${TBL_REDS()} ${where}
       ORDER BY redeemed_at DESC LIMIT 500`,
      values
    )
    rows = r
  } catch (e: unknown) {
    // Schéma legacy : certaines DB avaient `code` au lieu de `promo_code`.
    const msg = String((e as Error)?.message ?? '')
    if (msg.includes('Unknown column') && msg.includes('promo_code')) {
      const [r] = await pool.execute<RowDataPacket[]>(
        `SELECT id, user_id, code as promo_code, redeemed_at, free_until, unlimited, active, promo_note
         FROM ${TBL_REDS()} ${where}
         ORDER BY redeemed_at DESC LIMIT 500`,
        values
      )
      rows = r
    } else {
      throw e
    }
  }
  return rows.map((r) => ({
    id: Number(r.id),
    user_id: Number(r.user_id),
    promo_code: String(r.promo_code),
    redeemed_at: r.redeemed_at ? new Date(r.redeemed_at).toISOString() : new Date().toISOString(),
    free_until: r.free_until ? new Date(r.free_until).toISOString() : null,
    unlimited: Boolean(r.unlimited),
    active: Boolean(r.active),
    promo_note: r.promo_note != null ? String(r.promo_note) : null,
  }))
}

export async function assignAccessByCode(userId: number, code: string): Promise<{ ok: boolean }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  const pool = getPool()
  await ensurePromoTables(pool)

  const c = code.trim().toUpperCase()
  const [codeRows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, duration_days, max_uses, uses_count, expires_at, note
     FROM ${TBL_CODES()} WHERE code = ? LIMIT 1`,
    [c]
  )
  const row = codeRows?.[0]
  if (!row) throw new Error('Code introuvable')
  if (row.expires_at && new Date(row.expires_at) < new Date()) throw new Error('Code expiré')
  if (row.max_uses != null && Number(row.uses_count ?? 0) >= Number(row.max_uses)) throw new Error('Code épuisé')

  const durationDays = row.duration_days != null ? Math.max(1, Number(row.duration_days)) : null
  const unlimited = durationDays == null
  const freeUntil = unlimited ? null : addDaysSql(durationDays)
  const note = row.note != null ? String(row.note) : null

  // Désactive les précédents accès actifs du user (un seul "actif" à la fois dans l'UI)
  await pool.execute(`UPDATE ${TBL_REDS()} SET active = 0 WHERE user_id = ? AND active = 1`, [userId])

  await pool.execute<ResultSetHeader>(
    `INSERT INTO ${TBL_REDS()} (user_id, code_id, promo_code, free_until, unlimited, active, promo_note)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [userId, Number(row.id), c, freeUntil, unlimited ? 1 : 0, note]
  )
  await pool.execute(`UPDATE ${TBL_CODES()} SET uses_count = uses_count + 1 WHERE id = ?`, [Number(row.id)])
  return { ok: true }
}

export async function assignAccessDirect(input: {
  user_id: number
  free_until?: string | null
  unlimited?: boolean
  promo_note?: string | null
}): Promise<{ ok: boolean }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  const pool = getPool()
  await ensurePromoTables(pool)
  const userId = Math.max(1, Math.floor(input.user_id))
  const unlimited = !!input.unlimited
  const freeUntil = unlimited ? null : (input.free_until ? String(input.free_until).slice(0, 19).replace('T', ' ') : null)
  if (!unlimited && !freeUntil) throw new Error('free_until requis si pas illimité')

  await pool.execute(`UPDATE ${TBL_REDS()} SET active = 0 WHERE user_id = ? AND active = 1`, [userId])
  await pool.execute<ResultSetHeader>(
    `INSERT INTO ${TBL_REDS()} (user_id, code_id, promo_code, redeemed_at, free_until, unlimited, active, promo_note)
     VALUES (?, NULL, '—', ?, ?, ?, 1, ?)`,
    [userId, nowSql(), freeUntil, unlimited ? 1 : 0, input.promo_note ?? null]
  )
  return { ok: true }
}

export async function removeRedemption(id: number): Promise<{ deleted: boolean }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  const pool = getPool()
  await ensurePromoTables(pool)
  const rid = Math.max(1, Math.floor(id))
  const [res] = await pool.execute<ResultSetHeader>(`DELETE FROM ${TBL_REDS()} WHERE id = ?`, [rid])
  return { deleted: (res.affectedRows ?? 0) > 0 }
}

