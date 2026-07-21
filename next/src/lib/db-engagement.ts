/**
 * Ciblage des relances d'engagement (tirage, Fleur, session, check-in, plan 14j…).
 * Une seule relance par utilisateur et par fenêtre de cooldown.
 */
import type { RowDataPacket } from 'mysql2/promise'
import { getPool, isDbConfigured, SQL_TEXT_COLLATE, sqlEmailEq, table } from './db'
import { excludeDemoAccountsSql } from './demo-accounts'
import { normalizeOutboundEmail } from './notification-outbound'
import { findCheckinReminderCandidates } from './db-checkins'
import { ensureNotificationsTables } from './db-notifications'
import { findPlan14jReminderCandidates } from './db-plan14j-remind'
import type { EngagementCampaignId } from './engagement-templates'

const ENGAGEMENT_TYPES = [
  'plan14j_reminder',
  'checkin_reminder',
  'engagement_tirage',
  'engagement_fleur',
  'engagement_session',
  'engagement_dreamscape',
  'engagement_earlyreturn',
  'engagement_comeback',
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
  await ensureNotificationsTables()
  const pool = getPool()
  const hours = Math.min(Math.max(cooldownHours, 1), 720)
  const placeholders = ENGAGEMENT_TYPES.map(() => '?').join(', ')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT d.user_id AS user_id
       FROM ${table('fleur_notification_deliveries')} d
       INNER JOIN ${table('fleur_notifications')} n ON n.id = d.notification_id
      WHERE n.created_at >= (NOW() - INTERVAL ? HOUR)
        AND n.type IN (${placeholders})`,
    [hours, ...ENGAGEMENT_TYPES]
  )
  return new Set(rows.map((r) => Number(r.user_id)).filter(Boolean))
}

/** Relance « retour au jardin » déjà envoyée dans la fenêtre (défaut 15 jours). */
export async function findRecentlyComebackNudgedUserIds(inactiveDays: number): Promise<Set<number>> {
  if (!isDbConfigured()) return new Set()
  await ensureNotificationsTables()
  const pool = getPool()
  const days = Math.min(Math.max(inactiveDays, 7), 60)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT d.user_id AS user_id
       FROM ${table('fleur_notification_deliveries')} d
       INNER JOIN ${table('fleur_notifications')} n ON n.id = d.notification_id
      WHERE n.created_at >= (NOW() - INTERVAL ? DAY)
        AND n.type = 'engagement_comeback'`,
    [days]
  )
  return new Set(rows.map((r) => Number(r.user_id)).filter(Boolean))
}

/**
 * Utilisateurs peu connectés : pas de connexion depuis inactiveDays (défaut 15).
 * Vrais comptes uniquement (hors démo Mycelium).
 */
async function findInactiveComebackCandidates(
  inactiveDays: number,
  limit: number,
  exclude: Set<number>
): Promise<EngagementCandidate[]> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const excludeDemo = excludeDemoAccountsSql('u', tMeta)
  const days = Math.min(Math.max(inactiveDays, 7), 60)
  const recentlyComeback = await findRecentlyComebackNudgedUserIds(days)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID AS user_id, u.user_email AS email
       FROM ${tUsers} u
       LEFT JOIN ${tMeta} um_last
         ON um_last.user_id = u.ID AND um_last.meta_key = 'fleur_last_login'
      WHERE u.user_email IS NOT NULL AND TRIM(u.user_email) != ''
        AND (
          um_last.meta_value IS NULL
          OR um_last.meta_value < DATE_FORMAT(DATE_SUB(NOW(), INTERVAL ? DAY), '%Y-%m-%d %H:%i:%s')
        )
        ${excludeDemo}
      ORDER BY um_last.meta_value IS NULL DESC, um_last.meta_value ASC
      LIMIT ${limit}`,
    [days]
  )

  const out: EngagementCandidate[] = []
  for (const r of rows) {
    const userId = Number(r.user_id)
    if (!userId || exclude.has(userId) || recentlyComeback.has(userId)) continue
    exclude.add(userId)
    out.push({
      userId,
      email: r.email ? String(r.email) : null,
      locale: 'fr',
      campaignId: 'comeback',
    })
    if (out.length >= limit) break
  }
  return out
}

/**
 * Fenêtre critique de churn précoce : utilisateurs actifs récemment mais absents
 * depuis 2 à 6 jours (avant que le comeback à 15 jours ne s'applique).
 * Un utilisateur ne reste dans cette fenêtre que ~4 jours → max 1 relance par absence
 * (le cooldown global évite tout doublon).
 */
async function findEarlyReturnCandidates(
  earlyReturnMinDays: number,
  earlyReturnMaxDays: number,
  limit: number,
  exclude: Set<number>
): Promise<EngagementCandidate[]> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const excludeDemo = excludeDemoAccountsSql('u', tMeta)
  const minDays = Math.min(Math.max(earlyReturnMinDays, 1), 14)
  const maxDays = Math.min(Math.max(earlyReturnMaxDays, minDays + 1), 14)

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID AS user_id, u.user_email AS email
       FROM ${tUsers} u
       INNER JOIN ${tMeta} um_last
         ON um_last.user_id = u.ID AND um_last.meta_key = 'fleur_last_login'
      WHERE u.user_email IS NOT NULL AND TRIM(u.user_email) != ''
        AND um_last.meta_value < DATE_FORMAT(DATE_SUB(NOW(), INTERVAL ? DAY), '%Y-%m-%d %H:%i:%s')
        AND um_last.meta_value >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL ? DAY), '%Y-%m-%d %H:%i:%s')
        ${excludeDemo}
      ORDER BY um_last.meta_value ASC
      LIMIT ${limit}`,
    [minDays, maxDays]
  )

  const out: EngagementCandidate[] = []
  for (const r of rows) {
    const userId = Number(r.user_id)
    if (!userId || exclude.has(userId)) continue
    exclude.add(userId)
    out.push({
      userId,
      email: r.email ? String(r.email) : null,
      locale: 'fr',
      campaignId: 'earlyreturn',
    })
    if (out.length >= limit) break
  }
  return out
}

/** Nombre d'utilisateurs réels inactifs depuis N jours (hors démo), sans filtre cooldown. */
export async function countInactiveUsers(inactiveDays: number): Promise<number> {
  if (!isDbConfigured()) return 0
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const excludeDemo = excludeDemoAccountsSql('u', tMeta)
  const days = Math.min(Math.max(inactiveDays, 7), 60)
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt
       FROM ${tUsers} u
       LEFT JOIN ${tMeta} um_last
         ON um_last.user_id = u.ID AND um_last.meta_key = 'fleur_last_login'
      WHERE u.user_email IS NOT NULL AND TRIM(u.user_email) != ''
        AND (
          um_last.meta_value IS NULL
          OR um_last.meta_value < DATE_FORMAT(DATE_SUB(NOW(), INTERVAL ? DAY), '%Y-%m-%d %H:%i:%s')
        )
        ${excludeDemo}`,
    [days]
  )
  return Number(rows[0]?.cnt ?? 0)
}

/**
 * Phase pilote : utilisateurs de la allowlist absents des candidats « naturels ».
 * Campagne check-in par défaut (relance douce testable).
 */
export async function findAllowlistPilotCandidates(
  allowlist: Set<string>,
  assigned: Set<number>,
  cooldownHours: number
): Promise<EngagementCandidate[]> {
  if (!isDbConfigured() || allowlist.size === 0) return []
  const recentlyNudged = await findRecentlyNudgedUserIds(cooldownHours)
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const excludeDemo = excludeDemoAccountsSql('u', tMeta)
  const out: EngagementCandidate[] = []

  for (const raw of allowlist) {
    const emailNorm = normalizeOutboundEmail(raw)
    if (!emailNorm) continue
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.ID AS user_id, u.user_email AS email
         FROM ${tUsers} u
        WHERE LOWER(TRIM(u.user_email)) COLLATE ${SQL_TEXT_COLLATE} = ?
        ${excludeDemo}
        LIMIT 1`,
      [emailNorm]
    )
    const row = rows[0]
    if (!row) continue
    const userId = Number(row.user_id)
    if (!userId || assigned.has(userId) || recentlyNudged.has(userId)) continue
    assigned.add(userId)
    out.push({
      userId,
      email: row.email ? String(row.email) : null,
      locale: 'fr',
      campaignId: 'checkin',
    })
  }
  return out
}

async function findFleurMissingCandidates(
  activityDays: number,
  limit: number,
  exclude: Set<number>
): Promise<EngagementCandidate[]> {
  if (!isDbConfigured()) return []
  const pool = getPool()
  const excludeDemo = excludeDemoAccountsSql('u', table('usermeta'))
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT te.user_id AS user_id, u.user_email AS email
       FROM ${table('fleur_timeline_events')} te
       JOIN ${table('users')} u ON u.ID = te.user_id
      WHERE te.created_at >= (NOW() - INTERVAL ? DAY)
        AND NOT EXISTS (
          SELECT 1 FROM ${table('fleur_amour_results')} r
           WHERE r.user_id = te.user_id
        )
        ${excludeDemo}
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
  const excludeDemo = excludeDemoAccountsSql('u', table('usermeta'))
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
        ${excludeDemo}
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
  const excludeDemo = excludeDemoAccountsSql('u', table('usermeta'))
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
           INNER JOIN ${table('users')} u2 ON ${sqlEmailEq('u2.user_email', 's.email')}
           WHERE u2.ID = te.user_id
             AND s.status IN ('completed', 'done', 'finished', 'closed', 'terminated')
        )
        ${excludeDemo}
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
  const excludeDemo = excludeDemoAccountsSql('u', table('usermeta'))
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
        ${excludeDemo}
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
 * plan14j → check-in → Fleur → tirage → session → dreamscape → comeback (peu connectés).
 */
export async function findEngagementCandidates(params: {
  limit?: number
  activityDays?: number
  cooldownHours?: number
  tirageStaleDays?: number
  dreamscapeStaleDays?: number
  inactiveDays?: number
}): Promise<EngagementCandidate[]> {
  if (!isDbConfigured()) return []

  const limit = Math.min(Math.max(params.limit ?? 250, 1), 500)
  const activityDays = Math.min(Math.max(params.activityDays ?? 30, 7), 90)
  const cooldownHours = Math.min(Math.max(params.cooldownHours ?? 168, 6), 720)
  const tirageStaleDays = Math.min(Math.max(params.tirageStaleDays ?? 4, 1), 30)
  const dreamscapeStaleDays = Math.min(Math.max(params.dreamscapeStaleDays ?? 14, 3), 60)
  const inactiveDays = Math.min(Math.max(params.inactiveDays ?? 15, 7), 60)

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

  // Fenêtre critique J+2 → J+6 : rattraper les départs précoces avant qu'ils ne deviennent du churn.
  const earlyReturns = await findEarlyReturnCandidates(2, 6, limit, assigned)
  for (const c of earlyReturns) {
    out.push(c)
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

  const comeback = await findInactiveComebackCandidates(inactiveDays, limit, assigned)
  for (const c of comeback) {
    push(c)
    if (out.length >= limit) return out
  }

  return out
}
