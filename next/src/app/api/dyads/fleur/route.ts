/**
 * POST /api/dyads/fleur — (re)calcule et persiste la fleur de couple évolutive.
 *
 * La fleur de couple est la moyenne des lignes de base (ou pétales fournis) des
 * deux membres. Elle est persistée sur la dyade (pas recalculée à la volée).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getMyDyad, saveDyadFleur, userInDyad } from '@/lib/db-dyads'
import { resolveUserPetalsProfile } from '@/lib/resolve-user-petals'
import { PETAL_ORDER_IDS } from '@/lib/petal-theme'

export const dynamic = 'force-dynamic'

function normalize(input: unknown): Record<string, number> | null {
  if (!input || typeof input !== 'object') return null
  const src = input as Record<string, unknown>
  const out: Record<string, number> = {}
  let any = false
  for (const id of PETAL_ORDER_IDS) {
    const v = Number(src[id])
    if (Number.isFinite(v)) {
      out[id] = Math.min(1, Math.max(0, v))
      any = true
    } else {
      out[id] = 0
    }
  }
  return any ? out : null
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const dyad = await getMyDyad(uid)
    if (!dyad || dyad.status !== 'active' || dyad.userB == null || !userInDyad(dyad, uid)) {
      return NextResponse.json({ error: 'Aucune dyade active' }, { status: 404 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      petalsA?: Record<string, number>
      petalsB?: Record<string, number>
    }

    // Source : pétales fournis (Duo) sinon profil agrégé (ligne de base, Ma Fleur, diagnostic…).
    const [pA, pB] = await Promise.all([
      normalize(body.petalsA) ?? resolveUserPetalsProfile(dyad.userA),
      normalize(body.petalsB) ?? resolveUserPetalsProfile(dyad.userB),
    ])

    if (!pA || !pB) {
      return NextResponse.json(
        {
          error:
            'Profil fleur incomplet pour un des deux partenaires. Chacun peut enregistrer sa ligne de base (Éclosion → Ma ligne de base), faire une exploration Ma Fleur, ou compléter le diagnostic.',
          missingA: !pA,
          missingB: !pB,
        },
        { status: 422 }
      )
    }

    const fleur: Record<string, number> = {}
    for (const id of PETAL_ORDER_IDS) {
      fleur[id] = Math.round(((pA[id] + pB[id]) / 2) * 1000) / 1000
    }

    await saveDyadFleur(dyad.id, fleur)
    return NextResponse.json({ fleur, fleurUpdatedAt: new Date().toISOString() })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
