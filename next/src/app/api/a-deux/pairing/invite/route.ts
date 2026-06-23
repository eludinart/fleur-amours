/**
 * POST /api/a-deux/pairing/invite — envoi e-mail d'invitation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { isSmtpConfigured } from '@/lib/email'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { invitePairingByEmail } from '@/lib/db-a-deux'
import { authMe } from '@/lib/db-auth'
import { absolutePublicAppUrl } from '@/lib/app-public-url'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    if (!isSmtpConfigured()) {
      return NextResponse.json(
        { detail: "Envoi d'e-mails non configuré sur le serveur (SMTP)." },
        { status: 503 }
      )
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const body = (await req.json().catch(() => ({}))) as {
      invite_token?: string
      partner_email?: string
      app_base_url?: string
    }
    const inviteToken = String(body.invite_token ?? '').trim()
    const partnerEmail = String(body.partner_email ?? '').trim()
    if (!inviteToken || !partnerEmail) {
      return NextResponse.json({ detail: 'Token et email requis' }, { status: 400 })
    }

    const me = await authMe(uid).catch(() => null)
    const inviterName = me?.name?.trim() || me?.email || undefined
    const invitePath = `/a-deux/invitation?token=${encodeURIComponent(inviteToken)}`
    const inviteUrl = body.app_base_url
      ? `${String(body.app_base_url).replace(/\/+$/, '')}${invitePath}`
      : absolutePublicAppUrl(invitePath, req)

    const result = await invitePairingByEmail({
      inviteToken,
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
