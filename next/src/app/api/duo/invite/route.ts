/**
 * POST /api/duo/invite — envoie une invitation Duo par e-mail.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ApiError, requireAuth } from '@/lib/api-auth'
import { absolutePublicAppUrl } from '@/lib/app-public-url'
import { authMe } from '@/lib/db-auth'
import { inviteDuoPartner } from '@/lib/db-fleur'
import { isDbConfigured } from '@/lib/db'
import { isSmtpConfigured } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    if (!isSmtpConfigured()) {
      return NextResponse.json(
        { detail: 'Envoi d\'e-mails non configuré sur le serveur (SMTP).' },
        { status: 503 }
      )
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json().catch(() => ({}))) as {
      partner_email?: string
      token?: string
      app_base_url?: string
    }
    const partnerEmail = String(body.partner_email ?? '').trim()
    const token = String(body.token ?? '').trim()
    if (!partnerEmail || !token) {
      return NextResponse.json({ detail: 'Email et token requis' }, { status: 400 })
    }

    const me = await authMe(uid).catch(() => null)
    const inviterName = me?.name?.trim() || me?.email || undefined
    const invitePath = `/duo?token=${encodeURIComponent(token)}`
    const inviteUrl = body.app_base_url
      ? `${String(body.app_base_url).replace(/\/+$/, '')}${invitePath}`
      : absolutePublicAppUrl(invitePath, req)

    const result = await inviteDuoPartner({
      token,
      fromUserId: uid,
      partnerEmail,
      inviteUrl,
      inviterName,
    })

    if (!result.sent) {
      return NextResponse.json(
        { sent: false, detail: result.error ?? 'Échec envoi e-mail' },
        { status: 502 }
      )
    }
    return NextResponse.json({ sent: true })
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ detail: err.message }, { status: err.status })
    }
    const e = err as Error
    return NextResponse.json({ detail: e.message || 'Erreur' }, { status: 400 })
  }
}
