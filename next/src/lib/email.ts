/**
 * E-mails transactionnels (invitations, notifications, contact, alertes admin).
 */
import type { RowDataPacket } from 'mysql2'
import { absolutePublicAppUrl } from './app-public-url'
import { getPool, isDbConfigured, table } from './db'
import { tServer } from './i18n-server'
import { canSendOutboundToEmail } from './notification-outbound'
import { isSmtpConfigured, trySendSmtpMail } from './smtp'

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

export function buildNotificationEmailHtml(params: {
  title: string
  body?: string | null
  actionUrl?: string | null
  actionLabel?: string
  locale?: string
  highlight?: string | null
}): { html: string; text: string } {
  const locale = params.locale ?? 'fr'
  const title = String(params.title ?? '').trim()
  const body = params.body ? String(params.body).trim() : ''
  const highlight = params.highlight ? String(params.highlight).trim() : ''
  const actionPath = params.actionUrl ? String(params.actionUrl).trim() : ''
  const actionAbs = actionPath
    ? actionPath.startsWith('http')
      ? actionPath
      : absolutePublicAppUrl(actionPath)
    : ''
  const actionLabel =
    params.actionLabel ?? tServer(locale, 'engagement.emailCtaDefault')
  const footer = tServer(locale, 'engagement.emailFooter')
  const textParts = [title, body, highlight, actionAbs ? `${actionLabel} : ${actionAbs}` : ''].filter(Boolean)
  const text = textParts.join('\n\n')
  const bodyHtml = body
    ? body
        .split(/\n\n+/)
        .map(
          (p) =>
            `<p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.6">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`
        )
        .join('')
    : ''
  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="font-family:Georgia,serif;line-height:1.55;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;background:#fafafa">
  <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #e2e8f0;color:#334155">
    <p style="color:#7c3aed;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 12px">${APP_NAME}</p>
    <h1 style="font-size:22px;margin:0 0 16px;line-height:1.3;color:#0f172a">${escapeHtml(title)}</h1>
    ${bodyHtml}
    ${
      highlight
        ? `<div style="margin:16px 0;padding:14px 16px;background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:8px;font-size:15px;line-height:1.5;color:#4c1d95">${escapeHtml(highlight)}</div>`
        : ''
    }
    ${
      actionAbs
        ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(actionAbs)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600;font-size:15px">${escapeHtml(actionLabel)}</a></p>`
        : ''
    }
  </div>
  <p style="font-size:12px;color:#64748b;margin-top:24px;text-align:center;line-height:1.5">${escapeHtml(footer)}</p>
</body>
</html>`
  return { html, text }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
}): Promise<{ sent: boolean; error?: string; messageId?: string }> {
  const to = normalizeEmail(params.to)
  if (!to || !to.includes('@')) return { sent: false, error: 'Email destinataire invalide' }
  if (!canSendOutboundToEmail(to, { skipDevGuard: params.skipDevGuard })) {
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
  html: string
  text?: string
  roles?: Array<'admin' | 'coach'>
}): Promise<{ sent: number; errors: string[] }> {
  const roles = params.roles ?? ['admin']
  const emails = await getStaffEmails(roles)
  if (!emails.length) return { sent: 0, errors: ['Aucun e-mail staff trouvé'] }
  let sent = 0
  const errors: string[] = []
  for (const to of emails) {
    const r = await sendTransactionalEmail({
      to,
      subject: params.subject,
      html: params.html,
      text: params.text,
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
  recipients: Array<{ user_id: number; email: string }>
  extraEmails?: string[]
  skipDevGuard?: boolean
}

export async function dispatchNotificationEmails(input: NotificationEmailDispatchInput): Promise<void> {
  if (!isSmtpConfigured()) return
  const { html, text } = buildNotificationEmailHtml({
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl,
    actionLabel: input.actionLabel ?? undefined,
    locale: input.locale,
    highlight: input.highlight,
  })
  const subject = (input.title || '').slice(0, 200)
  const headers: Record<string, string> = {}
  if (input.notificationId) headers['X-Fleur-Notification-Id'] = String(input.notificationId)
  if (input.type) headers['X-Fleur-Notification-Type'] = input.type

  const seen = new Set<string>()
  for (const r of input.recipients) {
    const email = normalizeEmail(r.email)
    if (!email || seen.has(email)) continue
    seen.add(email)
    await sendTransactionalEmail({
      to: email,
      userId: r.user_id,
      subject,
      html,
      text,
      headers,
      skipDevGuard: input.skipDevGuard,
    })
  }
  for (const raw of input.extraEmails ?? []) {
    const email = normalizeEmail(raw)
    if (!email || seen.has(email)) continue
    seen.add(email)
    await sendTransactionalEmail({
      to: email,
      subject,
      html,
      text,
      skipPrefs: true,
      skipDevGuard: input.skipDevGuard,
      headers,
    })
  }
}

export async function sendInviteEmail(params: {
  to: string
  subject: string
  intro: string
  inviteUrl: string
  ctaLabel?: string
}): Promise<{ sent: boolean; error?: string }> {
  const cta = params.ctaLabel ?? 'Accepter l\'invitation'
  const { html, text } = buildNotificationEmailHtml({
    title: params.subject,
    body: params.intro,
    actionUrl: params.inviteUrl,
    actionLabel: cta,
  })
  return sendTransactionalEmail({
    to: params.to,
    subject: params.subject,
    html,
    text,
    skipPrefs: true,
  })
}

export async function sendDuoInviteEmail(
  params: {
    to: string
    subject?: string
    inviterName: string
    inviterDisplayName?: string | null
    inviteUrl: string
    scores: Record<string, number>
    kind: 'a_deux_porte' | 'a_deux_complet' | 'duo_classic' | 'couple_garden'
    porteKey?: string | null
    ctaLabel?: string
  }
): Promise<{ sent: boolean; error?: string }> {
  const { buildDuoInviteEmailContent } = await import('./email-duo-invite')
  const { html, text, subject } = buildDuoInviteEmailContent(params)
  return sendTransactionalEmail({
    to: params.to,
    subject: params.subject ?? subject,
    html,
    text,
    skipPrefs: true,
  })
}

export async function sendContactConfirmationEmail(params: {
  to: string
  name?: string | null
}): Promise<{ sent: boolean; error?: string }> {
  const greeting = params.name?.trim() ? `Bonjour ${params.name.trim()},` : 'Bonjour,'
  const body = `${greeting}\n\nVotre demande a bien été reçue. Nous vous recontacterons dans les 48h ouvrées à cette adresse.`
  const { html, text } = buildNotificationEmailHtml({
    title: 'Message bien reçu',
    body,
    actionUrl: '/',
    actionLabel: 'Retour au Jardin',
  })
  return sendTransactionalEmail({
    to: params.to,
    subject: `${APP_NAME} — confirmation de votre message`,
    html,
    text,
    skipPrefs: true,
  })
}

export { isSmtpConfigured }
