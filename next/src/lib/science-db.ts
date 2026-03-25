/**
 * Science de la Fleur — stockage DB (config / evidence / profils).
 *
 * Tables (prefixées via DB_PREFIX) :
 * - fleur_science_config
 * - fleur_science_profiles
 * - fleur_science_evidence
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

const TBL_CONFIG = () => table('fleur_science_config')
const TBL_PROFILES = () => table('fleur_science_profiles')
const TBL_EVIDENCE = () => table('fleur_science_evidence')

export type ScienceSourceKey =
  | 'petals_aggregate_only'
  | 'dreamscape'
  | 'solo_fleur'
  | 'tarot_1card'
  | 'tarot_4doors'
  | 'ma_fleur'
  | 'duo'
  | 'chat_clairiere'
  | 'chat_coach'

export type ScienceConfig = {
  // Seuil de passage Hypothèse -> Fait
  confidence_min_facts: number
  // Seuils de labels d'incertitude
  confidence_low_max: number
  confidence_medium_max: number

  // Sélection des sources
  include_petals_aggregate: boolean
  include_dreamscape: boolean
  include_solo_fleur: boolean
  include_tarot_1card: boolean
  include_tarot_4doors: boolean
  include_ma_fleur: boolean
  include_duo: boolean
  include_chat_clairiere: boolean
  include_chat_coach: boolean

  // Extraction evidence
  evidence_initial_max_messages: number
  evidence_update_max_messages: number

  // Cache côté profil science
  science_profile_ttl_minutes: number
  science_generation_version: string
}

const DEFAULT_CONFIG: ScienceConfig = {
  confidence_min_facts: 0.6,
  confidence_low_max: 0.39,
  confidence_medium_max: 0.59,

  include_petals_aggregate: true,
  include_dreamscape: true,
  include_solo_fleur: true,
  include_tarot_1card: true,
  include_tarot_4doors: true,
  include_ma_fleur: true,
  include_duo: true,
  include_chat_clairiere: true,
  include_chat_coach: true,

  evidence_initial_max_messages: 60,
  evidence_update_max_messages: 30,

  science_profile_ttl_minutes: 24 * 60,
  science_generation_version: 'v1',
}

async function ensureTables(): Promise<boolean> {
  if (!isDbConfigured()) return false
  const pool = getPool()

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TBL_CONFIG()} (
      id INT PRIMARY KEY DEFAULT 1,
      confidence_min_facts DECIMAL(4,2) NOT NULL DEFAULT 0.60,
      confidence_low_max DECIMAL(4,2) NOT NULL DEFAULT 0.39,
      confidence_medium_max DECIMAL(4,2) NOT NULL DEFAULT 0.59,

      include_petals_aggregate TINYINT NOT NULL DEFAULT 1,
      include_dreamscape TINYINT NOT NULL DEFAULT 1,
      include_solo_fleur TINYINT NOT NULL DEFAULT 1,
      include_tarot_1card TINYINT NOT NULL DEFAULT 1,
      include_tarot_4doors TINYINT NOT NULL DEFAULT 1,
      include_ma_fleur TINYINT NOT NULL DEFAULT 1,
      include_duo TINYINT NOT NULL DEFAULT 1,
      include_chat_clairiere TINYINT NOT NULL DEFAULT 1,
      include_chat_coach TINYINT NOT NULL DEFAULT 1,

      evidence_initial_max_messages INT NOT NULL DEFAULT 60,
      evidence_update_max_messages INT NOT NULL DEFAULT 30,

      science_profile_ttl_minutes INT NOT NULL DEFAULT 1440,
      science_generation_version VARCHAR(64) NOT NULL DEFAULT 'v1',

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TBL_PROFILES()} (
      user_id INT PRIMARY KEY,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      generation_version VARCHAR(64) NOT NULL DEFAULT 'v1',
      facts_json LONGTEXT NOT NULL,
      hypotheses_json LONGTEXT NOT NULL,
      meta_json LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TBL_EVIDENCE()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      perimeter VARCHAR(50) NOT NULL DEFAULT 'chat',
      source_type VARCHAR(50) NOT NULL,
      source_id VARCHAR(100) NOT NULL,
      cursor_last_message_at VARCHAR(64) DEFAULT NULL,

      resume_text LONGTEXT NOT NULL,
      tags_json LONGTEXT NOT NULL,
      evidence_confidence DECIMAL(4,2) NOT NULL DEFAULT 0.30,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uk_user_source (user_id, source_type, source_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // S'assurer qu'on a une ligne de config (id=1)
  try {
    await pool.execute(`INSERT IGNORE INTO ${TBL_CONFIG()} (id) VALUES (1)`)
  } catch {
    // ignore
  }

  return true
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  const s = String(v ?? '').trim()
  if (s === '1') return true
  if (s.toLowerCase() === 'true') return true
  return false
}

function parseJsonArray(v: unknown): unknown[] {
  try {
    const t = String(v ?? '').trim()
    if (!t) return []
    const p = JSON.parse(t)
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

export async function getScienceConfig(): Promise<{ config: ScienceConfig; db_configured: boolean }> {
  const configured = await ensureTables()
  if (!configured) return { config: DEFAULT_CONFIG, db_configured: false }

  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${TBL_CONFIG()} WHERE id = 1 LIMIT 1`)
  const r = rows[0]

  const config: ScienceConfig = {
    ...DEFAULT_CONFIG,
    confidence_min_facts: Number(r?.confidence_min_facts ?? DEFAULT_CONFIG.confidence_min_facts),
    confidence_low_max: Number(r?.confidence_low_max ?? DEFAULT_CONFIG.confidence_low_max),
    confidence_medium_max: Number(r?.confidence_medium_max ?? DEFAULT_CONFIG.confidence_medium_max),

    include_petals_aggregate: toBool(r?.include_petals_aggregate),
    include_dreamscape: toBool(r?.include_dreamscape),
    include_solo_fleur: toBool(r?.include_solo_fleur),
    include_tarot_1card: toBool(r?.include_tarot_1card),
    include_tarot_4doors: toBool(r?.include_tarot_4doors),
    include_ma_fleur: toBool(r?.include_ma_fleur),
    include_duo: toBool(r?.include_duo),
    include_chat_clairiere: toBool(r?.include_chat_clairiere),
    include_chat_coach: toBool(r?.include_chat_coach),

    evidence_initial_max_messages: Number(r?.evidence_initial_max_messages ?? DEFAULT_CONFIG.evidence_initial_max_messages),
    evidence_update_max_messages: Number(r?.evidence_update_max_messages ?? DEFAULT_CONFIG.evidence_update_max_messages),

    science_profile_ttl_minutes: Number(r?.science_profile_ttl_minutes ?? DEFAULT_CONFIG.science_profile_ttl_minutes),
    science_generation_version: String(r?.science_generation_version ?? DEFAULT_CONFIG.science_generation_version),
  }

  return { config, db_configured: true }
}

export async function setScienceConfig(partial: Partial<ScienceConfig>): Promise<{ db_configured: boolean }> {
  const configured = await ensureTables()
  if (!configured) return { db_configured: false }

  const pool = getPool()

  const c = { ...DEFAULT_CONFIG, ...partial }
  await pool.execute(
    `
    UPDATE ${TBL_CONFIG()}
    SET
      confidence_min_facts = ?,
      confidence_low_max = ?,
      confidence_medium_max = ?,
      include_petals_aggregate = ?,
      include_dreamscape = ?,
      include_solo_fleur = ?,
      include_tarot_1card = ?,
      include_tarot_4doors = ?,
      include_ma_fleur = ?,
      include_duo = ?,
      include_chat_clairiere = ?,
      include_chat_coach = ?,
      evidence_initial_max_messages = ?,
      evidence_update_max_messages = ?,
      science_profile_ttl_minutes = ?,
      science_generation_version = ?
    WHERE id = 1
  `,
    [
      c.confidence_min_facts,
      c.confidence_low_max,
      c.confidence_medium_max,
      c.include_petals_aggregate ? 1 : 0,
      c.include_dreamscape ? 1 : 0,
      c.include_solo_fleur ? 1 : 0,
      c.include_tarot_1card ? 1 : 0,
      c.include_tarot_4doors ? 1 : 0,
      c.include_ma_fleur ? 1 : 0,
      c.include_duo ? 1 : 0,
      c.include_chat_clairiere ? 1 : 0,
      c.include_chat_coach ? 1 : 0,
      c.evidence_initial_max_messages,
      c.evidence_update_max_messages,
      c.science_profile_ttl_minutes,
      c.science_generation_version,
    ]
  )

  return { db_configured: true }
}

export type ScienceProfile = {
  user_id: number
  generated_at: string
  generation_version: string
  facts: Array<any>
  hypotheses: Array<any>
  meta: any
}

export async function getScienceProfile(userId: number): Promise<ScienceProfile | null> {
  const configured = await ensureTables()
  if (!configured) return null
  const pool = getPool()

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, generated_at, generation_version, facts_json, hypotheses_json, meta_json FROM ${TBL_PROFILES()} WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  const r = rows[0]
  if (!r) return null

  let facts: any[] = []
  let hypotheses: any[] = []
  let meta: any = {}
  try {
    facts = JSON.parse(String(r.facts_json || '[]'))
  } catch {
    facts = []
  }
  try {
    hypotheses = JSON.parse(String(r.hypotheses_json || '[]'))
  } catch {
    hypotheses = []
  }
  try {
    meta = JSON.parse(String(r.meta_json || '{}'))
  } catch {
    meta = {}
  }

  return {
    user_id: Number(r.user_id),
    generated_at: String(r.generated_at ?? ''),
    generation_version: String(r.generation_version ?? ''),
    facts,
    hypotheses,
    meta,
  }
}

export async function upsertScienceProfile(params: {
  userId: number
  generationVersion: string
  facts: Array<any>
  hypotheses: Array<any>
  meta: any
}): Promise<void> {
  const configured = await ensureTables()
  if (!configured) return
  const pool = getPool()

  await pool.execute(
    `
    INSERT INTO ${TBL_PROFILES()} (user_id, generation_version, facts_json, hypotheses_json, meta_json, generated_at)
    VALUES (?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      generation_version = VALUES(generation_version),
      facts_json = VALUES(facts_json),
      hypotheses_json = VALUES(hypotheses_json),
      meta_json = VALUES(meta_json),
      generated_at = NOW()
  `,
    [
      params.userId,
      params.generationVersion,
      JSON.stringify(params.facts ?? []),
      JSON.stringify(params.hypotheses ?? []),
      JSON.stringify(params.meta ?? {}),
    ]
  )
}

export type ScienceEvidenceRow = {
  cursor_last_message_at: string | null
  resume_text: string
  tags: string[]
  evidence_confidence: number
  updated_at: string
}

export async function getScienceEvidence(params: {
  userId: number
  sourceType: string
  sourceId: string
  defaultPerimeter?: string
}): Promise<ScienceEvidenceRow | null> {
  const configured = await ensureTables()
  if (!configured) return null
  const pool = getPool()

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT cursor_last_message_at, resume_text, tags_json, evidence_confidence, updated_at
     FROM ${TBL_EVIDENCE()}
     WHERE user_id = ? AND source_type = ? AND source_id = ?
     LIMIT 1`,
    [params.userId, params.sourceType, params.sourceId]
  )
  const r = rows[0]
  if (!r) return null

  let tags: string[] = []
  try {
    const arr = parseJsonArray(r.tags_json)
    tags = arr.map((x) => String(x)).filter(Boolean)
  } catch {
    tags = []
  }

  return {
    cursor_last_message_at: r.cursor_last_message_at ? String(r.cursor_last_message_at) : null,
    resume_text: String(r.resume_text ?? ''),
    tags,
    evidence_confidence: Number(r.evidence_confidence ?? 0.3),
    updated_at: String(r.updated_at ?? ''),
  }
}

export async function upsertScienceEvidence(params: {
  userId: number
  perimeter: string
  sourceType: string
  sourceId: string
  cursorLastMessageAt: string | null
  resumeText: string
  tags: string[]
  evidenceConfidence: number
}): Promise<void> {
  const configured = await ensureTables()
  if (!configured) return
  const pool = getPool()

  await pool.execute(
    `
    INSERT INTO ${TBL_EVIDENCE()}
      (user_id, perimeter, source_type, source_id, cursor_last_message_at, resume_text, tags_json, evidence_confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      cursor_last_message_at = VALUES(cursor_last_message_at),
      resume_text = VALUES(resume_text),
      tags_json = VALUES(tags_json),
      evidence_confidence = VALUES(evidence_confidence),
      updated_at = NOW()
  `,
    [
      params.userId,
      params.perimeter,
      params.sourceType,
      params.sourceId,
      params.cursorLastMessageAt,
      params.resumeText ?? '',
      JSON.stringify(params.tags ?? []),
      params.evidenceConfidence ?? 0.3,
    ]
  )
}

