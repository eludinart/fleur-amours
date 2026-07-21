/**
 * Envoi unifié d'une relance d'engagement (notification + e-mail personnalisés).
 */
import { createNotification } from './db-notifications'
import { dispatchNotificationEmails, isUserInQuietHours } from './email'
import { canSendEngagementRemindToEmail, isEngagementRemindAllowlistActive } from './notification-outbound'
import { filterOutDemoUserIds } from './demo-accounts-filter'
import type { EngagementCampaignId } from './engagement-templates'
import {
  buildEngagementTemplate,
  engagementExpiresAt,
  type EngagementTemplateVars,
} from './engagement-templates'
import type { EngagementPersonalization } from './engagement-context'

export type SendEngagementInput = {
  userId: number
  email: string | null
  campaignId: EngagementCampaignId
  vars?: EngagementTemplateVars
  personalization: EngagementPersonalization
  source_id?: number | null
  skipDevGuard?: boolean
}

export async function sendEngagementNotification(
  input: SendEngagementInput
): Promise<{ sent: boolean; notification_id?: number }> {
  const vars: EngagementTemplateVars = {
    ...(input.vars ?? {}),
    personalization: input.personalization,
    ...(input.campaignId === 'plan14j' && input.source_id
      ? { sessionId: input.source_id }
      : {}),
  }
  const template = buildEngagementTemplate(
    input.campaignId,
    input.personalization.locale,
    vars
  )

  const email = String(input.email ?? '').trim()
  const realIds = await filterOutDemoUserIds([input.userId])
  const allowlisted =
    isEngagementRemindAllowlistActive() && canSendEngagementRemindToEmail(email, { skipDevGuard: true })
  if (
    !email ||
    realIds.length === 0 ||
    !canSendEngagementRemindToEmail(email, { skipDevGuard: input.skipDevGuard })
  ) {
    return { sent: false }
  }

  const skipGuard = input.skipDevGuard || allowlisted

  const result = await createNotification({
    type: template.type,
    title: template.title,
    body: template.body,
    action_url: template.action_url,
    action_label: template.action_label,
    recipient_type: 'user',
    recipient_id: input.userId,
    priority: template.priority,
    source_type: `engagement_${input.campaignId}`,
    source_id: input.source_id ?? null,
    expires_at: engagementExpiresAt(),
    skip_email: true,
    skip_dev_guard: skipGuard,
  })

  if (result.deliveries === 0) {
    return { sent: false, notification_id: result.notification_id }
  }

  // Push FCM (web/PWA + Android) — silencieux pendant les heures calmes de l'utilisateur.
  try {
    if (!(await isUserInQuietHours(input.userId))) {
      const { sendFcmPush } = await import('./fcm')
      await sendFcmPush(input.userId, email, template.title, template.body, template.action_url)
    }
  } catch {
    /* push optionnel : ne bloque jamais la relance */
  }

  await dispatchNotificationEmails({
    notificationId: result.notification_id,
    type: template.type,
    title: template.emailSubject,
    body: template.body,
    actionUrl: template.action_url,
    actionLabel: template.action_label,
    locale: template.locale,
    highlight: template.emailHighlight,
    personalization: input.personalization,
    recipients: [{ user_id: input.userId, email }],
    skipDevGuard: skipGuard,
    campaignId: input.campaignId,
  })

  return { sent: result.deliveries > 0, notification_id: result.notification_id }
}
