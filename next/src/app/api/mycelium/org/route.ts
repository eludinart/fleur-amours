/**
 * GET  /api/mycelium/org — organisation gérée par l'utilisateur (manager/RH/owner)
 *                          avec équipes, sièges, nombre de membres, invitations.
 * POST /api/mycelium/org — crée une organisation (l'utilisateur en devient owner).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireManagerOrRh } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  countMembers,
  createOrganisation,
  getManagedOrg,
  getSeats,
  listInvites,
  listTeams,
} from '@/lib/db-organisations'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) return NextResponse.json({ org: null })
    const managed = await getManagedOrg(parseInt(userId, 10))
    if (!managed) return NextResponse.json({ org: null })
    const [teams, members, seats, invites] = await Promise.all([
      listTeams(managed.org.id),
      countMembers(managed.org.id),
      getSeats(managed.org.id),
      listInvites(managed.org.id, 'pending'),
    ])
    return NextResponse.json({ org: managed.org, role: managed.role, teams, members, seats: seats.seats, invites })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, org: null }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Créer une organisation exige le rôle global manager, rh ou admin.
    const { userId } = await requireManagerOrRh(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as { name?: string }
    const name = String(body.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

    const existing = await getManagedOrg(parseInt(userId, 10))
    if (existing) return NextResponse.json({ error: 'Vous gérez déjà une organisation', org: existing.org }, { status: 409 })

    const org = await createOrganisation(parseInt(userId, 10), name)
    return NextResponse.json({ org }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
