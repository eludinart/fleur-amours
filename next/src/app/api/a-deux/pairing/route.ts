/**
 * POST /api/a-deux/pairing — crée une invitation à partir d'un profil ancre.
 * Si invited_email est fourni et SMTP configuré, envoie l'e-mail automatiquement.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { createPairing, invitePairingByEmail } from '@/lib/db-a-deux'
import { authMe } from '@/lib/db-auth'
import { isSmtpConfigured } from '@/lib/smtp'
import { absolutePublicAppUrl } from '@/lib/app-public-url'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as {
      anchor_id?: number
      invited_email?: string
      app_base_url?: string
    }
    const anchorId = Number(body.anchor_id ?? 0)
    if (!anchorId) {
      return NextResponse.json({ error: 'anchor_id requis' }, { status: 400 })
    }
    const invitedEmail = String(body.invited_email ?? '').trim()
    const data = await createPairing({
      anchorId,
      userId: uid,
      invitedEmail: invitedEmail || undefined,
    })

    let emailSent = false
    let emailError: string | undefined
    if (invitedEmail && isSmtpConfigured()) {
      const me = await authMe(uid).catch(() => null)
      const inviterName = me?.name?.trim() || me?.email || undefined
      const invitePath = `/a-deux/invitation?token=${encodeURIComponent(data.invite_token)}`
      const inviteUrl = body.app_base_url
        ? `${String(body.app_base_url).replace(/\/+$/, '')}${invitePath}`
        : absolutePublicAppUrl(invitePath, req)
      const result = await invitePairingByEmail({
        inviteToken: data.invite_token,
        fromUserId: uid,
        partnerEmail: invitedEmail,
        inviteUrl,
        inviterName,
      })
      emailSent = result.sent
      emailError = result.error
    }

    return NextResponse.json(
      { ...data, email_sent: emailSent, email_error: emailError ?? null },
      { status: 201 }
    )
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: 400 })
  }
}
