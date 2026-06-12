/**
 * POST /api/mycelium/invite-batch — invitations en masse pour l'organisation gérée.
 * Body : { emails: string[], teamId?: number, role?: 'member'|'manager'|'rh' }
 * Respecte la capacité de sièges (db-organisations.createBatchInvites).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { absolutePublicAppUrl } from '@/lib/app-public-url'
import { createBatchInvites, getManagedOrg, type OrgRole } from '@/lib/db-organisations'
import { sendInviteEmail } from '@/lib/email'
import { authMe } from '@/lib/db-auth'

export const dynamic = 'force-dynamic'

const VALID_ROLES: OrgRole[] = ['member', 'manager', 'rh']

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const managed = await getManagedOrg(parseInt(userId, 10))
    if (!managed) return NextResponse.json({ error: 'Aucune organisation gérée' }, { status: 403 })

    const body = (await req.json().catch(() => ({}))) as {
      emails?: string[] | string
      teamId?: number
      role?: string
    }
    const emails = Array.isArray(body.emails)
      ? body.emails
      : String(body.emails ?? '')
          .split(/[\s,;]+/)
          .filter(Boolean)
    if (!emails.length) return NextResponse.json({ error: 'Aucun email fourni' }, { status: 400 })

    let role = VALID_ROLES.includes(body.role as OrgRole) ? (body.role as OrgRole) : 'member'
    // Anti-élévation : seuls owner et manager peuvent inviter avec un rôle élevé ;
    // un RH ne peut inviter que des membres.
    if (role !== 'member' && managed.role !== 'owner' && managed.role !== 'manager') {
      role = 'member'
    }

    const { created, skipped } = await createBatchInvites({
      orgId: managed.org.id,
      emails,
      teamId: body.teamId ?? null,
      role,
    })

    const inviter = await authMe(parseInt(userId, 10)).catch(() => null)
    const inviterName = inviter?.name?.trim() || inviter?.email || 'Votre organisation'

    const invites = created.map((inv) => {
      const inviteLink = absolutePublicAppUrl(
        `/login?from=/mycelium/join&org_invite=${encodeURIComponent(inv.token)}`,
        req
      )
      void sendInviteEmail({
        to: inv.email,
        subject: `${inviterName} vous invite sur Mycélium`,
        intro: `${inviterName} vous invite à rejoindre l'espace Mycélium (${managed.org.name ?? 'organisation'}).`,
        inviteUrl: inviteLink,
        ctaLabel: 'Rejoindre Mycélium',
      }).catch(() => {})
      return {
        email: inv.email,
        role: inv.role,
        inviteLink,
      }
    })

    return NextResponse.json({ created: invites, createdCount: created.length, skipped }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
