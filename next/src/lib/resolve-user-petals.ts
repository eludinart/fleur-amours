/**
 * Profil pétales 0–1 d'un utilisateur pour agrégats (fleur de couple, etc.).
 * Priorité : ligne de base → Ma Fleur → diagnostic → promenade → session.
 */
import { authMe } from './db-auth'
import { getBaseline } from './db-baseline'
import { my as dreamscapeMy } from './db-dreamscape'
import { getMyResults } from './db-fleur'
import { listFleurBetaScoresForScience } from './db-fleur-beta'
import { listByEmailForTimeline } from './db-sessions'
import { getPool, isDbConfigured, table } from './db'
import { PETAL_ORDER_IDS } from './petal-theme'
import type { RowDataPacket } from 'mysql2'

function normalizePetals(input: unknown): Record<string, number> | null {
  if (!input || typeof input !== 'object') return null
  const src = input as Record<string, unknown>
  let any = false
  const out: Record<string, number> = {}
  for (const id of PETAL_ORDER_IDS) {
    const v = Number(src[id])
    if (Number.isFinite(v) && v > 0) any = true
    out[id] = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
  }
  return any ? out : null
}

function scoresScale5To01(scores: Record<string, number>): Record<string, number> | null {
  const out: Record<string, number> = {}
  let any = false
  for (const id of PETAL_ORDER_IDS) {
    const v = Number(scores[id])
    if (Number.isFinite(v) && v > 0) any = true
    out[id] = Number.isFinite(v) ? Math.min(1, Math.max(0, v / 5)) : 0
  }
  return any ? out : null
}

async function latestFleurAmourPetals(userId: number): Promise<Record<string, number> | null> {
  if (!isDbConfigured()) return null
  const pool = getPool()
  const tRes = table('fleur_amour_results')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT agape, philautia, mania, storge, pragma, philia, ludus, eros
     FROM ${tRes}
     WHERE user_id = ? AND (parent_id IS NULL OR parent_id = 0)
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  )
  if (!rows?.length) return null
  const row = rows[0]
  const scores: Record<string, number> = {}
  for (const id of PETAL_ORDER_IDS) {
    scores[id] = Number(row[id] ?? 0)
  }
  return scoresScale5To01(scores)
}

/** Pétales 0–1 exploitables pour la fleur de couple (ou null si rien en base). */
export async function resolveUserPetalsProfile(
  userId: number,
  email?: string | null
): Promise<Record<string, number> | null> {
  if (!Number.isFinite(userId) || userId <= 0) return null

  const baseline = await getBaseline(userId)
  const fromBaseline = baseline ? normalizePetals(baseline.petals) : null
  if (fromBaseline) return fromBaseline

  const fromFleur = await latestFleurAmourPetals(userId)
  if (fromFleur) return fromFleur

  const betaScores = await listFleurBetaScoresForScience(userId, 1)
  if (betaScores[0]) {
    const fromBeta = normalizePetals(betaScores[0])
    if (fromBeta) return fromBeta
  }

  const { items: fleurItems } = await getMyResults(String(userId))
  const latest = fleurItems[0]
  if (latest?.scores) {
    const fromExploration = scoresScale5To01(latest.scores as Record<string, number>)
    if (fromExploration) return fromExploration
  }

  const { items: dreamscapes } = await dreamscapeMy(String(userId))
  if (dreamscapes[0]?.petals) {
    const fromDream = normalizePetals(dreamscapes[0].petals as Record<string, number>)
    if (fromDream) return fromDream
  }

  const userEmail =
    email?.trim() ||
    (await authMe(userId).catch(() => null))?.email?.trim() ||
    ''
  if (userEmail) {
    const { items: sessions } = await listByEmailForTimeline(userEmail, 5)
    for (const s of sessions) {
      const fromSession = normalizePetals(s.petals as Record<string, number>)
      if (fromSession) return fromSession
    }
  }

  return null
}
