/**
 * Ligne de base diagnostique (onboarding) — MariaDB.
 *
 * Table `fleur_baselines` : capture une fois la "fleur de départ" mesurable d'un
 * utilisateur (8 pétales 0..1) pour mesurer ensuite la progression. Une seule
 * ligne de base par utilisateur (la première est conservée).
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'
import { PETAL_ORDER_IDS } from './petal-theme'

const TBL = () => table('fleur_baselines')

export type Baseline = {
  petals: Record<string, number>
  intention: string | null
  createdAt: string
}

let _ensurePromise: Promise<void> | null = null

export function ensureBaselineTable(): Promise<void> {
  if (!isDbConfigured()) return Promise.resolve()
  if (!_ensurePromise) {
    _ensurePromise = getPool()
      .execute(`
        CREATE TABLE IF NOT EXISTS ${TBL()} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          petals_json TEXT NOT NULL,
          intention VARCHAR(500) DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      .then(() => undefined)
      .catch((err) => {
        _ensurePromise = null
        throw err
      })
  }
  return _ensurePromise
}

function normalizePetals(input: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  for (const id of PETAL_ORDER_IDS) {
    const v = Number(src[id])
    out[id] = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
  }
  return out
}

export async function getBaseline(userId: number): Promise<Baseline | null> {
  if (!isDbConfigured()) return null
  await ensureBaselineTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT petals_json, intention, created_at FROM ${TBL()} WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  if (!rows?.length) return null
  let petals: Record<string, number> = {}
  try {
    petals = normalizePetals(JSON.parse(rows[0].petals_json))
  } catch {
    petals = {}
  }
  return {
    petals,
    intention: rows[0].intention ?? null,
    createdAt: String(rows[0].created_at ?? ''),
  }
}

/**
 * Enregistre la ligne de base si elle n'existe pas encore (INSERT IGNORE-like).
 * Retourne la baseline effective (existante ou nouvellement créée).
 */
export async function saveBaseline(input: {
  userId: number
  petals: unknown
  intention?: string | null
}): Promise<{ created: boolean; baseline: Baseline }> {
  if (!isDbConfigured()) throw new Error('DB non configurée')
  await ensureBaselineTable()
  const existing = await getBaseline(input.userId)
  if (existing) return { created: false, baseline: existing }

  const pool = getPool()
  const petals = normalizePetals(input.petals)
  const intention = input.intention != null ? String(input.intention).slice(0, 500) : null
  await exec(
    pool,
    `INSERT INTO ${TBL()} (user_id, petals_json, intention) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [input.userId, JSON.stringify(petals), intention]
  )
  const baseline = (await getBaseline(input.userId)) ?? {
    petals,
    intention,
    createdAt: new Date().toISOString(),
  }
  return { created: true, baseline }
}
