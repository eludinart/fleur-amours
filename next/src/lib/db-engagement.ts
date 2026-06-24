/**
 * Ciblage des relances d'engagement (tirage, Fleur, session, check-in, plan 14j…).
 * Une seule relance par utilisateur et par fenêtre de cooldown.
 */
import type { RowDataPacket } from 'mysql2/promise'
import { getPool, isDbConfigured, table } from './db'
import { findCheckinReminderCandidates } from './db-checkins'
import { findPlan14jReminderCandidates } from './db-plan14j-remind'
import type { EngagementCampaignId } from './engagement-templates'

const ENGAGEMENT_TYPES = [
  'plan14j_reminder',
  'checkin_reminder',
  'engagement_tirage',
  'engagement_fleur',
  'engagement_session',
  'engagement_dreamscape',
] as const

export type EngagementCandidate = {
  userId: number
  email: string | null
  locale: string
  campaignId: EngagementCampaignId
  vars?: { day?: number; action?: string }
  source_id?: number
}

/** Utilisateurs ayant reçu une relance d'engagement récemment. */
export async function findRecentlyNudgedUserIds(cooldownHours: number): Promise<Set<number>> {
  if (!isDbConfigured()) return new Set()
  const pool = getPool()
  const hours = Math.min(Math.max(cooldownHours, 1), 168)
  const placeholders = ENGAGEMENT_TYPES.map(() => '?').join(', ')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT d.user_id AS user_id
       FROM ${table('fleur_notification_deliveries')} d
       INNER JOIN ${table('fleur_notifications')} n ON n.id = d.notification_id
      WHERE d.delivered_at >= (NOW() - INTERVAL ? HOUR)
        AND n.type IN (${placeholders})`,
    [hours, ...ENGAGEMENT_TYPES]
  )
  return new Set(rows.map((r) => Number(r.user_id)).filter(Boolean))
}

async function findFleurMissingCandidates(
  activityDays: number,
  limit: number,
  exclude: Set<number>
): Promise<EngagementCandidate[]> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT te.user_id AS user_id, u.user_email AS email
       FROM ${table('fleur_timeline_events')} te
       JOIN ${table('users')} u ON u.ID = te.user_id
      WHERE te.created_at >= (NOW() - INTERVAL ? DAY)
        AND NOT EXISTS (
          SELECT 1 FROM ${table('fleur_amour_results')} r
           WHERE r.user_id = te.user_id
        )
      LIMIT ${limit}`,
    [activityDays]
  )
  const out: EngagementCandidate[] = []
  for (const r of rows) {
    const userId = Number(r.user_id)
    if (!userId || exclude.has(userId)) continue
    exclude.add(userId)
    out.push({ userId, email: r.email ?? null, locale: 'fr', campaignId: 'fleur' })
    if (out.length >= limit) break
  }
  return out
}

async function findTirageStaleCandidates(
  staleDays: number,
  activityDays: number,
  limit: number,
  exclude: Set<number>
): Promise<EngagementCandidate[]> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT te.user_id AS user_id, u.user_email AS email
       FROM ${table('fleur_timeline_events')} te
       JOIN ${table('users')} u ON u.ID = te.user_id
      WHERE te.created_at >= (NOW() - INTERVAL ? DAY)
        AND EXISTS (
          SELECT 1 FROM ${table('fleur_amour_results')} r WHERE r.user_id = te.user_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM ${table('fleur_tarot_readings')} tr
           WHERE tr.user_id = te.user_id
             AND tr.created_at >= (NOW() - INTERVAL ? DAY)
        )
      LIMIT ${limit}`,
    [activityDays, staleDays]
  )
  const out: EngagementCandidate[] = []
  for (const r of rows) {
    const userId = Number(r.user_id)
    if (!userId || exclude.has(userId)) continue
    exclude.add(userId)
    out.push({ userId, email: r.email ?? null, locale: 'fr', campaignId: 'tirage' })
    if (out.length >= limit) break
  }
  return out
}

async function findSessionMissingCandidates(
  activityDays: number,
  limit: number,
  exclude: Set<number>
): Promise<EngagementCandidate[]> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  const tSess = table('fleur_sessions')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT te.user_id AS user_id, u.user_email AS email
       FROM ${table('fleur_timeline_events')} te
       JOIN ${table('users')} u ON u.ID = te.user_id
      WHERE te.created_at >= (NOW() - INTERVAL ? DAY)
        AND EXISTS (
          SELECT 1 FROM ${table('fleur_amour_results')} r WHERE r.user_id = te.user_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM ${tSess} s
           INNER JOIN ${table('users')} u2 ON LOWER(u2.user_email) = LOWER(s.email)
           WHERE u2.ID = te.user_id
             AND s.status IN ('completed', 'done', 'finished', 'closed', 'terminated')
        )
      LIMIT ${limit}`,
    [activityDays]
  )
  const out: EngagementCandidate[] = []
  for (const r of rows) {
    const userId = Number(r.user_id)
    if (!userId || exclude.has(userId)) continue
    exclude.add(userId)
    out.push({ userId, email: r.email ?? null, locale: 'fr', campaignId: 'session' })
    if (out.length >= limit) break
  }
  return out
}

async function findDreamscapeStaleCandidates(
  staleDays: number,
  activityDays: number,
  limit: number,
  exclude: Set<number>
): Promise<EngagementCandidate[]> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  const tDream = table('fleur_dreamscape')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT te.user_id AS user_id, u.user_email AS email
       FROM ${table('fleur_timeline_events')} te
       JOIN ${table('users')} u ON u.ID = te.user_id
      WHERE te.created_at >= (NOW() - INTERVAL ? DAY)
        AND EXISTS (
          SELECT 1 FROM ${table('fleur_amour_results')} r WHERE r.user_id = te.user_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM ${tDream} d
           WHERE d.user_id = CAST(te.user_id AS CHAR)
             AND d.created_at >= (NOW() - INTERVAL ? DAY)
        )
      LIMIT ${limit}`,
    [activityDays, staleDays]
  )
  const out: EngagementCandidate[] = []
  for (const r of rows) {
    const userId = Number(r.user_id)
    if (!userId || exclude.has(userId)) continue
    exclude.add(userId)
    out.push({ userId, email: r.email ?? null, locale: 'fr', campaignId: 'dreamscape' })
    if (out.length >= limit) break
  }
  return out
}

/**
 * Candidats à une relance unique, par priorité :
 * plan14j → check-in → Fleur → tirage → session → dreamscape.
 */
export async function findEngagementCandidates(params: {
  limit?: number
  activityDays?: number
  cooldownHours?: number
  tirageStaleDays?: number
  dreamscapeStaleDays?: number
}): Promise<EngagementCandidate[]> {
  if (!isDbConfigured()) return []

  const limit = Math.min(Math.max(params.limit ?? 120, 1), 500)
  const activityDays = Math.min(Math.max(params.activityDays ?? 30, 7), 90)
  const cooldownHours = Math.min(Math.max(params.cooldownHours ?? 20, 6), 168)
  const tirageStaleDays = Math.min(Math.max(params.tirageStaleDays ?? 4, 1), 30)
  const dreamscapeStaleDays = Math.min(Math.max(params.dreamscapeStaleDays ?? 14, 3), 60)

  const recentlyNudged = await findRecentlyNudgedUserIds(cooldownHours)
  const assigned = new Set<number>(recentlyNudged)
  const out: EngagementCandidate[] = []

  const push = (c: EngagementCandidate) => {
    if (assigned.has(c.userId)) return
    assigned.add(c.userId)
    out.push(c)
  }

  const plan14j = await findPlan14jReminderCandidates(limit)
  for (const p of plan14j) {
    push({
      userId: p.userId,
      email: p.email,
      locale: 'fr',
      campaignId: 'plan14j',
      vars: { day: p.currentDay, action: p.action },
      source_id: p.sessionId,
    })
    if (out.length >= limit) return out
  }

  const checkins = await findCheckinReminderCandidates({ activityDays, staleDays: 7, limit })
  for (const c of checkins) {
    push({ userId: c.userId, email: c.email, locale: 'fr', campaignId: 'checkin' })
    if (out.length >= limit) return out
  }

  const batches = await Promise.all([
    findFleurMissingCandidates(activityDays, limit, assigned),
    findTirageStaleCandidates(tirageStaleDays, activityDays, limit, assigned),
    findSessionMissingCandidates(activityDays, limit, assigned),
    findDreamscapeStaleCandidates(dreamscapeStaleDays, activityDays, limit, assigned),
  ])

  for (const batch of batches) {
    for (const c of batch) {
      push(c)
      if (out.length >= limit) return out
    }
  }

  return out
}
