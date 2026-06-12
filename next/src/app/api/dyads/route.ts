/**
 * GET /api/dyads — dyade courante de l'utilisateur (avec fil, rituels, fleur).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { authMe } from '@/lib/db-auth'
import { absolutePublicAppUrl } from '@/lib/app-public-url'
import {
  getDyadMemberProfiles,
  getIncomingDyadInvite,
  getMyDyad,
  listDyadEvents,
  listRituals,
} from '@/lib/db-dyads'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) return NextResponse.json({ dyad: null })
    const uid = parseInt(userId, 10)
    const user = await authMe(uid).catch(() => null)
    const dyad = await getMyDyad(uid)
    if (!dyad) {
      const incoming = user?.email
        ? await getIncomingDyadInvite(uid, user.email)
        : null
      const incomingInvite = incoming
        ? {
            ...incoming,
            inviteUrl: absolutePublicAppUrl(
              `/couple?token=${encodeURIComponent(incoming.token)}`,
              req
            ),
          }
        : null
      return NextResponse.json({ dyad: null, incomingInvite })
    }
    const [events, rituals] = await Promise.all([
      dyad.status === 'active' ? listDyadEvents(dyad.id) : Promise.resolve([]),
      dyad.status === 'active' ? listRituals(dyad.id) : Promise.resolve([]),
    ])
    const role = dyad.userA === uid ? 'a' : 'b'
    const inviteUrl =
      dyad.status === 'pending' && role === 'a' && dyad.inviteToken
        ? absolutePublicAppUrl(`/couple?token=${encodeURIComponent(dyad.inviteToken)}`, req)
        : null
    const members =
      dyad.status === 'active' && dyad.userB != null
        ? await getDyadMemberProfiles(dyad.userA, dyad.userB)
        : null
    return NextResponse.json({ dyad, events, rituals, role, inviteUrl, members })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, dyad: null }, { status: e.status || 401 })
  }
}
