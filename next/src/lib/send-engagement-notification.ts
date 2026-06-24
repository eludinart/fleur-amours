/**
 * Envoi unifié d'une relance d'engagement (notification + e-mail personnalisés).
 */
import { createNotification } from './db-notifications'
import { dispatchNotificationEmails } from './email'
import { canSendEngagementRemindToEmail } from './notification-outbound'
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
  if (!email || !canSendEngagementRemindToEmail(email, { skipDevGuard: input.skipDevGuard })) {
    return { sent: false }
  }

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
    skip_dev_guard: input.skipDevGuard,
  })

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
    skipDevGuard: input.skipDevGuard,
    campaignId: input.campaignId,
  })

  return { sent: true, notification_id: result.notification_id }
}
