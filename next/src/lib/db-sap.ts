/**
 * Sève SAP — portefeuille unitaire + journal (MariaDB, mysql2/promise).
 */
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { getPool, isDbConfigured, table } from '@/lib/db'

type SqlExecutor = Pick<Pool, 'execute'>

export type SapTransactionType = 'purchase' | 'usage' | 'bonus'

export const TUTEUR_SAP_COST = 5

/** Coûts SAP par clé d'action (API /api/sap/*). */
export const SAP_ACTION_COSTS: Record<string, number> = {
  tuteur_turn: TUTEUR_SAP_COST,
  draw_card: 5,
  open_door: 15,
}

const TBL_WALLET = () => table('fleur_sap_wallets')
const TBL_TX = () => table('fleur_sap_transactions')
const TBL_ACCESS = () => table('fleur_users_access')

export async function ensureSapTables(pool: Pool): Promise<void> {
  const prefix = process.env.DB_PREFIX || 'wp_'
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_sap_wallets (
      user_id INT NOT NULL PRIMARY KEY,
      balance INT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_sap_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      amount INT NOT NULL,
      type ENUM('purchase', 'usage', 'bonus') NOT NULL,
      reason VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

class SapError extends Error {
  constructor(
    message: string,
    public code: 'INSUFFICIENT' | 'INVALID' | 'DB'
  ) {
    super(message)
  }
}

/** Solde depuis fleur_users_access (Sablier + Cristal) pour initialiser le wallet une fois. */
async function readLegacySapSum(exec: SqlExecutor, userId: number): Promise<number> {
  try {
    const [rows] = await exec.execute<RowDataPacket[]>(
      `SELECT token_balance, eternal_sap FROM ${TBL_ACCESS()} WHERE user_id = ? LIMIT 1`,
      [userId]
    )
    const r = rows?.[0]
    if (!r) return 0
    return Math.max(0, (Number(r.token_balance) || 0) + (Number(r.eternal_sap) || 0))
  } catch {
    return 0
  }
}

/**
 * Garantit une ligne wallet ; au premier insert, reprend la somme legacy (access) si disponible.
 */
export async function ensureWalletRow(pool: Pool, userId: number): Promise<void> {
  await ensureSapTables(pool)
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id FROM ${TBL_WALLET()} WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  if (existing?.length) return

  const legacy = await readLegacySapSum(pool, userId)
  await pool.execute(`INSERT INTO ${TBL_WALLET()} (user_id, balance) VALUES (?, ?)`, [userId, legacy])
}

/** Solde actuel (sans transaction). */
export async function getSapBalance(userId: number): Promise<number> {
  if (!isDbConfigured()) return 0
  const pool = getPool()
  await ensureWalletRow(pool, userId)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT balance FROM ${TBL_WALLET()} WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  const b = rows?.[0]?.balance
  return Math.max(0, Number(b) || 0)
}

/**
 * Mise à jour atomique : usage = débit (amount > 0), purchase/bonus = crédit.
 * Verrouillage de ligne (SELECT … FOR UPDATE) pour limiter les courses critiques.
 */
export async function transactionalSapUpdate(
  userId: number,
  amount: number,
  reason: string,
  type: SapTransactionType
): Promise<{ balance: number }> {
  if (!isDbConfigured()) {
    throw new SapError('Base non configurée', 'DB')
  }
  if (!userId || amount < 0 || !Number.isFinite(amount)) {
    throw new SapError('Paramètres invalides', 'INVALID')
  }
  const amt = Math.floor(amount)
  if (amt <= 0) {
    throw new SapError('Montant invalide', 'INVALID')
  }

  const pool = getPool()
  await ensureSapTables(pool)

  const conn = await pool.getConnection() as PoolConnection
  try {
    await conn.beginTransaction()

    let [locked] = await conn.execute<RowDataPacket[]>(
      `SELECT balance FROM ${TBL_WALLET()} WHERE user_id = ? FOR UPDATE`,
      [userId]
    )
    if (!locked?.length) {
      const legacy = await readLegacySapSum(conn, userId)
      await conn.execute(`INSERT INTO ${TBL_WALLET()} (user_id, balance) VALUES (?, ?)`, [userId, legacy])
      ;[locked] = await conn.execute<RowDataPacket[]>(
        `SELECT balance FROM ${TBL_WALLET()} WHERE user_id = ? FOR UPDATE`,
        [userId]
      )
    }

    const row = locked?.[0]
    if (!row) {
      throw new SapError('Wallet introuvable', 'DB')
    }

    let balance = Math.max(0, Number(row.balance) || 0)

    if (type === 'usage') {
      if (balance < amt) {
        await conn.rollback()
        throw new SapError('Solde SAP insuffisant', 'INSUFFICIENT')
      }
      balance -= amt
      await conn.execute(`UPDATE ${TBL_WALLET()} SET balance = ?, updated_at = NOW() WHERE user_id = ?`, [
        balance,
        userId,
      ])
      await conn.execute(
        `INSERT INTO ${TBL_TX()} (user_id, amount, type, reason) VALUES (?, ?, 'usage', ?)`,
        [userId, amt, String(reason || '').slice(0, 255)]
      )
    } else {
      balance += amt
      await conn.execute(`UPDATE ${TBL_WALLET()} SET balance = ?, updated_at = NOW() WHERE user_id = ?`, [
        balance,
        userId,
      ])
      await conn.execute(
        `INSERT INTO ${TBL_TX()} (user_id, amount, type, reason) VALUES (?, ?, ?, ?)`,
        [userId, amt, type, String(reason || '').slice(0, 255)]
      )
    }

    await conn.commit()
    return { balance }
  } catch (e) {
    await conn.rollback()
    if (e instanceof SapError) throw e
    const err = e as Error
    throw new SapError(err?.message || 'Erreur SAP', 'DB')
  } finally {
    conn.release()
  }
}

export function isSapInsufficientError(e: unknown): boolean {
  return e instanceof SapError && e.code === 'INSUFFICIENT'
}

/** Évite un double crédit si Stripe renvoie le même checkout.session.completed. */
export async function sapPurchaseReasonExists(reason: string): Promise<boolean> {
  if (!isDbConfigured() || !reason) return false
  const pool = getPool()
  await ensureSapTables(pool)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${TBL_TX()} WHERE type = 'purchase' AND reason = ? LIMIT 1`,
    [reason.slice(0, 255)]
  )
  return Array.isArray(rows) && rows.length > 0
}

/**
 * Retire jusqu'à `maxAmount` SAP (solde insuffisant → retire tout le solde).
 * Enregistre une ligne `usage` avec la raison fournie (ex. remboursement Stripe).
 */
export async function sapDebitUpTo(
  userId: number,
  maxAmount: number,
  reason: string
): Promise<{ debited: number; balance: number }> {
  if (!isDbConfigured()) {
    throw new SapError('Base non configurée', 'DB')
  }
  if (!userId || maxAmount < 0 || !Number.isFinite(maxAmount)) {
    throw new SapError('Paramètres invalides', 'INVALID')
  }
  const cap = Math.floor(maxAmount)
  if (cap <= 0) {
    const b = await getSapBalance(userId)
    return { debited: 0, balance: b }
  }

  const pool = getPool()
  await ensureSapTables(pool)
  const conn = await pool.getConnection() as PoolConnection
  try {
    await conn.beginTransaction()

    let [locked] = await conn.execute<RowDataPacket[]>(
      `SELECT balance FROM ${TBL_WALLET()} WHERE user_id = ? FOR UPDATE`,
      [userId]
    )
    if (!locked?.length) {
      await conn.commit()
      return { debited: 0, balance: 0 }
    }

    const balance0 = Math.max(0, Number(locked[0].balance) || 0)
    const debited = Math.min(balance0, cap)
    const balance = balance0 - debited

    if (debited > 0) {
      await conn.execute(`UPDATE ${TBL_WALLET()} SET balance = ?, updated_at = NOW() WHERE user_id = ?`, [
        balance,
        userId,
      ])
      await conn.execute(
        `INSERT INTO ${TBL_TX()} (user_id, amount, type, reason) VALUES (?, ?, 'usage', ?)`,
        [userId, debited, String(reason || '').slice(0, 255)]
      )
    }

    await conn.commit()
    return { debited, balance }
  } catch (e) {
    await conn.rollback()
    if (e instanceof SapError) throw e
    const err = e as Error
    throw new SapError(err?.message || 'Erreur SAP', 'DB')
  } finally {
    conn.release()
  }
}

export { SapError }
