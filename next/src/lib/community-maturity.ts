/**
 * Badges de maturité communautaire — requêtes serveur (MariaDB).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from './db'
import {
  computeMaturityBadges,
  type MaturityBadgeId,
  type MaturityStats,
} from './community-maturity-data'

export type { MaturityBadgeId, MaturityStats } from './community-maturity-data'
export { MATURITY_BADGE_DEFS, computeMaturityBadges } from './community-maturity-data'

/** Stats d'activité pour un jardinier (requêtes légères). */
export async function fetchMaturityStats(userId: number): Promise<MaturityStats> {
  const pool = getPool()
  const uid = Number(userId)
  const stats: MaturityStats = {
    profilePublic: false,
    seedsSent: 0,
    seedsReceived: 0,
    acceptedLinks: 0,
    arrosagesGiven: 0,
    arrosagesReceived: 0,
    pollensSent: 0,
  }
  if (!uid) return stats

  const tMeta = table('usermeta')
  const tSeeds = table('fleur_social_seeds')
  const tLinks = table('fleur_prairie_links')
  const tRosee = table('fleur_rosee_events')
  const tPollen = table('fleur_pollen')

  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = 'fleur_profile_public' LIMIT 1`,
      [uid]
    )
    stats.profilePublic = String(rows?.[0]?.meta_value ?? '') === '1'
  } catch {
    /* ignore */
  }

  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN from_user_id = ? THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN to_user_id = ? THEN 1 ELSE 0 END) AS recv
       FROM ${tSeeds}`,
      [uid, uid]
    )
    stats.seedsSent = Number(r?.[0]?.sent ?? 0)
    stats.seedsReceived = Number(r?.[0]?.recv ?? 0)
  } catch {
    /* ignore */
  }

  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM ${tLinks} WHERE user_a = ? OR user_b = ?`,
      [uid, uid]
    )
    stats.acceptedLinks = Number(r?.[0]?.c ?? 0)
  } catch {
    /* ignore */
  }

  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN from_user_id = ? THEN 1 ELSE 0 END) AS given,
         SUM(CASE WHEN to_user_id = ? THEN 1 ELSE 0 END) AS recv
       FROM ${tRosee}`,
      [uid, uid]
    )
    stats.arrosagesGiven = Number(r?.[0]?.given ?? 0)
    stats.arrosagesReceived = Number(r?.[0]?.recv ?? 0)
  } catch {
    /* ignore */
  }

  try {
    const [r] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM ${tPollen} WHERE from_user_id = ?`,
      [uid]
    )
    stats.pollensSent = Number(r?.[0]?.c ?? 0)
  } catch {
    /* ignore */
  }

  return stats
}

/** Batch pour Mes Liens (évite N+1 sur petites listes). */
export async function fetchMaturityStatsBatch(
  userIds: number[]
): Promise<Map<number, MaturityBadgeId[]>> {
  const out = new Map<number, MaturityBadgeId[]>()
  const unique = [...new Set(userIds.filter((id) => id > 0))]
  await Promise.all(
    unique.map(async (id) => {
      const stats = await fetchMaturityStats(id)
      out.set(id, computeMaturityBadges(stats))
    })
  )
  return out
}
