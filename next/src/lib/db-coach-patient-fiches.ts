/**
 * Fiches coach par patient (cache IA) — MariaDB
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

const TBL = () => table('fleur_coach_patient_fiches')

let _ensureCols: Promise<void> | null = null

async function ensureCoachNotesColumn(): Promise<void> {
  if (!isDbConfigured()) return
  if (_ensureCols) return _ensureCols
  const pool = getPool()
  const t = TBL()
  _ensureCols = pool
    .execute(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS coach_notes_json MEDIUMTEXT NULL`)
    .then(() => undefined)
    .catch(() => undefined)
  return _ensureCols
}

async function ensureTable(): Promise<void> {
  if (!isDbConfigured()) return
  const pool = getPool()
  const t = TBL()

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${t} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coach_user_id INT NOT NULL,
      patient_email VARCHAR(255) NOT NULL,
      snapshot_json MEDIUMTEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_coach_patient (coach_user_id, patient_email),
      INDEX idx_patient_email (patient_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  await ensureCoachNotesColumn()
}

export async function getCoachPatientSnapshot(params: {
  coachUserId: number
  patientEmail: string
}): Promise<Record<string, unknown> | null> {
  const { coachUserId, patientEmail } = params
  if (!isDbConfigured()) return null

  await ensureTable()
  const pool = getPool()
  const t = TBL()
  const normEmail = String(patientEmail ?? '').trim().toLowerCase()
  if (!normEmail) return null

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT snapshot_json FROM ${t} WHERE coach_user_id = ? AND LOWER(patient_email) = ? LIMIT 1`,
    [coachUserId, normEmail]
  )

  const raw = (rows?.[0] as any)?.snapshot_json
  if (!raw) return null
  try {
    return JSON.parse(String(raw))
  } catch {
    return null
  }
}

export async function upsertCoachPatientSnapshot(params: {
  coachUserId: number
  patientEmail: string
  snapshot: Record<string, unknown>
}): Promise<void> {
  const { coachUserId, patientEmail, snapshot } = params
  if (!isDbConfigured()) return
  await ensureTable()

  const pool = getPool()
  const t = TBL()
  const normEmail = String(patientEmail ?? '').trim().toLowerCase()
  if (!normEmail) return

  await pool.execute(
    `INSERT INTO ${t} (coach_user_id, patient_email, snapshot_json)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE snapshot_json = VALUES(snapshot_json)`,
    [coachUserId, normEmail, JSON.stringify(snapshot)]
  )
}

const NOTE_KEYS = ['ensemble', 'fleur', 'ombres', 'patient_tab', 'sessions_tab'] as const
export type CoachPatientNoteSection = (typeof NOTE_KEYS)[number]

export type CoachPatientNotesPayload = {
  ensemble?: string
  fleur?: string
  ombres?: string
  patient_tab?: string
  sessions_tab?: string
  updated_at?: string
}

function parseCoachNotesJson(raw: unknown): CoachPatientNotesPayload {
  if (!raw || typeof raw !== 'string') return {}
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    if (!o || typeof o !== 'object') return {}
    const out: CoachPatientNotesPayload = {}
    for (const k of NOTE_KEYS) {
      const v = o[k]
      if (typeof v === 'string') out[k] = v
    }
    if (typeof o.updated_at === 'string') out.updated_at = o.updated_at
    return out
  } catch {
    return {}
  }
}

export async function getCoachPatientNotes(params: {
  coachUserId: number
  patientEmail: string
}): Promise<CoachPatientNotesPayload> {
  const { coachUserId, patientEmail } = params
  if (!isDbConfigured()) return {}
  await ensureTable()
  const pool = getPool()
  const t = TBL()
  const normEmail = String(patientEmail ?? '').trim().toLowerCase()
  if (!normEmail) return {}

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT coach_notes_json FROM ${t} WHERE coach_user_id = ? AND LOWER(patient_email) = ? LIMIT 1`,
    [coachUserId, normEmail]
  )
  const raw = (rows?.[0] as { coach_notes_json?: string | null })?.coach_notes_json
  return parseCoachNotesJson(raw ?? null)
}

/** Fusionne les champs fournis ; chaîne vide efface la clé. Ne modifie pas snapshot_json. */
export async function mergeCoachPatientNotes(params: {
  coachUserId: number
  patientEmail: string
  partial: Partial<Record<CoachPatientNoteSection, string>>
}): Promise<CoachPatientNotesPayload> {
  const { coachUserId, patientEmail, partial } = params
  if (!isDbConfigured()) return {}
  await ensureTable()
  const pool = getPool()
  const t = TBL()
  const normEmail = String(patientEmail ?? '').trim().toLowerCase()
  if (!normEmail) return {}

  const [existingRows] = await pool.execute<RowDataPacket[]>(
    `SELECT coach_notes_json FROM ${t} WHERE coach_user_id = ? AND LOWER(patient_email) = ? LIMIT 1`,
    [coachUserId, normEmail]
  )
  const prev = parseCoachNotesJson((existingRows?.[0] as { coach_notes_json?: string | null })?.coach_notes_json)

  const next: CoachPatientNotesPayload = { ...prev }
  for (const k of NOTE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(partial, k)) continue
    const v = partial[k]
    if (typeof v !== 'string') continue
    const trimmed = v.trim()
    if (!trimmed) delete (next as Record<string, unknown>)[k]
    else (next as Record<string, unknown>)[k] = v
  }
  next.updated_at = new Date().toISOString()

  const jsonStr = JSON.stringify(next)

  await pool.execute(
    `
    INSERT INTO ${t} (coach_user_id, patient_email, snapshot_json, coach_notes_json)
    VALUES (?, ?, NULL, ?)
    ON DUPLICATE KEY UPDATE coach_notes_json = VALUES(coach_notes_json)
    `,
    [coachUserId, normEmail, jsonStr]
  )

  return next
}

