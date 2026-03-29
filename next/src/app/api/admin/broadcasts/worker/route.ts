import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { claimQueuedDeliveries, finalizeBroadcastIfDone, markDeliveryFailed, markDeliverySent, getById } from '@/lib/db-broadcasts'
import { createNotification } from '@/lib/db-notifications'
import { sendSmtpMail } from '@/lib/smtp'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as { id?: number; limit?: number }
    const id = Number(body.id ?? 0)
    if (!id) throw new Error('id requis')
    const limit = Math.min(200, Math.max(1, Number(body.limit ?? 50)))
    const broadcast = await getById(id)
    if (!broadcast) throw new Error('Diffusion introuvable')
    const channels = (broadcast.channels ?? {}) as any

    let processed = 0

    // Email batch
    if (channels?.email?.subject) {
      const queued = await claimQueuedDeliveries({ broadcastId: id, channel: 'email', limit })
      for (const d of queued) {
        processed++
        try {
          const subject = String(channels.email.subject ?? '').trim()
          const html = channels.email.html ? String(channels.email.html) : undefined
          const text = channels.email.text ? String(channels.email.text) : undefined
          const to = d.user_email
          const { messageId } = await sendSmtpMail({
            to,
            subject,
            html,
            text,
            from: channels.email.from_email && channels.email.from_name
              ? `${channels.email.from_name} <${channels.email.from_email}>`
              : undefined,
            replyTo: channels.email.reply_to ? String(channels.email.reply_to) : undefined,
            headers: {
              'X-Fleur-Broadcast-Id': String(id),
            },
          })
          await markDeliverySent({ deliveryId: d.id, providerMessageId: messageId })
        } catch (err: unknown) {
          await markDeliveryFailed({ deliveryId: d.id, error: (err as Error)?.message ?? 'Erreur SMTP' })
        }
      }
    }

    // In-app batch: on crée une notification par destinataire (V1) via createNotification(user)
    if (channels?.inapp?.title) {
      const queued = await claimQueuedDeliveries({ broadcastId: id, channel: 'inapp', limit })
      for (const d of queued) {
        processed++
        try {
          const title = String(channels.inapp.title ?? '').trim()
          const bodyText = channels.inapp.body != null ? String(channels.inapp.body) : null
          const actionUrl = channels.inapp.action_url != null ? String(channels.inapp.action_url) : null
          const actionLabel = channels.inapp.action_label != null ? String(channels.inapp.action_label) : null
          const priority = channels.inapp.priority ?? 'normal'
          await createNotification({
            type: channels.inapp.type ?? 'admin_announcement',
            title,
            body: bodyText,
            action_url: actionUrl,
            action_label: actionLabel,
            recipient_type: 'user',
            recipient_id: d.user_id,
            priority,
            expires_at: channels.inapp.expires_at ?? null,
            source_type: 'broadcast',
            source_id: id,
          })
          await markDeliverySent({ deliveryId: d.id, providerMessageId: null })
        } catch (err: unknown) {
          await markDeliveryFailed({ deliveryId: d.id, error: (err as Error)?.message ?? 'Erreur in-app' })
        }
      }
    }

    await finalizeBroadcastIfDone(id)
    return NextResponse.json({ ok: true, processed })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

