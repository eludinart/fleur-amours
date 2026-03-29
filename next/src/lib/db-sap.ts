/**
 * Sève SAP — source de vérité : `fleur_users_access` (Sablier + Cristal).
 * `fleur_sap_wallets` est un miroir (somme) pour stats / compatibilité.
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

async function ensureAccessRowExec(exec: SqlExecutor, userId: number): Promise<void> {
  await exec.execute(
    `INSERT IGNORE INTO ${TBL_ACCESS()} (user_id, token_balance, eternal_sap) VALUES (?, 0, 0)`,
    [userId]
  )
}

/** Somme Sablier + Cristal (sève disponible telle qu’affichée dans l’UI). */
export async function readLegacySapSum(exec: SqlExecutor, userId: number): Promise<number> {
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

async function upsertWalletMirror(exec: SqlExecutor, userId: number, balance: number): Promise<void> {
  const b = Math.max(0, Math.floor(balance))
  await exec.execute(
    `INSERT INTO ${TBL_WALLET()} (user_id, balance) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE balance = VALUES(balance), updated_at = NOW()`,
    [userId, b]
  )
}

/**
 * Recalcule le miroir wallet depuis l’accès (après crédit admin qui ne passe pas par transactionalSapUpdate).
 */
export async function syncSapWalletFromAccess(userId: number): Promise<number> {
  if (!isDbConfigured()) return 0
  const pool = getPool()
  await ensureSapTables(pool)
  const sum = await readLegacySapSum(pool, userId)
  await upsertWalletMirror(pool, userId, sum)
  return sum
}

/**
 * Garantit une ligne wallet alignée sur l’accès (pour code legacy qui appelle ensureWalletRow seul).
 */
export async function ensureWalletRow(pool: Pool, userId: number): Promise<void> {
  await ensureSapTables(pool)
  await ensureAccessRowExec(pool, userId)
  const sum = await readLegacySapSum(pool, userId)
  await upsertWalletMirror(pool, userId, sum)
}

/** Solde spendable = Sablier + Cristal (même chiffre que la jauge). */
export async function getSapBalance(userId: number): Promise<number> {
  if (!isDbConfigured()) return 0
  const pool = getPool()
  await ensureSapTables(pool)
  await ensureAccessRowExec(pool, userId)
  const sum = await readLegacySapSum(pool, userId)
  await upsertWalletMirror(pool, userId, sum)
  return sum
}

/**
 * Débit : d’abord le Sablier (token_balance), puis le Cristal (eternal_sap).
 */
function applyDebitToTbEs(tb: number, es: number, debit: number): { tb: number; es: number } {
  let rem = Math.floor(debit)
  let t = Math.max(0, Math.floor(tb))
  let e = Math.max(0, Math.floor(es))
  const fromT = Math.min(rem, t)
  t -= fromT
  rem -= fromT
  const fromE = Math.min(rem, e)
  e -= fromE
  return { tb: t, es: e }
}

/**
 * usage = débit depuis l’accès ; purchase/bonus = crédit sur le Sablier puis miroir wallet.
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
    await ensureAccessRowExec(conn, userId)

    if (type === 'usage') {
      const [locked] = await conn.execute<RowDataPacket[]>(
        `SELECT token_balance, eternal_sap FROM ${TBL_ACCESS()} WHERE user_id = ? FOR UPDATE`,
        [userId]
      )
      const r = locked?.[0]
      if (!r) {
        await conn.rollback()
        throw new SapError('Accès utilisateur introuvable', 'DB')
      }
      let tb = Math.max(0, Number(r.token_balance) || 0)
      let es = Math.max(0, Number(r.eternal_sap) || 0)
      const total = tb + es
      if (total < amt) {
        await conn.rollback()
        throw new SapError('Solde SAP insuffisant', 'INSUFFICIENT')
      }
      const out = applyDebitToTbEs(tb, es, amt)
      tb = out.tb
      es = out.es
      await conn.execute(
        `UPDATE ${TBL_ACCESS()} SET token_balance = ?, eternal_sap = ?, updated_at = NOW() WHERE user_id = ?`,
        [tb, es, userId]
      )
      const newSum = tb + es
      await upsertWalletMirror(conn, userId, newSum)
      await conn.execute(
        `INSERT INTO ${TBL_TX()} (user_id, amount, type, reason) VALUES (?, ?, 'usage', ?)`,
        [userId, amt, String(reason || '').slice(0, 255)]
      )
      await conn.commit()
      return { balance: newSum }
    }

    // Crédit (achat Stripe, bonus coach) : tout sur le Sablier (cohérent avec l’UI « recharge »)
    const [before] = await conn.execute<RowDataPacket[]>(
      `SELECT token_balance, eternal_sap FROM ${TBL_ACCESS()} WHERE user_id = ? FOR UPDATE`,
      [userId]
    )
    const row = before?.[0]
    let tb = Math.max(0, Number(row?.token_balance) || 0)
    const es = Math.max(0, Number(row?.eternal_sap) || 0)
    tb += amt
    await conn.execute(
      `UPDATE ${TBL_ACCESS()} SET token_balance = ?, updated_at = NOW() WHERE user_id = ?`,
      [tb, userId]
    )
    const newSum = tb + es
    await upsertWalletMirror(conn, userId, newSum)
    await conn.execute(
      `INSERT INTO ${TBL_TX()} (user_id, amount, type, reason) VALUES (?, ?, ?, ?)`,
      [userId, amt, type, String(reason || '').slice(0, 255)]
    )
    await conn.commit()
    return { balance: newSum }
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

export async function sapUsageReasonExists(reason: string): Promise<boolean> {
  if (!isDbConfigured() || !reason) return false
  const pool = getPool()
  await ensureSapTables(pool)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM ${TBL_TX()} WHERE type = 'usage' AND reason = ? LIMIT 1`,
    [reason.slice(0, 255)]
  )
  return Array.isArray(rows) && rows.length > 0
}

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
 * Retire jusqu'à `maxAmount` (remboursement Stripe) : débit depuis l’accès comme un usage.
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
    await ensureAccessRowExec(conn, userId)

    const [locked] = await conn.execute<RowDataPacket[]>(
      `SELECT token_balance, eternal_sap FROM ${TBL_ACCESS()} WHERE user_id = ? FOR UPDATE`,
      [userId]
    )
    const r = locked?.[0]
    if (!r) {
      await conn.rollback()
      return { debited: 0, balance: 0 }
    }
    let tb = Math.max(0, Number(r.token_balance) || 0)
    let es = Math.max(0, Number(r.eternal_sap) || 0)
    const total = tb + es
    const debited = Math.min(total, cap)
    if (debited <= 0) {
      await conn.commit()
      return { debited: 0, balance: total }
    }
    const out = applyDebitToTbEs(tb, es, debited)
    tb = out.tb
    es = out.es
    await conn.execute(
      `UPDATE ${TBL_ACCESS()} SET token_balance = ?, eternal_sap = ?, updated_at = NOW() WHERE user_id = ?`,
      [tb, es, userId]
    )
    const newSum = tb + es
    await upsertWalletMirror(conn, userId, newSum)
    await conn.execute(
      `INSERT INTO ${TBL_TX()} (user_id, amount, type, reason) VALUES (?, ?, 'usage', ?)`,
      [userId, debited, String(reason || '').slice(0, 255)]
    )
    await conn.commit()
    return { debited, balance: newSum }
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
