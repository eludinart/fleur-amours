/**
 * PATCH /api/contact_messages/[id] — marquer lu / répondre par e-mail.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAdminOrCoach } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getContactMessage, updateContactMessageStatus } from '@/lib/db-contact'
import { createNotification } from '@/lib/db-notifications'
import { buildNotificationEmailHtml, sendTransactionalEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  try {
    const { userId } = await requireAdminOrCoach(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { id: idStr } = await ctx.params
    const id = parseInt(idStr, 10)
    if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

    const msg = await getContactMessage(id)
    if (!msg) return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })

    const body = (await req.json().catch(() => ({}))) as {
      status?: string
      reply?: string
    }

    if (body.status === 'read' || body.status === 'closed') {
      await updateContactMessageStatus(id, body.status)
      return NextResponse.json({ ok: true })
    }

    const reply = String(body.reply ?? '').trim()
    if (!reply) {
      return NextResponse.json({ error: 'Réponse vide' }, { status: 400 })
    }

    const to = String(msg.email ?? '')
    const subject = `Re: ${String(msg.subject ?? 'Votre demande')}`
    const greeting = msg.name ? `Bonjour ${String(msg.name)},` : 'Bonjour,'
    const fullBody = `${greeting}\n\n${reply}\n\n— L'équipe Fleur d'AmOurs`
    const { html, text } = buildNotificationEmailHtml({
      title: subject,
      body: fullBody,
      actionUrl: '/contact',
      actionLabel: 'Formulaire de contact',
    })

    const sent = await sendTransactionalEmail({
      to,
      subject,
      html,
      text,
      userId: msg.user_id != null ? Number(msg.user_id) : null,
      skipPrefs: !msg.user_id,
      replyTo: process.env.SMTP_REPLY_TO?.trim() || undefined,
    })

    if (!sent.sent) {
      return NextResponse.json({ error: sent.error ?? 'Échec envoi e-mail' }, { status: 502 })
    }

    await updateContactMessageStatus(id, 'replied')

    if (msg.user_id) {
      void createNotification({
        type: 'contact_reply',
        title: 'Réponse à votre message',
        body: reply.slice(0, 500),
        action_url: '/contact',
        recipient_type: 'user',
        recipient_id: Number(msg.user_id),
        created_by: parseInt(userId, 10),
        source_type: 'contact',
        source_id: id,
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, sent: true })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: 500 })
  }
}
