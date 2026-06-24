/**
 * E-mails transactionnels (invitations, notifications, contact, alertes admin).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import { buildFleurEmailLayout } from './email-layout'
import { resolveHeroInlineAttachments, type EmailInlineAttachment } from './email-inline-attachments'
import { loadEngagementPersonalization, type EngagementPersonalization } from './engagement-context'
import { buildJourneyChips, resolveEmailHero, campaignIdFromNotificationType } from './email-journey'
import type { EngagementCampaignId } from './engagement-templates'
import { tServer } from './i18n-server'
import { canSendEngagementRemindToEmail, canSendOutboundToEmail } from './notification-outbound'
import { isSmtpConfigured, trySendSmtpMail } from './smtp'
import { getUserLocalesBatch, resolveEmailLocale } from './user-locale'

const PREFS_META_KEY = 'fleur_notification_prefs'
const APP_NAME = "Fleur d'AmOurs"

type UserPrefs = {
  email_enabled: boolean
  email_digest: string
  quiet_hours_start: number | null
  quiet_hours_end: number | null
}

const DEFAULT_PREFS: UserPrefs = {
  email_enabled: true,
  email_digest: 'instant',
  quiet_hours_start: null,
  quiet_hours_end: null,
}

function normalizeEmail(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

function currentHourParis(): number {
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'Europe/Paris',
  })
  return parseInt(fmt.format(new Date()), 10)
}

function inQuietHours(start: number | null, end: number | null): boolean {
  if (start == null || end == null) return false
  const h = currentHourParis()
  if (start === end) return false
  if (start < end) return h >= start && h < end
  return h >= start || h < end
}

async function readUserPrefs(userId: number): Promise<UserPrefs> {
  if (!isDbConfigured() || !userId) return { ...DEFAULT_PREFS }
  const pool = getPool()
  const tMeta = table('usermeta')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, PREFS_META_KEY]
  )
  if (!rows?.length) return { ...DEFAULT_PREFS }
  try {
    const raw = JSON.parse(String(rows[0].meta_value ?? '{}')) as Record<string, unknown>
    return {
      email_enabled: raw.email_enabled !== false,
      email_digest: String(raw.email_digest ?? 'instant'),
      quiet_hours_start:
        raw.quiet_hours_start != null && raw.quiet_hours_start !== ''
          ? Math.min(23, Math.max(0, parseInt(String(raw.quiet_hours_start), 10)))
          : null,
      quiet_hours_end:
        raw.quiet_hours_end != null && raw.quiet_hours_end !== ''
          ? Math.min(23, Math.max(0, parseInt(String(raw.quiet_hours_end), 10)))
          : null,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

async function shouldSendInstantEmail(userId: number): Promise<boolean> {
  const prefs = await readUserPrefs(userId)
  if (!prefs.email_enabled) return false
  if (prefs.email_digest !== 'instant') return false
  if (inQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) return false
  return true
}

export async function buildNotificationEmailHtml(params: {
  title: string
  body?: string | null
  actionUrl?: string | null
  actionLabel?: string
  locale?: string
  highlight?: string | null
  preheader?: string | null
  mode?: 'user' | 'admin' | 'marketing'
  personalization?: EngagementPersonalization | null
  showGarden?: boolean
  bodyHtml?: string | null
  subtitle?: string | null
  badge?: string | null
  campaignId?: EngagementCampaignId
}): Promise<{ html: string; text: string; inlineImages?: EmailInlineAttachment[] }> {
  const locale = params.locale ?? 'fr'
  const title = String(params.title ?? '').trim()
  const body = params.body ? String(params.body).trim() : ''
  const highlight = params.highlight ? String(params.highlight).trim() : ''
  const actionPath = params.actionUrl ? String(params.actionUrl).trim() : ''
  const mode = params.mode ?? 'user'
  const actionLabel =
    params.actionLabel ?? tServer(locale, 'email.shell.openInGarden')

  const p = params.personalization
  const showGarden = params.showGarden !== false && mode === 'user' && !!p
  let hero =
    showGarden && p ? resolveEmailHero(p) : mode === 'admin' ? { type: 'none' as const } : { type: 'logo' as const }
  const journeyChips = showGarden && p ? buildJourneyChips(p.locale, p, params.campaignId) : undefined

  const inlineImages: EmailInlineAttachment[] = []
  if (hero.type === 'flower' || hero.type === 'logo') {
    const resolved = await resolveHeroInlineAttachments(hero)
    hero = resolved.hero
    inlineImages.push(...resolved.attachments)
  }

  const layout = buildFleurEmailLayout({
    locale,
    preheader: params.preheader ?? highlight ?? body.slice(0, 100),
    mode,
    title,
    subtitle: params.subtitle,
    badge: params.badge,
    hero,
    journeyChips,
    body: params.bodyHtml ? undefined : body,
    bodyHtml: params.bodyHtml ?? undefined,
    highlight: highlight || null,
    cta:
      mode !== 'admin' && actionPath
        ? { label: actionLabel, url: actionPath }
        : null,
  })

  return {
    ...layout,
    inlineImages: inlineImages.length ? inlineImages : undefined,
  }
}

export async function sendTransactionalEmail(params: {
  to: string
  subject: string
  html: string
  text?: string
  userId?: number | null
  skipPrefs?: boolean
  skipDevGuard?: boolean
  replyTo?: string
  headers?: Record<string, string>
  inlineImages?: EmailInlineAttachment[]
}): Promise<{ sent: boolean; error?: string; messageId?: string }> {
  const to = normalizeEmail(params.to)
  if (!to || !to.includes('@')) return { sent: false, error: 'Email destinataire invalide' }
  const canSend =
    canSendOutboundToEmail(to, { skipDevGuard: params.skipDevGuard }) ||
    canSendEngagementRemindToEmail(to, { skipDevGuard: params.skipDevGuard })
  if (!canSend) {
    return { sent: false, error: 'Environnement dev : envoi limité à eludinart@gmail.com' }
  }
  if (!params.skipPrefs && params.userId) {
    const ok = await shouldSendInstantEmail(params.userId)
    if (!ok) return { sent: false, error: 'Préférences utilisateur : e-mail désactivé ou hors instantané' }
  }
  const result = await trySendSmtpMail({
    to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
    headers: params.headers,
    attachments: params.inlineImages,
  })
  if (!result.ok) return { sent: false, error: result.error }
  return { sent: true, messageId: result.messageId }
}

export async function getStaffEmails(roles: Array<'admin' | 'coach'>): Promise<string[]> {
  if (!isDbConfigured() || roles.length === 0) return []
  const pool = getPool()
  const tUsers = table('users')
  const tRoles = table('fleur_app_roles')
  const placeholders = roles.map(() => '?').join(', ')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT DISTINCT u.user_email as email
     FROM ${tUsers} u
     WHERE u.user_email IS NOT NULL AND u.user_email != ''
       AND (
         u.ID IN (SELECT user_id FROM ${tRoles} WHERE app_role IN (${placeholders}))
       )`,
    roles
  )
  return [...new Set(rows.map((r) => normalizeEmail(r.email)).filter((e) => e.includes('@')))]
}

export async function sendAdminAlertEmail(params: {
  subject: string
  title?: string
  body?: string
  html?: string
  text?: string
  roles?: Array<'admin' | 'coach'>
}): Promise<{ sent: number; errors: string[] }> {
  const roles = params.roles ?? ['admin']
  const emails = await getStaffEmails(roles)
  if (!emails.length) return { sent: 0, errors: ['Aucun e-mail staff trouvé'] }

  const title = params.title ?? params.subject
  const bodyText = params.body ?? params.text ?? ''
  const built =
    params.html && !params.body
      ? { html: params.html, text: params.text ?? '' }
      : await buildNotificationEmailHtml({
          title,
          body: bodyText,
          mode: 'admin',
          locale: 'fr',
        })
  const { html, text } = built

  let sent = 0
  const errors: string[] = []
  for (const to of emails) {
    const r = await sendTransactionalEmail({
      to,
      subject: params.subject,
      html,
      text,
      skipPrefs: true,
    })
    if (r.sent) sent++
    else if (r.error) errors.push(`${to}: ${r.error}`)
  }
  return { sent, errors }
}

export type NotificationEmailDispatchInput = {
  notificationId?: number
  type: string
  title: string
  body?: string | null
  actionUrl?: string | null
  actionLabel?: string | null
  locale?: string
  highlight?: string | null
  personalization?: EngagementPersonalization | null
  recipients: Array<{ user_id: number; email: string }>
  extraEmails?: string[]
  skipDevGuard?: boolean
  campaignId?: EngagementCampaignId
}

export async function dispatchNotificationEmails(input: NotificationEmailDispatchInput): Promise<void> {
  const { markDeliveryEmailStatus } = await import('./db-notifications')
  if (!isSmtpConfigured()) {
    if (input.notificationId) {
      for (const r of input.recipients) {
        if (!r.user_id) continue
        await markDeliveryEmailStatus({
          notificationId: input.notificationId,
          userId: r.user_id,
          sent: false,
          error: 'SMTP non configuré',
        })
      }
    }
    return
  }
  const subject = (input.title || '').slice(0, 200)
  const headers: Record<string, string> = {}
  if (input.notificationId) headers['X-Fleur-Notification-Id'] = String(input.notificationId)
  if (input.type) headers['X-Fleur-Notification-Type'] = input.type

  const userIds = input.recipients.map((r) => r.user_id).filter(Boolean)
  const localeMap = await getUserLocalesBatch(userIds)

  const seen = new Set<string>()
  for (const r of input.recipients) {
    const email = normalizeEmail(r.email)
    if (!email || seen.has(email)) continue
    seen.add(email)

    const locale =
      input.locale ??
      input.personalization?.locale ??
      localeMap.get(r.user_id) ??
      'fr'

    const campaignId = input.campaignId ?? campaignIdFromNotificationType(input.type ?? '')
    const engagement = isEngagementType(input.type)
    const personalization = r.user_id
      ? await resolveRecipientPersonalization(r.user_id, email, input.personalization, engagement)
      : input.personalization

    const { html, text, inlineImages } = await buildNotificationEmailHtml({
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      actionLabel: input.actionLabel ?? undefined,
      locale,
      highlight: input.highlight,
      personalization,
      showGarden: engagement || !!personalization,
      campaignId,
    })

    const result = await sendTransactionalEmail({
      to: email,
      userId: r.user_id,
      subject,
      html,
      text,
      headers,
      skipDevGuard: input.skipDevGuard,
      inlineImages,
    })

    if (input.notificationId && r.user_id) {
      await markDeliveryEmailStatus({
        notificationId: input.notificationId,
        userId: r.user_id,
        sent: result.sent,
        error: result.error,
      })
    }
  }

  for (const raw of input.extraEmails ?? []) {
    const email = normalizeEmail(raw)
    if (!email || seen.has(email)) continue
    seen.add(email)
    const locale = input.locale ?? 'fr'
    const { html, text, inlineImages } = await buildNotificationEmailHtml({
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      actionLabel: input.actionLabel ?? undefined,
      locale,
      highlight: input.highlight,
      showGarden: false,
    })
    await sendTransactionalEmail({
      to: email,
      subject,
      html,
      text,
      skipPrefs: true,
      skipDevGuard: input.skipDevGuard,
      headers,
      inlineImages,
    })
  }
}

function mergeEngagementPersonalization(
  input: EngagementPersonalization | null | undefined,
  loaded: EngagementPersonalization
): EngagementPersonalization {
  if (!input) return loaded
  return {
    ...loaded,
    ...input,
    petalScores: input.petalScores ?? loaded.petalScores,
    hasFleurProfile: input.hasFleurProfile ?? loaded.hasFleurProfile,
    dominantPetalId: input.dominantPetalId ?? loaded.dominantPetalId,
    dominantPetalName: input.dominantPetalName ?? loaded.dominantPetalName,
    plan14j: input.plan14j ?? loaded.plan14j,
    plan14jSessionId: input.plan14jSessionId ?? loaded.plan14jSessionId,
    locale: input.locale ?? loaded.locale,
  }
}

async function resolveRecipientPersonalization(
  userId: number,
  email: string,
  input: EngagementPersonalization | null | undefined,
  engagement: boolean
): Promise<EngagementPersonalization | null | undefined> {
  if (!engagement) return input
  const loaded = await loadEngagementPersonalization(userId, email)
  return mergeEngagementPersonalization(input, loaded)
}

function isEngagementType(type: string): boolean {
  return (
    type.startsWith('engagement_') ||
    type === 'plan14j_reminder' ||
    type === 'checkin_reminder'
  )
}

export async function sendInviteEmail(params: {
  to: string
  subject: string
  intro: string
  inviteUrl: string
  ctaLabel?: string
  locale?: string
}): Promise<{ sent: boolean; error?: string }> {
  const locale = params.locale ?? 'fr'
  const cta = params.ctaLabel ?? tServer(locale, 'email.invite.ctaDefault')
  const { html, text, inlineImages } = await buildNotificationEmailHtml({
    title: params.subject,
    body: params.intro,
    actionUrl: params.inviteUrl,
    actionLabel: cta,
    locale,
    showGarden: false,
  })
  return sendTransactionalEmail({
    to: params.to,
    subject: params.subject,
    html,
    text,
    skipPrefs: true,
    inlineImages,
  })
}

export async function sendDuoInviteEmail(params: {
  to: string
  subject?: string
  inviterName: string
  inviterDisplayName?: string | null
  inviterUserId?: number
  inviteUrl: string
  scores: Record<string, number>
  kind: 'a_deux_porte' | 'a_deux_complet' | 'duo_classic' | 'couple_garden'
  porteKey?: string | null
  ctaLabel?: string
  locale?: string
}): Promise<{ sent: boolean; error?: string }> {
  const { buildDuoInviteEmailContent } = await import('./email-duo-invite')
  const locale =
    params.locale ?? (await resolveEmailLocale({ userId: params.inviterUserId }))
  const { html, text, subject, inlineImages } = await buildDuoInviteEmailContent({ ...params, locale })
  return sendTransactionalEmail({
    to: params.to,
    subject: params.subject ?? subject,
    html,
    text,
    skipPrefs: true,
    inlineImages,
  })
}

export async function sendContactConfirmationEmail(params: {
  to: string
  name?: string | null
  userId?: number | null
}): Promise<{ sent: boolean; error?: string }> {
  const locale = await resolveEmailLocale({ userId: params.userId })
  const greeting = params.name?.trim()
    ? tServer(locale, 'email.contact.replyGreeting', { name: params.name.trim() })
    : tServer(locale, 'email.contact.replyGreetingGeneric')
  const body = `${greeting}\n\n${tServer(locale, 'email.contact.confirmBody')}`
  const { html, text, inlineImages } = await buildNotificationEmailHtml({
    title: tServer(locale, 'email.contact.confirmTitle'),
    body,
    actionUrl: '/',
    actionLabel: tServer(locale, 'email.contact.confirmCta'),
    locale,
    showGarden: false,
  })
  return sendTransactionalEmail({
    to: params.to,
    subject: tServer(locale, 'email.contact.confirmSubject'),
    html,
    text,
    userId: params.userId,
    skipPrefs: true,
    inlineImages,
  })
}

export { buildFleurEmailLayout, wrapBroadcastEmailHtml } from './email-layout'
export { isSmtpConfigured } from './smtp'
