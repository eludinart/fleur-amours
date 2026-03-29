/**
 * SMTP sender (Hostinger ou autre).
 *
 * Env:
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_USER
 * - SMTP_PASS
 * - SMTP_SECURE=true|false (optionnel)
 * - SMTP_FROM="Fleur d'AmOurs <noreply@...>"
 * - SMTP_REPLY_TO=... (optionnel)
 */
import nodemailer from 'nodemailer'

export type SmtpMessage = {
  to: string
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
  headers?: Record<string, string>
}

function envBool(v: string | undefined, fallback: boolean): boolean {
  if (!v) return fallback
  const s = v.trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'no') return false
  return fallback
}

export function getSmtpTransport() {
  const host = process.env.SMTP_HOST?.trim() || ''
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const user = process.env.SMTP_USER?.trim() || ''
  const pass = process.env.SMTP_PASS ?? ''
  const secure = envBool(process.env.SMTP_SECURE, port === 465)

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST/SMTP_USER/SMTP_PASS requis')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
}

export async function sendSmtpMail(msg: SmtpMessage): Promise<{ messageId: string }> {
  const transport = getSmtpTransport()
  const from = msg.from ?? process.env.SMTP_FROM ?? ''
  const replyTo = msg.replyTo ?? process.env.SMTP_REPLY_TO ?? undefined
  if (!from) throw new Error('SMTP_FROM requis (ex: "Nom <noreply@domaine>")')
  if (!msg.to) throw new Error('to requis')
  if (!msg.subject) throw new Error('subject requis')

  const info = await transport.sendMail({
    from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo,
    headers: msg.headers,
  })
  return { messageId: String(info.messageId ?? '') }
}

