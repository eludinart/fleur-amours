/**
 * E-mails transactionnels (invitations, notifications, contact, alertes admin).
 */
import type { RowDataPacket } from 'mysql2'
import { absolutePublicAppUrl } from './app-public-url'
import { getPool, isDbConfigured, table } from './db'
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
}): { html: string; text: string } {
  const title = String(params.title ?? '').trim()
  const body = params.body ? String(params.body).trim() : ''
  const actionPath = params.actionUrl ? String(params.actionUrl).trim() : ''
  const actionAbs = actionPath
    ? actionPath.startsWith('http')
      ? actionPath
      : absolutePublicAppUrl(actionPath)
    : ''
  const actionLabel = params.actionLabel ?? 'Ouvrir dans le Jardin'
  const textParts = [title, body, actionAbs ? `${actionLabel} : ${actionAbs}` : ''].filter(Boolean)
  const text = textParts.join('\n\n')
  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="font-family:Georgia,serif;line-height:1.5;color:#1e293b;max-width:560px;margin:0 auto;padding:24px">
  <p style="color:#7c3aed;font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">${APP_NAME}</p>
  <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
  ${body ? `<p style="margin:0 0 16px">${escapeHtml(body).replace(/\n/g, '<br>')}</p>` : ''}
  ${
    actionAbs
      ? `<p style="margin:24px 0"><a href="${escapeHtml(actionAbs)}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">${escapeHtml(actionLabel)}</a></p>`
      : ''
  }
  <p style="font-size:12px;color:#64748b;margin-top:32px">Vous recevez cet e-mail car vous utilisez ${APP_NAME}. Gérez vos préférences dans le Jardin.</p>
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
  replyTo?: string
  headers?: Record<string, string>
}): Promise<{ sent: boolean; error?: string; messageId?: string }> {
  const to = normalizeEmail(params.to)
  if (!to || !to.includes('@')) return { sent: false, error: 'Email destinataire invalide' }
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
  recipients: Array<{ user_id: number; email: string }>
  extraEmails?: string[]
}

export async function dispatchNotificationEmails(input: NotificationEmailDispatchInput): Promise<void> {
  if (!isSmtpConfigured()) return
  const { html, text } = buildNotificationEmailHtml({
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl,
    actionLabel: input.actionLabel ?? undefined,
  })
  const subject = input.title.slice(0, 200)
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
