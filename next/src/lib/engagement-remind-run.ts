/**
 * Logique métier des relances engagement (route API + cron Coolify).
 */
import type { EngagementCandidate } from '@/lib/db-engagement'
import { isDbConfigured } from '@/lib/db'
import { findAllowlistPilotCandidates, findEngagementCandidates, findRecentlyNudgedUserIds, countInactiveUsers } from '@/lib/db-engagement'
import { loadEngagementPersonalization } from '@/lib/engagement-context'
import { sendEngagementNotification } from '@/lib/send-engagement-notification'
import {
  canSendEngagementRemindToEmail,
  engagementRemindAllowlist,
  isEngagementRemindAllowlistActive,
  isNotificationOutboundRestricted,
} from '@/lib/notification-outbound'
import { filterOutDemoUserIds } from '@/lib/demo-accounts-filter'
import { isVirtualAccount } from '@/lib/demo-accounts'
import { isSmtpConfigured } from '@/lib/smtp'
import {
  allowlistEmailsMissingFromDatabase,
  checkEngagementEmailPrefs,
  explainEngagementRemind,
} from '@/lib/engagement-remind-explain'
import { buildEngagementTemplate, type EngagementCampaignId } from '@/lib/engagement-templates'

export type EngagementRemindInput = {
  limit?: number
  activityDays?: number
  cooldownHours?: number
  tirageStaleDays?: number
  dreamscapeStaleDays?: number
  inactiveDays?: number
  dryRun?: boolean
}

async function describeDeliverability(
  c: EngagementCandidate
): Promise<{ deliverable: boolean; skipReasons: string[] }> {
  const skipReasons: string[] = []
  if (!c.email?.trim()) {
    skipReasons.push('pas_email')
    return { deliverable: false, skipReasons }
  }
  if (isVirtualAccount({ email: c.email })) {
    skipReasons.push('compte_virtuel')
    return { deliverable: false, skipReasons }
  }
  const realIds = await filterOutDemoUserIds([c.userId])
  if (realIds.length === 0) {
    skipReasons.push('compte_demo')
    return { deliverable: false, skipReasons }
  }
  if (!canSendEngagementRemindToEmail(c.email)) {
    if (isEngagementRemindAllowlistActive()) skipReasons.push('hors_allowlist')
    else if (isNotificationOutboundRestricted()) skipReasons.push('mode_dev_envoi_restreint')
    else skipReasons.push('filtre_envoi')
    return { deliverable: false, skipReasons }
  }
  return { deliverable: true, skipReasons }
}

async function isDeliverableCandidate(c: EngagementCandidate): Promise<boolean> {
  return (await describeDeliverability(c)).deliverable
}

async function resolveCandidates(
  body: EngagementRemindInput
): Promise<{ candidates: EngagementCandidate[]; natural: EngagementCandidate[]; pilotAdded: number }> {
  const cooldownHours = Math.min(Math.max(body.cooldownHours ?? 20, 6), 168)
  const base = await findEngagementCandidates({
    limit: body.limit,
    activityDays: body.activityDays,
    cooldownHours: body.cooldownHours,
    tirageStaleDays: body.tirageStaleDays,
    dreamscapeStaleDays: body.dreamscapeStaleDays,
    inactiveDays: body.inactiveDays,
  })

  const list = engagementRemindAllowlist()
  if (!list) return { candidates: base, natural: base, pilotAdded: 0 }

  const assigned = new Set(base.map((c) => c.userId))
  const pilots = await findAllowlistPilotCandidates(list, assigned, cooldownHours)
  return { candidates: [...base, ...pilots], natural: base, pilotAdded: pilots.length }
}

export type EngagementRemindResult =
  | {
      dryRun: true
      devRestricted: boolean
      allowlistActive: boolean
      candidates: number
      pilotAdded: number
      wouldSend: number
      allowlistNotFound: string[]
      explain?: Awaited<ReturnType<typeof explainEngagementRemind>>
      sample: Array<
        Pick<EngagementCandidate, 'userId' | 'campaignId' | 'vars'> & { email: string | null }
      >
    }
  | {
      candidates: number
      pilotAdded: number
      sent: number
      skipped: number
      byCampaign: Record<string, number>
      devRestricted: boolean
      allowlistActive: boolean
      allowlistNotFound: string[]
    }
  | { error: string; status: number }

export type EngagementRecipientPreview = {
  userId: number
  email: string
  displayName: string | null
  locale: string
  campaignId: EngagementCampaignId
  source: 'natural' | 'pilot'
  inApp: boolean
  willSendEmail: boolean
  wouldDeliver: boolean
  skipReasons: string[]
  emailSkipReasons: string[]
  notification: {
    type: string
    title: string
    body: string
    action_label: string
    action_url: string
  }
  emailPreview: {
    subject: string
  }
}

export type EngagementAudiencePreview = {
  generatedAt: string
  params: {
    limit: number
    cooldownHours: number
    inactiveDays: number
    activityDays: number
  }
  candidates: number
  pilotAdded: number
  wouldSend: number
  byCampaign: Record<string, number>
  devRestricted: boolean
  allowlistActive: boolean
  smtpConfigured: boolean
  allowlistNotFound: string[]
  diagnostics: {
    recentlyNudgedCooldown: number
    inactiveUsersTotal: number
    comebackInQueue: number
  }
  recipients: EngagementRecipientPreview[]
}

export async function previewEngagementAudience(
  body: EngagementRemindInput
): Promise<EngagementAudiencePreview | { error: string; status: number }> {
  if (!isDbConfigured()) {
    return { error: 'Backend non configuré', status: 503 }
  }

  const limit = Math.min(Math.max(body.limit ?? 250, 1), 500)
  const cooldownHours = Math.min(Math.max(body.cooldownHours ?? 20, 6), 168)
  const inactiveDays = Math.min(Math.max(body.inactiveDays ?? 15, 7), 90)
  const activityDays = Math.min(Math.max(body.activityDays ?? 30, 7), 90)

  const { candidates, natural, pilotAdded } = await resolveCandidates({
    ...body,
    limit,
    cooldownHours,
    inactiveDays,
    activityDays,
  })
  const naturalUserIds = new Set(natural.map((c) => c.userId))
  const notFound = await allowlistEmailsMissingFromDatabase()
  const recentlyNudged = await findRecentlyNudgedUserIds(cooldownHours)
  const inactiveUsersTotal = await countInactiveUsers(inactiveDays)

  const recipients: EngagementRecipientPreview[] = []
  const byCampaign: Record<string, number> = {}
  let wouldDeliverCount = 0

  for (const c of candidates) {
    const { deliverable, skipReasons } = await describeDeliverability(c)
    if (deliverable) wouldDeliverCount++

    const email = String(c.email ?? '').trim()
    const personalization = await loadEngagementPersonalization(c.userId, email)
    const vars = {
      ...(c.vars ?? {}),
      personalization,
      ...(c.campaignId === 'plan14j' && c.source_id ? { sessionId: c.source_id } : {}),
    }
    const template = buildEngagementTemplate(c.campaignId, personalization.locale, vars)

    const emailSkipReasons: string[] = []
    let emailChannel = false
    if (!deliverable) {
      emailSkipReasons.push(...skipReasons)
    } else if (!isSmtpConfigured()) {
      emailSkipReasons.push('smtp_non_configure')
    } else {
      const prefs = await checkEngagementEmailPrefs(c.userId)
      if (prefs.ok) {
        emailChannel = true
      } else if (prefs.reason) {
        emailSkipReasons.push(prefs.reason)
      }
    }

    const source: 'natural' | 'pilot' = naturalUserIds.has(c.userId) ? 'natural' : 'pilot'
    byCampaign[c.campaignId] = (byCampaign[c.campaignId] ?? 0) + 1

    recipients.push({
      userId: c.userId,
      email,
      displayName: personalization.displayName || personalization.pseudo || null,
      locale: template.locale,
      campaignId: c.campaignId,
      source,
      inApp: deliverable,
      willSendEmail: deliverable && emailChannel,
      wouldDeliver: deliverable,
      skipReasons,
      emailSkipReasons,
      notification: {
        type: template.type,
        title: template.title,
        body: template.body,
        action_label: template.action_label,
        action_url: template.action_url,
      },
      emailPreview: {
        subject: template.emailSubject,
      },
    })
  }

  return {
    generatedAt: new Date().toISOString(),
    params: { limit, cooldownHours, inactiveDays, activityDays },
    candidates: candidates.length,
    pilotAdded,
    wouldSend: wouldDeliverCount,
    byCampaign,
    devRestricted: isNotificationOutboundRestricted(),
    allowlistActive: isEngagementRemindAllowlistActive(),
    smtpConfigured: isSmtpConfigured(),
    allowlistNotFound: notFound,
    diagnostics: {
      recentlyNudgedCooldown: recentlyNudged.size,
      inactiveUsersTotal,
      comebackInQueue: candidates.filter((c) => c.campaignId === 'comeback').length,
    },
    recipients,
  }
}

export async function runEngagementRemind(
  body: EngagementRemindInput
): Promise<EngagementRemindResult> {
  if (!isDbConfigured()) {
    return { error: 'Backend non configuré', status: 503 }
  }

  const { candidates, natural, pilotAdded } = await resolveCandidates(body)
  const notFound = await allowlistEmailsMissingFromDatabase()

  if (body.dryRun) {
    const deliverable: EngagementCandidate[] = []
    for (const c of candidates) {
      if (await isDeliverableCandidate(c)) deliverable.push(c)
    }
    const explain = await explainEngagementRemind(body, candidates, natural)
    return {
      dryRun: true,
      devRestricted: isNotificationOutboundRestricted(),
      allowlistActive: isEngagementRemindAllowlistActive(),
      candidates: candidates.length,
      pilotAdded,
      wouldSend: deliverable.length,
      allowlistNotFound: notFound,
      explain,
      sample: deliverable.slice(0, 15).map((c) => ({
        userId: c.userId,
        email: c.email,
        campaignId: c.campaignId,
        vars: c.vars,
      })),
    }
  }

  let sent = 0
  let skipped = 0
  const byCampaign: Record<string, number> = {}

  for (const c of candidates) {
    if (!(await isDeliverableCandidate(c))) {
      skipped++
      continue
    }
    try {
      const personalization = await loadEngagementPersonalization(c.userId, c.email!)
      const allowlisted =
        isEngagementRemindAllowlistActive() && canSendEngagementRemindToEmail(c.email!)
      const result = await sendEngagementNotification({
        userId: c.userId,
        email: c.email,
        campaignId: c.campaignId,
        vars: c.vars,
        personalization,
        source_id: c.source_id ?? null,
        skipDevGuard: allowlisted,
      })
      if (!result.sent) {
        skipped++
        continue
      }
      sent++
      byCampaign[c.campaignId] = (byCampaign[c.campaignId] ?? 0) + 1
    } catch {
      skipped++
    }
  }

  return {
    candidates: candidates.length,
    pilotAdded,
    sent,
    skipped,
    byCampaign,
    devRestricted: isNotificationOutboundRestricted(),
    allowlistActive: isEngagementRemindAllowlistActive(),
    allowlistNotFound: notFound,
  }
}
