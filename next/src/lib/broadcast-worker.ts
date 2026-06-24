/**
 * Traitement des files d'envoi (e-mail SMTP / notifications in-app).
 */
import {
  claimQueuedDeliveries,
  finalizeBroadcastIfDone,
  getById,
  markDeliveryFailed,
  markDeliverySent,
  resolveInappForBroadcast,
  type BroadcastChannel,
  type BroadcastContent,
} from './db-broadcasts'
import { createNotification } from './db-notifications'
import { wrapBroadcastEmailHtml } from './email'
import { sendSmtpMail, isSmtpConfigured } from './smtp'
import { getUserLocalesBatch } from './user-locale'

type BroadcastChannels = BroadcastContent

export async function processBroadcastChannelBatch(params: {
  broadcastId: number
  channel: BroadcastChannel
  limit?: number
}): Promise<{ processed: number; errors: string[] }> {
  const broadcast = await getById(params.broadcastId)
  if (!broadcast) throw new Error('Diffusion introuvable')
  const channels = (broadcast.channels ?? {}) as BroadcastChannels
  const limit = Math.min(200, Math.max(1, params.limit ?? 50))
  const errors: string[] = []
  let processed = 0

  if (params.channel === 'email') {
    if (!channels.email?.subject) return { processed: 0, errors: [] }
    if (!isSmtpConfigured()) {
      throw new Error('SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM)')
    }
    const queued = await claimQueuedDeliveries({
      broadcastId: params.broadcastId,
      channel: 'email',
      limit,
    })
    const localeMap = await getUserLocalesBatch(queued.map((d) => d.user_id))
    for (const d of queued) {
      processed++
      try {
        const subject = String(channels.email.subject ?? '').trim()
        const rawHtml = channels.email.html ? String(channels.email.html) : undefined
        const locale = localeMap.get(d.user_id) ?? 'fr'
        const wrapped = rawHtml
          ? wrapBroadcastEmailHtml({
              locale,
              preheader: channels.email.preheader,
              title: subject,
              bodyHtml: rawHtml,
            })
          : null
        const html = wrapped?.html
        const text = wrapped?.text ?? (channels.email.text ? String(channels.email.text) : undefined)
        const { messageId } = await sendSmtpMail({
          to: d.user_email,
          subject,
          html,
          text,
          from:
            channels.email.from_email && channels.email.from_name
              ? `${channels.email.from_name} <${channels.email.from_email}>`
              : undefined,
          replyTo: channels.email.reply_to ? String(channels.email.reply_to) : undefined,
          headers: { 'X-Fleur-Broadcast-Id': String(params.broadcastId) },
        })
        await markDeliverySent({ deliveryId: d.id, providerMessageId: messageId })
      } catch (err: unknown) {
        const msg = (err as Error)?.message ?? 'Erreur SMTP'
        errors.push(msg)
        await markDeliveryFailed({ deliveryId: d.id, error: msg })
      }
    }
  }

  if (params.channel === 'inapp') {
    const inapp = resolveInappForBroadcast(params.broadcastId, channels)
    if (!inapp?.title) return { processed: 0, errors: [] }
    const queued = await claimQueuedDeliveries({
      broadcastId: params.broadcastId,
      channel: 'inapp',
      limit,
    })
    for (const d of queued) {
      processed++
      try {
        const title = String(inapp.title ?? '').trim()
        const bodyText = inapp.body != null ? String(inapp.body) : null
        const actionUrl = inapp.action_url != null ? String(inapp.action_url) : null
        await createNotification({
          type: inapp.type ?? 'email_campaign',
          title,
          body: bodyText,
          action_url: actionUrl,
          action_label: inapp.action_label ?? 'Voir le message',
          recipient_type: 'user',
          recipient_id: d.user_id,
          priority: inapp.priority ?? 'normal',
          expires_at: inapp.expires_at ?? null,
          source_type: 'broadcast',
          source_id: params.broadcastId,
          skip_email: !!channels.email?.subject,
        })
        try {
          const { sendFcmPush } = await import('./fcm')
          await sendFcmPush(
            d.user_id,
            d.user_email || null,
            title,
            String(bodyText ?? '').trim() || title,
            actionUrl
          )
        } catch {
          /* push optionnel */
        }
        await markDeliverySent({ deliveryId: d.id, providerMessageId: null })
      } catch (err: unknown) {
        const msg = (err as Error)?.message ?? 'Erreur in-app'
        errors.push(msg)
        await markDeliveryFailed({ deliveryId: d.id, error: msg })
      }
    }
  }

  await finalizeBroadcastIfDone(params.broadcastId)
  return { processed, errors }
}

/** Traite toutes les livraisons en attente (e-mail puis in-app). */
export async function processBroadcastUntilDone(params: {
  broadcastId: number
  batchSize?: number
  maxRounds?: number
}): Promise<{ processed: number; errors: string[]; status: string }> {
  const batchSize = Math.min(200, Math.max(1, params.batchSize ?? 80))
  const maxRounds = Math.min(500, Math.max(1, params.maxRounds ?? 200))
  let totalProcessed = 0
  const allErrors: string[] = []

  for (let round = 0; round < maxRounds; round++) {
    const emailBatch = await processBroadcastChannelBatch({
      broadcastId: params.broadcastId,
      channel: 'email',
      limit: batchSize,
    })
    const inappBatch = await processBroadcastChannelBatch({
      broadcastId: params.broadcastId,
      channel: 'inapp',
      limit: batchSize,
    })
    totalProcessed += emailBatch.processed + inappBatch.processed
    allErrors.push(...emailBatch.errors, ...inappBatch.errors)
    if (emailBatch.processed === 0 && inappBatch.processed === 0) break
  }

  const broadcast = await getById(params.broadcastId)
  return {
    processed: totalProcessed,
    errors: allErrors.slice(0, 20),
    status: String(broadcast?.status ?? 'unknown'),
  }
}
