/**
 * CRUD prompts Tuteur / Seuil en MariaDB (USE_NODE_API).
 * Tables : fleur_ai_prompts, fleur_ai_prompts_active
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table, isDbConfigured } from './db'

const TBL = () => table('fleur_ai_prompts')
const TBL_ACTIVE = () => table('fleur_ai_prompts_active')
const TBL_OVERRIDES = () => table('fleur_ai_prompt_overrides')

async function ensureTables() {
  if (!isDbConfigured()) return false
  const pool = getPool()
  const prefix = process.env.DB_PREFIX || 'wp_'
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_ai_prompts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      content LONGTEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY (type, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_ai_prompts_active (
      id INT PRIMARY KEY DEFAULT 1,
      active_tuteur_id INT NULL,
      active_threshold_id INT NULL,
      active_coach_id INT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  // Compatibilité DB : si la table existait avant l'ajout de coach
  try {
    await pool.execute(
      `ALTER TABLE ${prefix}fleur_ai_prompts_active ADD active_coach_id INT NULL`
    )
  } catch {
    // ignore si la colonne existe déjà
  }
  try {
    await pool.execute(`INSERT IGNORE INTO ${TBL_ACTIVE()} (id) VALUES (1)`)
  } catch {
    // ignorer si existe
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${prefix}fleur_ai_prompt_overrides (
      k VARCHAR(64) PRIMARY KEY,
      content LONGTEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  return true
}

export interface PromptRow extends RowDataPacket {
  id: number
  type: string
  name: string
  content: string
  created_at: string
  updated_at: string
}

export interface ActiveRow extends RowDataPacket {
  active_tuteur_id: number | null
  active_threshold_id: number | null
  active_coach_id: number | null
}

export async function listPrompts(type?: 'tuteur' | 'threshold' | 'coach') {
  if (!(await ensureTables())) {
    return {
      prompts: [],
      active: { active_tuteur_id: null, active_threshold_id: null, active_coach_id: null },
      db_configured: false,
    }
  }
  const pool = getPool()
  let sql = `SELECT id, type, name, content, created_at, updated_at FROM ${TBL()}`
  const params: string[] = []
  if (type) {
    sql += ' WHERE type = ?'
    params.push(type)
  }
  sql += ' ORDER BY type, name'
  const [rows] = await pool.execute<PromptRow[]>(sql, params.length ? params : undefined)
  const [activeRows] = await pool.execute<ActiveRow[]>(
    `SELECT active_tuteur_id, active_threshold_id, active_coach_id FROM ${TBL_ACTIVE()} WHERE id = 1`
  )
  const active = activeRows[0] ?? { active_tuteur_id: null, active_threshold_id: null, active_coach_id: null }
  return { prompts: Array.isArray(rows) ? rows : [], active, db_configured: true }
}

export async function createPrompt(type: string, name: string, content: string) {
  await ensureTables()
  const pool = getPool()
  await pool.execute(
    `INSERT INTO ${TBL()} (type, name, content) VALUES (?, ?, ?)`,
    [type, name, content]
  )
  return pool.execute('SELECT LAST_INSERT_ID() as id').then(([r]) => {
    const rows = r as { id: number }[]
    return rows[0]?.id ?? 0
  })
}

export async function updatePrompt(id: number, name: string, content: string) {
  await ensureTables()
  const pool = getPool()
  await pool.execute(`UPDATE ${TBL()} SET name = ?, content = ? WHERE id = ?`, [name, content, id])
}

export async function deletePrompt(id: number) {
  await ensureTables()
  const pool = getPool()
  await pool.execute(`UPDATE ${TBL_ACTIVE()} SET active_tuteur_id = NULL WHERE active_tuteur_id = ?`, [id])
  await pool.execute(`UPDATE ${TBL_ACTIVE()} SET active_threshold_id = NULL WHERE active_threshold_id = ?`, [id])
  await pool.execute(`UPDATE ${TBL_ACTIVE()} SET active_coach_id = NULL WHERE active_coach_id = ?`, [id])
  await pool.execute(`DELETE FROM ${TBL()} WHERE id = ?`, [id])
}

export async function setActivePrompts(
  activeTuteurId: number | null,
  activeThresholdId: number | null,
  activeCoachId: number | null
) {
  await ensureTables()
  const pool = getPool()
  await pool.execute(
    `UPDATE ${TBL_ACTIVE()} SET active_tuteur_id = ?, active_threshold_id = ?, active_coach_id = ? WHERE id = 1`,
    [activeTuteurId, activeThresholdId, activeCoachId]
  )
}

export async function importContent(
  tuteurContent: string,
  thresholdContent: string,
  coachContent = '',
  nameTuteur = 'Par défaut (Tuteur)',
  nameThreshold = 'Par défaut (Seuil)',
  nameCoach = 'Par défaut (Coach)'
) {
  if (!(await ensureTables())) {
    throw new Error('Base MariaDB non configurée (MARIADB_HOST, MARIADB_PASSWORD, etc.)')
  }
  const pool = getPool()
  const ids = { tuteur_id: null as number | null, threshold_id: null as number | null, coach_id: null as number | null }

  if (tuteurContent) {
    await pool.execute(
      `INSERT INTO ${TBL()} (type, name, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)`,
      ['tuteur', nameTuteur, tuteurContent]
    )
    const [r] = await pool.execute<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM ${TBL()} WHERE type = 'tuteur' AND name = ?`,
      [nameTuteur]
    )
    ids.tuteur_id = Array.isArray(r) && r[0] ? (r[0] as { id: number }).id : null
  }
  if (thresholdContent) {
    await pool.execute(
      `INSERT INTO ${TBL()} (type, name, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)`,
      ['threshold', nameThreshold, thresholdContent]
    )
    const [r] = await pool.execute<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM ${TBL()} WHERE type = 'threshold' AND name = ?`,
      [nameThreshold]
    )
    ids.threshold_id = Array.isArray(r) && r[0] ? (r[0] as { id: number }).id : null
  }

  if (coachContent) {
    await pool.execute(
      `INSERT INTO ${TBL()} (type, name, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)`,
      ['coach', nameCoach, coachContent]
    )
    const [r] = await pool.execute<(RowDataPacket & { id: number })[]>(
      `SELECT id FROM ${TBL()} WHERE type = 'coach' AND name = ?`,
      [nameCoach]
    )
    ids.coach_id = Array.isArray(r) && r[0] ? (r[0] as { id: number }).id : null
  }

  // Activer les nouveaux prompts
  if (ids.tuteur_id || ids.threshold_id || ids.coach_id) {
    const [activeRows] = await pool.execute<ActiveRow[]>(
      `SELECT active_tuteur_id, active_threshold_id, active_coach_id FROM ${TBL_ACTIVE()} WHERE id = 1`
    )
    const cur = activeRows[0]
    const tid = ids.tuteur_id ?? cur?.active_tuteur_id ?? null
    const thid = ids.threshold_id ?? cur?.active_threshold_id ?? null
    const cid = ids.coach_id ?? cur?.active_coach_id ?? null
    await pool.execute(
      `UPDATE ${TBL_ACTIVE()} SET active_tuteur_id = ?, active_threshold_id = ?, active_coach_id = ? WHERE id = 1`,
      [tid, thid, cid]
    )
  }
  return ids
}

export async function seedDefaults(tuteurContent: string, thresholdContent: string, coachContent: string) {
  return importContent(
    tuteurContent,
    thresholdContent,
    coachContent,
    'Par défaut (Tuteur)',
    'Par défaut (Seuil)',
    'Par défaut (Coach)'
  )
}

export async function getActiveContent() {
  if (!(await ensureTables())) return { tuteur: null, threshold: null, coach: null }
  const pool = getPool()
  const [activeRows] = await pool.execute<ActiveRow[]>(
    `SELECT active_tuteur_id, active_threshold_id, active_coach_id FROM ${TBL_ACTIVE()} WHERE id = 1`
  )
  const active = activeRows[0]
  let tuteur: string | null = null
  let threshold: string | null = null
  let coach: string | null = null
  if (active?.active_tuteur_id) {
    const [r] = await pool.execute<(RowDataPacket & { content: string })[]>(
      `SELECT content FROM ${TBL()} WHERE id = ? AND type = 'tuteur'`,
      [active.active_tuteur_id]
    )
    tuteur = Array.isArray(r) && r[0] ? (r[0] as { content: string }).content : null
  }
  if (active?.active_threshold_id) {
    const [r] = await pool.execute<(RowDataPacket & { content: string })[]>(
      `SELECT content FROM ${TBL()} WHERE id = ? AND type = 'threshold'`,
      [active.active_threshold_id]
    )
    threshold = Array.isArray(r) && r[0] ? (r[0] as { content: string }).content : null
  }
  if (active?.active_coach_id) {
    const [r] = await pool.execute<(RowDataPacket & { content: string })[]>(
      `SELECT content FROM ${TBL()} WHERE id = ? AND type = 'coach'`,
      [active.active_coach_id]
    )
    coach = Array.isArray(r) && r[0] ? (r[0] as { content: string }).content : null
  }
  return { tuteur, threshold, coach }
}

export async function getPromptOverride(key: string): Promise<string | null> {
  if (!(await ensureTables())) return null
  const pool = getPool()
  const k = String(key || '').trim()
  if (!k) return null
  const [rows] = await pool.execute<(RowDataPacket & { content: string })[]>(
    `SELECT content FROM ${TBL_OVERRIDES()} WHERE k = ?`,
    [k]
  )
  return Array.isArray(rows) && rows[0] ? String((rows[0] as { content: string }).content ?? '') : null
}

export async function setPromptOverride(key: string, content: string): Promise<void> {
  if (!(await ensureTables())) {
    throw new Error('Base MariaDB non configurée (MARIADB_HOST, MARIADB_PASSWORD, etc.)')
  }
  const pool = getPool()
  const k = String(key || '').trim()
  if (!k) throw new Error('Clé override manquante')
  const c = String(content ?? '')
  await pool.execute(
    `INSERT INTO ${TBL_OVERRIDES()} (k, content) VALUES (?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)`,
    [k, c]
  )
}
