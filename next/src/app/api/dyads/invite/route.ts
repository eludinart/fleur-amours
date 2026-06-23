/**
 * POST /api/dyads/invite — crée une invitation de couple (token).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { createDyadInvite } from '@/lib/db-dyads'
import { authMe } from '@/lib/db-auth'
import { createNotification } from '@/lib/db-notifications'
import { absolutePublicAppUrl } from '@/lib/app-public-url'
import { sendDuoInviteEmail } from '@/lib/email'
import { resolveUserPetalsProfile } from '@/lib/resolve-user-petals'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as { email?: string; label?: string }
    const email = String(body.email ?? '').trim()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email valide requis' }, { status: 400 })
    }
    const uid = parseInt(userId, 10)
    const { dyad, token } = await createDyadInvite({
      fromUserId: uid,
      inviteeEmail: email,
      label: body.label ?? null,
    })
    const invitePath = `/couple?token=${encodeURIComponent(token)}`
    const inviteUrl = absolutePublicAppUrl(invitePath, req)

    const inviter = await authMe(uid).catch(() => null)
    const inviterName = inviter?.name?.trim() || inviter?.email || 'Quelqu’un'
    const inviterDisplay =
      (inviter?.pseudo && String(inviter.pseudo).trim()) || inviterName
    const petals = (await resolveUserPetalsProfile(uid, inviter?.email ?? null)) ?? {}
    void createNotification({
      type: 'dyad_invite',
      title: 'Invitation au Jardin du duo',
      body: `${inviterName} vous invite à rejoindre un jardin duo.`,
      action_url: invitePath,
      action_label: 'Accepter',
      recipient_type: 'user',
      recipient_email: email,
      created_by: uid,
      source_type: 'dyad',
      source_id: dyad.id,
    }).catch(() => {})

    void sendDuoInviteEmail({
      to: email,
      inviterName,
      inviterDisplayName: inviterDisplay,
      inviteUrl,
      scores: petals,
      kind: 'couple_garden',
      ctaLabel: 'Rejoindre le Jardin du duo',
    }).catch(() => {})

    return NextResponse.json({ dyad, token, inviteUrl }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 400 })
  }
}
