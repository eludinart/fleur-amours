/**
 * Codes promo — MariaDB
 *
 * Tables (créées par migration_v0.7.sql) :
 *   wp_fleur_promo_codes        — définition des codes
 *   wp_fleur_promo_redemptions  — historique des utilisations (1 par user/code max)
 */
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { getPool, table } from './db'

const TBL_CODES = () => table('fleur_promo_codes')
const TBL_REDEMPTIONS = () => table('fleur_promo_redemptions')

export type PromoCode = {
  id: number
  code: string
  description: string | null
  sap_amount: number
  max_uses: number | null
  use_count: number
  expires_at: Date | null
  is_active: boolean
}

export type RedeemError =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'MAX_USES_REACHED'
  | 'ALREADY_USED'

export class PromoError extends Error {
  constructor(
    message: string,
    public code: RedeemError
  ) {
    super(message)
    this.name = 'PromoError'
  }
}

/** Vérifie et consomme un code promo dans une transaction. Retourne les SAP crédités. */
export async function redeemPromoCode(
  promoCodeStr: string,
  userId: number
): Promise<{ sapCredited: number; codeId: number }> {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Verrou en lecture pour éviter la race condition (SELECT ... FOR UPDATE)
    const [codeRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id, code, description, sap_amount, max_uses, use_count,
              expires_at, is_active
       FROM ${TBL_CODES()}
       WHERE code = ?
       LIMIT 1
       FOR UPDATE`,
      [promoCodeStr.trim().toUpperCase()]
    )

    if (!codeRows.length) {
      throw new PromoError('Code promotionnel introuvable.', 'NOT_FOUND')
    }

    const row = codeRows[0]

    if (!row.is_active) {
      throw new PromoError('Ce code promotionnel n\'est plus actif.', 'INACTIVE')
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      throw new PromoError('Ce code promotionnel a expiré.', 'EXPIRED')
    }

    if (row.max_uses !== null && row.use_count >= row.max_uses) {
      throw new PromoError('Ce code a atteint son nombre maximum d\'utilisations.', 'MAX_USES_REACHED')
    }

    // Vérifier si cet utilisateur a déjà utilisé ce code
    const [usedRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id FROM ${TBL_REDEMPTIONS()} WHERE code_id = ? AND user_id = ? LIMIT 1`,
      [row.id, userId]
    )
    if (usedRows.length) {
      throw new PromoError('Vous avez déjà utilisé ce code promotionnel.', 'ALREADY_USED')
    }

    const sapAmount = Number(row.sap_amount) || 0

    // Enregistrer l'utilisation
    await conn.execute<ResultSetHeader>(
      `INSERT INTO ${TBL_REDEMPTIONS()} (code_id, user_id, sap_credited) VALUES (?, ?, ?)`,
      [row.id, userId, sapAmount]
    )

    // Incrémenter le compteur du code
    await conn.execute(
      `UPDATE ${TBL_CODES()} SET use_count = use_count + 1 WHERE id = ?`,
      [row.id]
    )

    await conn.commit()
    return { sapCredited: sapAmount, codeId: Number(row.id) }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/** Liste les codes promo (admin). */
export async function listPromoCodes(): Promise<PromoCode[]> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, code, description, sap_amount, max_uses, use_count, expires_at, is_active
     FROM ${TBL_CODES()}
     ORDER BY id DESC`
  )
  return rows.map((r) => ({
    id: Number(r.id),
    code: String(r.code),
    description: r.description ?? null,
    sap_amount: Number(r.sap_amount),
    max_uses: r.max_uses !== null ? Number(r.max_uses) : null,
    use_count: Number(r.use_count),
    expires_at: r.expires_at ? new Date(r.expires_at) : null,
    is_active: Boolean(r.is_active),
  }))
}

/** Historique des utilisations d'un code (admin). */
export async function listRedemptions(codeId?: number): Promise<RowDataPacket[]> {
  const pool = getPool()
  const where = codeId ? 'WHERE r.code_id = ?' : ''
  const params = codeId ? [codeId] : []
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, r.code_id, c.code, r.user_id, r.sap_credited, r.redeemed_at
     FROM ${TBL_REDEMPTIONS()} r
     JOIN ${TBL_CODES()} c ON c.id = r.code_id
     ${where}
     ORDER BY r.redeemed_at DESC
     LIMIT 500`,
    params
  )
  return rows
}
