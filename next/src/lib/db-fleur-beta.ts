/**
 * Persistance Ma Fleur 2-Beta (table dédiée, isolée du rituel 24 questions).
 */
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import {
  calculateBetaScore,
  FLEUR_BETA_CHOICE_VALUES,
  orderQuestionsForPorte,
  type FleurBetaAnswerInput,
  type FleurBetaDoorKey,
} from './fleur-beta-data'

const ALLOWED_VALUES = new Set(FLEUR_BETA_CHOICE_VALUES.map((v) => v))

function scoresFromRow(r: RowDataPacket): Record<string, number> {
  return {
    agape: Number(r?.agape ?? 0),
    philautia: Number(r?.philautia ?? 0),
    mania: Number(r?.mania ?? 0),
    storge: Number(r?.storge ?? 0),
    pragma: Number(r?.pragma ?? 0),
    philia: Number(r?.philia ?? 0),
    ludus: Number(r?.ludus ?? 0),
    eros: Number(r?.eros ?? 0),
  }
}

const TBL = () => table('fleur_beta_results')

export async function ensureFleurBetaTable(): Promise<boolean> {
  if (!isDbConfigured()) return false
  const pool = getPool()
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TBL()} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      porte VARCHAR(32) NOT NULL,
      questionnaire_version VARCHAR(32) NOT NULL DEFAULT '2-beta',
      agape DECIMAL(8,6) NOT NULL DEFAULT 0,
      philautia DECIMAL(8,6) NOT NULL DEFAULT 0,
      mania DECIMAL(8,6) NOT NULL DEFAULT 0,
      storge DECIMAL(8,6) NOT NULL DEFAULT 0,
      pragma DECIMAL(8,6) NOT NULL DEFAULT 0,
      philia DECIMAL(8,6) NOT NULL DEFAULT 0,
      ludus DECIMAL(8,6) NOT NULL DEFAULT 0,
      eros DECIMAL(8,6) NOT NULL DEFAULT 0,
      answers_json LONGTEXT NOT NULL,
      ai_interpretation_json LONGTEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_created (user_id, created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  try {
    await pool.execute(`ALTER TABLE ${TBL()} ADD COLUMN ai_interpretation_json LONGTEXT DEFAULT NULL`)
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? '')
    if (!/Duplicate column/i.test(msg)) throw e
  }
  return true
}

export type FleurBetaInterpretationStored = {
  summary?: string
  insights?: string
  reflection?: string
  cached_at?: string
  provider?: string
}

function parseInterpretationJson(raw: unknown): FleurBetaInterpretationStored | null {
  if (raw == null || raw === '') return null
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!o || typeof o !== 'object') return null
    return {
      summary: typeof o.summary === 'string' ? o.summary : undefined,
      insights: typeof o.insights === 'string' ? o.insights : undefined,
      reflection: typeof o.reflection === 'string' ? o.reflection : undefined,
      cached_at: typeof o.cached_at === 'string' ? o.cached_at : undefined,
      provider: typeof o.provider === 'string' ? o.provider : undefined,
    }
  } catch {
    return null
  }
}

export async function saveFleurBetaInterpretation(
  resultId: number,
  userId: number,
  data: FleurBetaInterpretationStored
): Promise<void> {
  await ensureFleurBetaTable()
  const pool = getPool()
  const payload = JSON.stringify({
    ...data,
    cached_at: new Date().toISOString(),
    provider: data.provider ?? 'openrouter',
  })
  await pool.execute(`UPDATE ${TBL()} SET ai_interpretation_json = ? WHERE id = ? AND user_id = ?`, [
    payload,
    resultId,
    userId,
  ])
}

export async function submitFleurBeta(params: {
  userId: number
  porte: FleurBetaDoorKey
  answers: FleurBetaAnswerInput[]
  questionnaireVersion?: string
}): Promise<{ id: number; scores: Record<string, number> }> {
  await ensureFleurBetaTable()
  const pool = getPool()
  const ordered = orderQuestionsForPorte(params.porte)
  if (params.answers.length !== ordered.length) {
    throw new Error(`${ordered.length} réponses requises`)
  }
  for (const a of params.answers) {
    const v = Number(a.value)
    if (!ALLOWED_VALUES.has(v as (typeof FLEUR_BETA_CHOICE_VALUES)[number])) {
      throw new Error('Valeur de réponse invalide')
    }
  }
  const scores = calculateBetaScore(ordered, params.answers)
  const version = params.questionnaireVersion ?? '2-beta'
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  await pool.execute(
    `INSERT INTO ${TBL()} (
      user_id, porte, questionnaire_version,
      agape, philautia, mania, storge, pragma, philia, ludus, eros,
      answers_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.userId,
      params.porte,
      version,
      scores.agape,
      scores.philautia,
      scores.mania,
      scores.storge,
      scores.pragma,
      scores.philia,
      scores.ludus,
      scores.eros,
      JSON.stringify(params.answers),
      now,
    ]
  )
  const [idRows] = await pool.execute<RowDataPacket[]>('SELECT LAST_INSERT_ID() AS id')
  const id = Number((idRows[0] as { id: number }).id)
  return { id, scores }
}

export async function getFleurBetaResult(
  resultId: number,
  userId: string
): Promise<Record<string, unknown> | null> {
  await ensureFleurBetaTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM ${TBL()} WHERE id = ? AND user_id = ? LIMIT 1`,
    [resultId, parseInt(userId, 10)]
  )
  const r = rows[0]
  if (!r) return null
  const scores = scoresFromRow(r)
  let answers: unknown[] = []
  try {
    answers = JSON.parse(String(r.answers_json ?? '[]')) as unknown[]
  } catch {
    answers = []
  }
  const interpretation = parseInterpretationJson(r.ai_interpretation_json)
  return {
    id: Number(r.id),
    questionnaire_version: String(r.questionnaire_version ?? '2-beta'),
    porte: String(r.porte ?? ''),
    scores,
    answers,
    created_at: r.created_at,
    type: 'fleur-beta',
    interpretation: interpretation
      ? {
          summary: interpretation.summary,
          insights: interpretation.insights,
          reflection: interpretation.reflection,
        }
      : null,
  }
}

export type FleurBetaListItem = {
  id: number
  created_at: string
  porte: string
  questionnaire_version: string
}

export async function listFleurBetaResults(userId: number): Promise<FleurBetaListItem[]> {
  await ensureFleurBetaTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, created_at, porte, questionnaire_version FROM ${TBL()}
     WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  )
  return rows.map((r) => ({
    id: Number(r.id),
    created_at: r.created_at ? String(r.created_at) : '',
    porte: String(r.porte ?? ''),
    questionnaire_version: String(r.questionnaire_version ?? '2-beta'),
  }))
}

/** Pour l’agrégat science : derniers résultats avec scores déjà normalisés 0–1. */
export async function listFleurBetaScoresForScience(userId: number, limit = 20): Promise<Record<string, number>[]> {
  await ensureFleurBetaTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT agape, philautia, mania, storge, pragma, philia, ludus, eros
     FROM ${TBL()} WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  )
  return rows.map((r) => scoresFromRow(r))
}

export async function deleteFleurBetaResult(resultId: number, userId: number): Promise<boolean> {
  await ensureFleurBetaTable()
  const pool = getPool()
  const [res] = await pool.execute<ResultSetHeader>(`DELETE FROM ${TBL()} WHERE id = ? AND user_id = ?`, [
    resultId,
    userId,
  ])
  return Number(res?.affectedRows ?? 0) > 0
}
