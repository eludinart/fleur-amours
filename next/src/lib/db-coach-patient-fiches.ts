/**
 * Fiches coach par patient (cache IA) — MariaDB
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

const TBL = () => table('fleur_coach_patient_fiches')

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

