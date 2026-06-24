/**
 * POST /api/notifications/admin-test
 * Envoi d'une notification et/ou e-mail de test à un administrateur choisi.
 */
import { NextRequest, NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { getPool, isDbConfigured, table } from '@/lib/db'
import { createNotification } from '@/lib/db-notifications'
import { dispatchNotificationEmails } from '@/lib/email'
import { getUserLocale } from '@/lib/user-locale'
import {
  buildEngagementEmailPreview,
  PLAN14J_PREVIEW_VARS,
  PREVIEW_PERSONALIZATIONS,
  type EngagementCampaignId,
} from '@/lib/engagement-templates'
import { loadEngagementPersonalization } from '@/lib/engagement-context'
import { sendEngagementNotification } from '@/lib/send-engagement-notification'
import { isNotificationOutboundRestricted } from '@/lib/notification-outbound'

export const dynamic = 'force-dynamic'

const CAMPAIGNS: EngagementCampaignId[] = [
  'plan14j',
  'checkin',
  'tirage',
  'fleur',
  'session',
  'dreamscape',
]

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      admin_user_id?: number
      campaign?: string
      send_notification?: boolean
      send_email?: boolean
      use_real_profile?: boolean
    }

    const adminUserId = Number(body.admin_user_id)
    if (!adminUserId) {
      return NextResponse.json({ error: 'admin_user_id requis' }, { status: 400 })
    }

    const pool = getPool()
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.ID as id, u.user_email as email, COALESCE(ar.app_role, '') as app_role
       FROM ${table('users')} u
       LEFT JOIN ${table('fleur_app_roles')} ar ON ar.user_id = u.ID
       WHERE u.ID = ? LIMIT 1`,
      [adminUserId]
    )
    const admin = rows[0]
    if (!admin) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    if (String(admin.app_role) !== 'admin') {
      return NextResponse.json({ error: 'Cible réservée aux administrateurs' }, { status: 400 })
    }

    const email = String(admin.email ?? '').trim()
    if (!email) return NextResponse.json({ error: 'E-mail admin manquant' }, { status: 400 })

    const campaign = (CAMPAIGNS as string[]).includes(String(body.campaign ?? ''))
      ? (body.campaign as EngagementCampaignId)
      : 'plan14j'

    const sendNotification = body.send_notification !== false
    const sendEmail = body.send_email !== false
    const locale = await getUserLocale(adminUserId)

    const personalization = body.use_real_profile
      ? await loadEngagementPersonalization(adminUserId, email)
      : PREVIEW_PERSONALIZATIONS[locale] ?? PREVIEW_PERSONALIZATIONS.fr

    const vars =
      campaign === 'plan14j'
        ? { ...PLAN14J_PREVIEW_VARS, personalization }
        : { personalization }

    if (sendNotification && sendEmail) {
      const result = await sendEngagementNotification({
        userId: adminUserId,
        email,
        campaignId: campaign,
        vars,
        personalization,
        skipDevGuard: true,
      })
      return NextResponse.json({
        ok: true,
        notification: result.sent,
        email: result.sent,
        campaign,
        locale: personalization.locale,
        devRestricted: isNotificationOutboundRestricted(),
      })
    }

    const preview = buildEngagementEmailPreview(campaign, personalization.locale, vars)
    let notificationId: number | undefined

    if (sendNotification) {
      const created = await createNotification({
        type: preview.template.type,
        title: preview.template.title,
        body: preview.template.body,
        action_url: preview.template.action_url,
        action_label: preview.template.action_label,
        recipient_type: 'user',
        recipient_id: adminUserId,
        priority: preview.template.priority,
        source_type: 'admin_test',
        skip_email: true,
        skip_dev_guard: true,
      })
      notificationId = created.notification_id
    }

    if (sendEmail) {
      await dispatchNotificationEmails({
        notificationId,
        type: preview.template.type,
        title: preview.subject,
        body: preview.template.body,
        actionUrl: preview.template.action_url,
        actionLabel: preview.template.action_label,
        locale: preview.template.locale,
        highlight: preview.template.emailHighlight,
        recipients: [{ user_id: adminUserId, email }],
        skipDevGuard: true,
      })
    }

    return NextResponse.json({
      ok: true,
      notification: sendNotification,
      email: sendEmail,
      campaign,
      locale: preview.template.locale,
      notification_id: notificationId,
      devRestricted: isNotificationOutboundRestricted(),
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const status = err instanceof ApiError ? err.status : e.status || 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
