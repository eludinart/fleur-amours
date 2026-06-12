/**
 * Timeline relationnelle unifiée — MariaDB.
 *
 * Table `fleur_timeline_events` : journal d'événements réagrégés (session, tirage,
 * fleur, check-in, exercice couple, rituel) servant à narrer l'évolution dans le
 * temps sans recalcul, pour Éclosion (individuel), Couple et Mycelium (agrégats).
 *
 * Conventions : voir db.ts (`table()` préfixe, `getPool`, `isDbConfigured`).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'

export type TimelineSource =
  | 'session'
  | 'tirage'
  | 'fleur'
  | 'checkin'
  | 'dyad'
  | 'ritual'
  | 'onboarding'
  | 'dreamscape'
  | 'diagnostic'

export type TimelineEvent = {
  id: number
  userId: number
  source: TimelineSource
  refId: number | null
  title: string
  summary: string | null
  petals: number[] | null
  mood: number | null
  createdAt: string
}

const TBL = () => table('fleur_timeline_events')

let _ensurePromise: Promise<void> | null = null

export function ensureTimelineTable(): Promise<void> {
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
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TBL()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      source VARCHAR(24) NOT NULL DEFAULT 'session',
      ref_id INT DEFAULT NULL,
      title VARCHAR(255) NOT NULL DEFAULT '',
      summary TEXT DEFAULT NULL,
      petals_json TEXT DEFAULT NULL,
      mood TINYINT DEFAULT NULL,
      org_id INT DEFAULT NULL,
      team_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX uq_user_source_ref (user_id, source, ref_id),
      INDEX idx_user_created (user_id, created_at),
      INDEX idx_source (source),
      INDEX idx_org_team (org_id, team_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  // Migration idempotente pour les tables existantes (ref_id NULL reste multi-insérable).
  await pool
    .execute(`ALTER TABLE ${TBL()} ADD UNIQUE INDEX IF NOT EXISTS uq_user_source_ref (user_id, source, ref_id)`)
    .catch(() => {
      /* doublons historiques : l'index sera posé après nettoyage manuel */
    })
}

/**
 * Journalise un événement de timeline. Idempotence légère : si (user, source, ref_id)
 * existe déjà, on ne duplique pas (utile quand une session est resauvegardée).
 */
export async function recordTimelineEvent(input: {
  userId: number
  source: TimelineSource
  refId?: number | null
  title: string
  summary?: string | null
  petals?: number[] | null
  mood?: number | null
  orgId?: number | null
  teamId?: number | null
  /** Date réelle de l'événement (réimport historique). */
  occurredAt?: string | Date | null
}): Promise<{ id: number | null }> {
  if (!isDbConfigured()) return { id: null }
  if (!Number.isFinite(input.userId) || input.userId <= 0) return { id: null }
  await ensureTimelineTable()
  const pool = getPool()

  if (input.refId != null) {
    const [dup] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM ${TBL()} WHERE user_id = ? AND source = ? AND ref_id = ? LIMIT 1`,
      [input.userId, input.source, input.refId]
    )
    if (dup?.length) return { id: Number(dup[0].id) }
  }

  const occurred =
    input.occurredAt != null
      ? input.occurredAt instanceof Date
        ? input.occurredAt
        : new Date(String(input.occurredAt).replace(' ', 'T'))
      : null
  const occurredSql =
    occurred && !isNaN(occurred.getTime())
      ? occurred.toISOString().slice(0, 19).replace('T', ' ')
      : null

  let res: unknown
  try {
    if (occurredSql) {
      ;[res] = await exec(
        pool,
        `INSERT INTO ${TBL()} (user_id, source, ref_id, title, summary, petals_json, mood, org_id, team_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.userId,
          input.source,
          input.refId ?? null,
          String(input.title ?? '').slice(0, 255),
          input.summary ?? null,
          input.petals ? JSON.stringify(input.petals) : null,
          input.mood ?? null,
          input.orgId ?? null,
          input.teamId ?? null,
          occurredSql,
        ]
      )
    } else {
      ;[res] = await exec(
        pool,
        `INSERT INTO ${TBL()} (user_id, source, ref_id, title, summary, petals_json, mood, org_id, team_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.userId,
          input.source,
          input.refId ?? null,
          String(input.title ?? '').slice(0, 255),
          input.summary ?? null,
          input.petals ? JSON.stringify(input.petals) : null,
          input.mood ?? null,
          input.orgId ?? null,
          input.teamId ?? null,
        ]
      )
    }
  } catch (err: unknown) {
    // Course concurrente sur l'index UNIQUE : l'événement existe déjà.
    if ((err as { code?: string })?.code === 'ER_DUP_ENTRY' && input.refId != null) {
      const [dup] = await pool.execute<RowDataPacket[]>(
        `SELECT id FROM ${TBL()} WHERE user_id = ? AND source = ? AND ref_id = ? LIMIT 1`,
        [input.userId, input.source, input.refId]
      )
      return { id: dup?.length ? Number(dup[0].id) : null }
    }
    throw err
  }
  return { id: Number((res as ResultSetHeader).insertId) }
}

function mapRow(r: RowDataPacket): TimelineEvent {
  let petals: number[] | null = null
  if (r.petals_json) {
    try {
      const parsed = JSON.parse(r.petals_json)
      if (Array.isArray(parsed)) petals = parsed.map((n: unknown) => Number(n) || 0)
    } catch {
      petals = null
    }
  }
  return {
    id: Number(r.id),
    userId: Number(r.user_id),
    source: r.source as TimelineSource,
    refId: r.ref_id != null ? Number(r.ref_id) : null,
    title: String(r.title ?? ''),
    summary: r.summary ?? null,
    petals,
    mood: r.mood != null ? Number(r.mood) : null,
    createdAt: String(r.created_at ?? ''),
  }
}

const TBL_NARR = () => table('fleur_timeline_narratives')

let _ensureNarrPromise: Promise<void> | null = null

function ensureNarrativeTable(): Promise<void> {
  if (!isDbConfigured()) return Promise.resolve()
  if (!_ensureNarrPromise) {
    _ensureNarrPromise = getPool()
      .execute(`
        CREATE TABLE IF NOT EXISTS ${TBL_NARR()} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          signature VARCHAR(64) NOT NULL,
          locale VARCHAR(8) NOT NULL DEFAULT 'fr',
          narrative_json MEDIUMTEXT NOT NULL,
          provider VARCHAR(40) DEFAULT NULL,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_user_locale (user_id, locale),
          INDEX idx_signature (signature)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      .then(() => undefined)
      .catch((err) => {
        _ensureNarrPromise = null
        throw err
      })
  }
  return _ensureNarrPromise
}

/**
 * Lit une narration de timeline en cache si la signature (état des événements)
 * correspond — évite de rappeler le modèle pour un état déjà calculé.
 */
export async function getCachedNarrative(
  userId: number,
  locale: string,
  signature: string
): Promise<Record<string, unknown> | null> {
  if (!isDbConfigured()) return null
  await ensureNarrativeTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT narrative_json FROM ${TBL_NARR()} WHERE user_id = ? AND locale = ? AND signature = ? LIMIT 1`,
    [userId, locale, signature]
  )
  if (!rows?.length) return null
  try {
    return JSON.parse(rows[0].narrative_json)
  } catch {
    return null
  }
}

/** Écrit (ou remplace) la narration en cache pour (user, locale). */
export async function setCachedNarrative(
  userId: number,
  locale: string,
  signature: string,
  narrative: Record<string, unknown>,
  provider: string
): Promise<void> {
  if (!isDbConfigured()) return
  await ensureNarrativeTable()
  const pool = getPool()
  const json = JSON.stringify({ ...narrative, cached_at: new Date().toISOString(), provider })
  await exec(
    pool,
    `INSERT INTO ${TBL_NARR()} (user_id, signature, locale, narrative_json, provider)
       VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE signature = VALUES(signature), narrative_json = VALUES(narrative_json),
       provider = VALUES(provider), cached_at = CURRENT_TIMESTAMP`,
    [userId, signature, locale, json, provider]
  )
}

/** Signature de l'état de timeline : dernier id + nombre d'événements. */
export function timelineSignature(events: TimelineEvent[]): string {
  const count = events.length
  const lastId = events[0]?.id ?? 0
  return `${count}:${lastId}`
}

/** Timeline d'un utilisateur (ordre chronologique inverse). */
export async function getUserTimeline(
  userId: number,
  limit = 60
): Promise<TimelineEvent[]> {
  if (!isDbConfigured()) return []
  if (!Number.isFinite(userId) || userId <= 0) return []
  await ensureTimelineTable()
  const pool = getPool()
  const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 60, 1), 200)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${TBL()} WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ${safeLimit}`,
    [userId]
  )
  return rows.map(mapRow)
}
