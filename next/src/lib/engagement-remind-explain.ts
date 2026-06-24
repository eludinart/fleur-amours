/**
 * Diagnostic : pourquoi un utilisateur est ignoré par la cron engagement.
 */
import type { RowDataPacket } from 'mysql2/promise'
import type { EngagementCandidate } from '@/lib/db-engagement'
import { findRecentlyNudgedUserIds } from '@/lib/db-engagement'
import { filterOutDemoUserIds } from '@/lib/demo-accounts-filter'
import { isVirtualAccount } from '@/lib/demo-accounts'
import { getPool, isDbConfigured, SQL_TEXT_COLLATE, table } from '@/lib/db'
import { isSmtpConfigured } from '@/lib/smtp'
import {
  canSendEngagementRemindToEmail,
  engagementRemindAllowlist,
  isEngagementRemindAllowlistActive,
  isNotificationOutboundRestricted,
  normalizeOutboundEmail,
} from '@/lib/notification-outbound'
import type { EngagementRemindInput } from '@/lib/engagement-remind-run'

export type EmailEngagementExplain = {
  email: string
  userId: number | null
  dbEmail: string | null
  outcome: 'would_send' | 'skipped'
  campaignId: string | null
  source: 'natural' | 'pilot' | null
  inAppNotification: boolean
  emailSmtp: boolean
  reasons: string[]
}

async function lookupUserByEmail(emailNorm: string): Promise<{ userId: number; email: string } | null> {
  if (!isDbConfigured()) return null
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID AS user_id, u.user_email AS email
       FROM ${table('users')} u
      WHERE LOWER(TRIM(u.user_email)) COLLATE ${SQL_TEXT_COLLATE} = ?
      LIMIT 1`,
    [emailNorm]
  )
  const row = rows[0]
  if (!row) return null
  return { userId: Number(row.user_id), email: String(row.email ?? '') }
}

export async function checkEngagementEmailPrefs(userId: number): Promise<{ ok: boolean; reason?: string }> {
  if (!isDbConfigured()) return { ok: false, reason: 'db_non_configuree' }
  const pool = getPool()
  const tPref = table('fleur_notification_preferences')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT preferences_json FROM ${tPref} WHERE user_id = ? LIMIT 1`,
    [userId]
  )
  if (!rows[0]?.preferences_json) return { ok: true }
  return parseEmailPrefsRow(rows[0].preferences_json)
}

function parseEmailPrefsRow(preferencesJson: unknown): { ok: boolean; reason?: string } {
  if (!preferencesJson) return { ok: true }
  try {
    const prefs = JSON.parse(String(preferencesJson)) as {
      email_enabled?: boolean
      email_digest?: string
    }
    if (prefs.email_enabled === false) {
      return { ok: false, reason: 'preferences_email_desactivees' }
    }
    if (prefs.email_digest && prefs.email_digest !== 'instant') {
      return { ok: false, reason: `preferences_digest_${prefs.email_digest}` }
    }
    return { ok: true }
  } catch {
    return { ok: true }
  }
}

export async function checkEngagementEmailPrefsBatch(
  userIds: number[]
): Promise<Map<number, { ok: boolean; reason?: string }>> {
  const out = new Map<number, { ok: boolean; reason?: string }>()
  if (userIds.length === 0) return out
  if (!isDbConfigured()) {
    for (const id of userIds) out.set(id, { ok: false, reason: 'db_non_configuree' })
    return out
  }
  const pool = getPool()
  const tPref = table('fleur_notification_preferences')
  const placeholders = userIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, preferences_json FROM ${tPref} WHERE user_id IN (${placeholders})`,
    userIds
  )
  const withPrefs = new Set<number>()
  for (const r of rows) {
    const userId = Number(r.user_id)
    if (!userId) continue
    withPrefs.add(userId)
    out.set(userId, parseEmailPrefsRow(r.preferences_json))
  }
  for (const id of userIds) {
    if (!out.has(id)) out.set(id, { ok: true })
  }
  return out
}

function findInCandidates(
  candidates: EngagementCandidate[],
  userId: number | null,
  emailNorm: string
): EngagementCandidate | undefined {
  return candidates.find(
    (c) =>
      (userId != null && c.userId === userId) ||
      normalizeOutboundEmail(c.email ?? '') === emailNorm
  )
}

export async function explainEngagementEmail(
  emailRaw: string,
  candidates: EngagementCandidate[],
  naturalUserIds: Set<number>,
  cooldownHours: number
): Promise<EmailEngagementExplain> {
  const reasons: string[] = []
  const emailNorm = normalizeOutboundEmail(emailRaw)
  const allowlist = engagementRemindAllowlist()
  const row = await lookupUserByEmail(emailNorm)

  if (!row) {
    return {
      email: emailRaw,
      userId: null,
      dbEmail: null,
      outcome: 'skipped',
      campaignId: null,
      source: null,
      inAppNotification: false,
      emailSmtp: false,
      reasons: ['compte_introuvable_en_base'],
    }
  }

  const { userId, email: dbEmail } = row
  const dbNorm = normalizeOutboundEmail(dbEmail)

  if (dbNorm !== emailNorm) {
    reasons.push(`email_allowlist_${emailNorm}_db_${dbNorm}`)
  }

  if (isVirtualAccount({ email: dbEmail })) {
    reasons.push('domaine_demo_ou_email_virtuel')
  }

  const realIds = await filterOutDemoUserIds([userId])
  if (realIds.length === 0) {
    reasons.push('compte_demo_mycelium_meta_fleur_demo_account')
  }

  const recentlyNudged = await findRecentlyNudgedUserIds(cooldownHours)
  if (recentlyNudged.has(userId)) {
    reasons.push(`cooldown_relance_${cooldownHours}h`)
  }

  if (allowlist && !allowlist.has(emailNorm) && !allowlist.has(dbNorm)) {
    reasons.push('hors_allowlist_engagement')
  }

  if (isNotificationOutboundRestricted() && !allowlist?.has(emailNorm)) {
    reasons.push('notifications_dev_only_actif')
  }

  const match = findInCandidates(candidates, userId, emailNorm)
  if (!match) {
    if (allowlist?.has(emailNorm) || allowlist?.has(dbNorm)) {
      reasons.push('allowlist_mais_exclu_pilote_demo_ou_cooldown')
    } else {
      reasons.push('pas_eligible_naturellement_activite_30j_plan14j_checkin_etc')
    }
    return {
      email: emailRaw,
      userId,
      dbEmail,
      outcome: 'skipped',
      campaignId: null,
      source: null,
      inAppNotification: false,
      emailSmtp: false,
      reasons,
    }
  }

  const source: 'natural' | 'pilot' = naturalUserIds.has(userId) ? 'natural' : 'pilot'

  if (!canSendEngagementRemindToEmail(dbEmail)) {
    reasons.push('filtre_allowlist_ou_dev_guard')
  }

  const inApp =
    realIds.length > 0 &&
    !recentlyNudged.has(userId) &&
    canSendEngagementRemindToEmail(dbEmail) &&
    Boolean(dbEmail?.trim())

  let emailSmtp = false
  if (inApp) {
    if (!isSmtpConfigured()) {
      reasons.push('smtp_non_configure')
    } else {
      const prefs = await checkEngagementEmailPrefs(userId)
      if (prefs.ok) {
        emailSmtp = true
      } else if (prefs.reason) {
        reasons.push(prefs.reason)
      }
    }
  }

  const outcome = inApp ? 'would_send' : 'skipped'
  if (outcome === 'would_send') {
    reasons.push(`campagne_${match.campaignId}`, `source_${source}`)
  }

  return {
    email: emailRaw,
    userId,
    dbEmail,
    outcome,
    campaignId: match.campaignId,
    source,
    inAppNotification: inApp,
    emailSmtp,
    reasons,
  }
}

export async function explainEngagementRemind(
  body: EngagementRemindInput,
  candidates: EngagementCandidate[],
  naturalCandidates: EngagementCandidate[]
): Promise<{
  smtpConfigured: boolean
  allowlistActive: boolean
  devRestricted: boolean
  emails: EmailEngagementExplain[]
  skippedCandidatesSample: Array<{
    userId: number
    email: string | null
    campaignId: string
    reasons: string[]
  }>
}> {
  const cooldownHours = Math.min(Math.max(body.cooldownHours ?? 20, 6), 168)
  const naturalUserIds = new Set(naturalCandidates.map((c) => c.userId))
  const allowlist = engagementRemindAllowlist()

  const emailsToExplain: string[] = allowlist
    ? [...allowlist]
    : candidates.slice(0, 20).map((c) => c.email ?? '').filter(Boolean)

  const emails: EmailEngagementExplain[] = []
  for (const e of emailsToExplain) {
    emails.push(await explainEngagementEmail(e, candidates, naturalUserIds, cooldownHours))
  }

  const skippedCandidatesSample: Array<{
    userId: number
    email: string | null
    campaignId: string
    reasons: string[]
  }> = []

  for (const c of candidates.slice(0, 30)) {
    const reasons: string[] = []
    if (!c.email) reasons.push('pas_email')
    if (c.email && isVirtualAccount({ email: c.email })) reasons.push('email_domaine_demo')
    const realIds = await filterOutDemoUserIds([c.userId])
    if (realIds.length === 0) reasons.push('compte_demo_meta')
    if (c.email && !canSendEngagementRemindToEmail(c.email)) {
      reasons.push(allowlist ? 'hors_allowlist' : 'dev_guard')
    }
    if (reasons.length > 0) {
      skippedCandidatesSample.push({
        userId: c.userId,
        email: c.email,
        campaignId: c.campaignId,
        reasons,
      })
    }
  }

  return {
    smtpConfigured: isSmtpConfigured(),
    allowlistActive: isEngagementRemindAllowlistActive(),
    devRestricted: isNotificationOutboundRestricted(),
    emails,
    skippedCandidatesSample,
  }
}

export async function allowlistEmailsMissingFromDatabase(): Promise<string[]> {
  const list = engagementRemindAllowlist()
  if (!list) return []
  const missing: string[] = []
  for (const raw of list) {
    const norm = normalizeOutboundEmail(raw)
    const row = await lookupUserByEmail(norm)
    if (!row) missing.push(raw)
  }
  return missing
}
