/**
 * POST /api/mycelium/invite-batch — invitations en masse pour l'organisation gérée.
 * Body : { emails: string[], teamId?: number, role?: 'member'|'manager'|'rh' }
 * Respecte la capacité de sièges (db-organisations.createBatchInvites).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireMyceliumRh } from '@/lib/mycelium-auth'
import { isDbConfigured } from '@/lib/db'
import { absolutePublicAppUrl } from '@/lib/app-public-url'
import { createBatchInvites, getManagedOrg, type OrgRole } from '@/lib/db-organisations'
import { sendInviteEmail } from '@/lib/email'
import { authMe } from '@/lib/db-auth'
import { tServer } from '@/lib/i18n-server'
import { getUserLocale } from '@/lib/user-locale'

export const dynamic = 'force-dynamic'

const VALID_ROLES: OrgRole[] = ['member', 'manager', 'rh']

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireMyceliumRh(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    if (!ctx.org) {
      return NextResponse.json({ error: 'Créez d\'abord une organisation' }, { status: 403 })
    }
    const managed = { org: ctx.org, role: ctx.role! }

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
    if (role !== 'member' && managed.role !== 'owner' && managed.role !== 'manager') {
      role = 'member'
    }

    const { created, skipped } = await createBatchInvites({
      orgId: managed.org.id,
      emails,
      teamId: body.teamId ?? null,
      role,
    })

    const inviter = await authMe(ctx.uid).catch(() => null)
    const inviterName = inviter?.name?.trim() || inviter?.email || tServer('fr', 'email.mycelium.orgFallback')
    const locale = await getUserLocale(ctx.uid)
    const orgName = managed.org.name?.trim() || tServer(locale, 'email.mycelium.orgFallback')

    const invites = created.map((inv) => {
      const inviteLink = absolutePublicAppUrl(
        `/login?from=/mycelium/join&org_invite=${encodeURIComponent(inv.token)}`,
        req
      )
      const subject = tServer(locale, 'email.mycelium.inviteSubject', { inviter: inviterName })
      const intro = tServer(locale, 'email.mycelium.inviteIntro', { inviter: inviterName, org: orgName })
      void sendInviteEmail({
        to: inv.email,
        subject,
        intro,
        inviteUrl: inviteLink,
        ctaLabel: tServer(locale, 'email.mycelium.inviteCta'),
        locale,
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
