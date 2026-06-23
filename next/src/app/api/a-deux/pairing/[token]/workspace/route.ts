/**
 * GET/POST /api/a-deux/pairing/[token]/workspace — espace duo lié à un pairing (multi-partenaires).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { ensureDyadForPairing } from '@/lib/db-a-deux'
import {
  addDyadEvent,
  completeRitual,
  createRitual,
  getDyadById,
  getDyadIfMember,
  getDyadMemberProfiles,
  listDyadEvents,
  listRituals,
  saveDyadFleur,
  userInDyad,
} from '@/lib/db-dyads'
import { PETAL_ORDER_IDS } from '@/lib/petal-theme'
import { resolveUserPetalsProfile } from '@/lib/resolve-user-petals'

export const dynamic = 'force-dynamic'

type RouteCtx = { params: Promise<{ token: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { token } = await ctx.params
    if (!isDbConfigured()) {
      return NextResponse.json({ dyad: null, events: [], rituals: [] })
    }

    const dyadId = await ensureDyadForPairing(token, uid)
    if (!dyadId) {
      return NextResponse.json({ error: 'Duo introuvable' }, { status: 404 })
    }

    const dyad = await getDyadIfMember(dyadId, uid)
    if (!dyad || dyad.status !== 'active' || dyad.userB == null) {
      return NextResponse.json({ error: 'Espace duo indisponible' }, { status: 404 })
    }

    const [events, rituals, members] = await Promise.all([
      listDyadEvents(dyad.id, 80),
      listRituals(dyad.id),
      getDyadMemberProfiles(dyad.userA, dyad.userB),
    ])

    return NextResponse.json({
      dyad: {
        id: dyad.id,
        fleur: dyad.fleur,
        fleurUpdatedAt: dyad.fleurUpdatedAt,
      },
      events,
      rituals,
      members,
      role: dyad.userA === uid ? 'a' : 'b',
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    const { token } = await ctx.params
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const dyadId = await ensureDyadForPairing(token, uid)
    if (!dyadId) {
      return NextResponse.json({ error: 'Duo introuvable' }, { status: 404 })
    }

    const dyad = await getDyadIfMember(dyadId, uid)
    if (!dyad || dyad.status !== 'active' || !userInDyad(dyad, uid)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: string
      content?: string
      title?: string
      ritualId?: number
    }
    const action = String(body.action ?? 'message')

    if (action === 'message') {
      const content = String(body.content ?? '').trim()
      if (!content) return NextResponse.json({ error: 'Message vide' }, { status: 400 })
      const { id } = await addDyadEvent({ dyadId: dyad.id, authorId: uid, type: 'message', content })
      return NextResponse.json({ id, saved: true })
    }

    if (action === 'ritual') {
      const title = String(body.title ?? '').trim()
      if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
      const { id } = await createRitual({ dyadId: dyad.id, title })
      return NextResponse.json({ id, created: true })
    }

    if (action === 'completeRitual') {
      const ritualId = Number(body.ritualId)
      if (!Number.isFinite(ritualId)) return NextResponse.json({ error: 'Rituel invalide' }, { status: 400 })
      await completeRitual(ritualId, dyad.id)
      return NextResponse.json({ completed: true })
    }

    if (action === 'computeFleur') {
      const members = await getDyadMemberProfiles(dyad.userA, dyad.userB!)
      const pA = members.memberA.petals ?? (await resolveUserPetalsProfile(dyad.userA))
      const pB = members.memberB?.petals ?? (await resolveUserPetalsProfile(dyad.userB!))
      if (!pA || !pB) {
        return NextResponse.json({ error: 'Profil fleur incomplet' }, { status: 422 })
      }
      const fleur: Record<string, number> = {}
      for (const id of PETAL_ORDER_IDS) {
        fleur[id] = Math.round(((Number(pA[id] ?? 0) + Number(pB[id] ?? 0)) / 2) * 1000) / 1000
      }
      await saveDyadFleur(dyad.id, fleur)
      const updated = await getDyadById(dyad.id)
      return NextResponse.json({
        fleur: updated?.fleur ?? fleur,
        fleurUpdatedAt: updated?.fleurUpdatedAt ?? null,
      })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 400 })
  }
}
