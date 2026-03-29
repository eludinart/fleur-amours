/**
 * POST /api/contact_messages/save — Enregistre un message de contact.
 *
 * Accessible aux utilisateurs connectés ET aux visiteurs non authentifiés.
 * Body : { email, name?, subject?, message }
 *
 * Actions :
 *   1. Valide les champs obligatoires (email + message).
 *   2. Insère dans wp_fleur_contact_messages.
 *   3. Envoie une notification email (SMTP) — échec non bloquant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthHeader } from '@/lib/api-auth'
import { jwtDecode } from '@/lib/jwt'
import { isDbConfigured } from '@/lib/db'
import { insertContactMessage } from '@/lib/db-contact'
import { sendSmtpMail } from '@/lib/smtp'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  )
}

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Backend non configuré.' }, { status: 503 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() || null : null
  const subject = typeof body.subject === 'string' ? body.subject.trim() || null : null

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
  }
  if (!message || message.length < 5) {
    return NextResponse.json({ error: 'Message trop court (minimum 5 caractères).' }, { status: 400 })
  }
  if (message.length > 10_000) {
    return NextResponse.json({ error: 'Message trop long (maximum 10 000 caractères).' }, { status: 400 })
  }

  // Récupérer l'user_id si l'utilisateur est connecté (optionnel)
  let userId: number | null = null
  try {
    const token = getAuthHeader(req)
    if (token) {
      const payload = jwtDecode(token)
      if (payload?.sub) userId = parseInt(payload.sub, 10) || null
    }
  } catch {
    // Non authentifié : on continue sans user_id
  }

  try {
    const { id } = await insertContactMessage({
      user_id: userId,
      email,
      name,
      subject,
      message,
      ip_address: getClientIp(req),
    })

    // Notification email admin — échec silencieux pour ne pas bloquer l'utilisateur
    const adminTo = process.env.SMTP_ADMIN_TO ?? process.env.SMTP_FROM ?? ''
    if (adminTo) {
      sendSmtpMail({
        to: adminTo,
        subject: `[Contact Fleur d'AmOurs] ${subject ?? 'Nouveau message'}`,
        html: `
          <p><strong>De :</strong> ${name ?? '—'} &lt;${email}&gt;</p>
          <p><strong>Sujet :</strong> ${subject ?? '(sans objet)'}</p>
          <hr/>
          <p>${message.replace(/\n/g, '<br/>')}</p>
          <hr/>
          <small>Message #${id} — User ID : ${userId ?? 'invité'} — IP : ${getClientIp(req) ?? '?'}</small>
        `,
        replyTo: email,
      }).catch((err) => console.warn('[contact/save] Email admin non envoyé :', err?.message))
    }

    // Accusé de réception à l'expéditeur — échec silencieux
    sendSmtpMail({
      to: email,
      subject: `Votre message a bien été reçu — Fleur d'AmOurs`,
      html: `
        <p>Bonjour ${name ?? ''},</p>
        <p>Nous avons bien reçu votre message et vous répondrons dans les meilleurs délais.</p>
        <hr/>
        <p><em>${message.replace(/\n/g, '<br/>')}</em></p>
        <p>Avec bienveillance,<br/>L'équipe Fleur d'AmOurs</p>
      `,
    }).catch((err) => console.warn('[contact/save] Accusé de réception non envoyé :', err?.message))

    return NextResponse.json({ success: true, id }, { status: 201 })
  } catch (err) {
    console.error('[contact/save]', err)
    return NextResponse.json({ error: 'Erreur lors de l\'enregistrement du message.' }, { status: 500 })
  }
}
