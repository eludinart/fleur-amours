import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  sendDreamscapeClosingEmail,
  type DreamscapeClosingSections,
} from '@/lib/email-dreamscape-closing'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!Number.isFinite(uid)) {
      return NextResponse.json({ error: 'Utilisateur invalide' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const sections = (body?.sections ?? {}) as DreamscapeClosingSections
    const petals =
      body?.petals && typeof body.petals === 'object' ? (body.petals as Record<string, number>) : {}
    const path = Array.isArray(body?.path) ? (body.path as string[]) : []
    const slots = Array.isArray(body?.slots) ? body.slots : []
    const snapshot = typeof body?.snapshot === 'string' ? body.snapshot : null
    const summary = typeof body?.summary === 'string' ? body.summary : null

    const hasContent =
      !!sections.intention_depart?.trim() ||
      !!sections.ce_qui_a_emerge?.trim() ||
      !!sections.trajectoire_cartes?.trim() ||
      (Array.isArray(sections.citations) && sections.citations.length > 0) ||
      (Array.isArray(sections.actions_a_oeuvrer) && sections.actions_a_oeuvrer.length > 0) ||
      !!summary?.trim() ||
      path.length > 0 ||
      !!snapshot

    if (!hasContent) {
      return NextResponse.json({ sent: false, error: 'Rien à envoyer' }, { status: 400 })
    }

    const result = await sendDreamscapeClosingEmail({
      userId: uid,
      sections: {
        intention_depart: sections.intention_depart ?? null,
        ce_qui_a_emerge: sections.ce_qui_a_emerge ?? (summary || null),
        trajectoire_cartes: sections.trajectoire_cartes ?? null,
        citations: Array.isArray(sections.citations) ? sections.citations : [],
        actions_a_oeuvrer: Array.isArray(sections.actions_a_oeuvrer)
          ? sections.actions_a_oeuvrer
          : [],
      },
      petals,
      path,
      slots,
      snapshot,
      summary,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { sent: false, error: e.message || 'Erreur' },
      { status: e.status || 500 }
    )
  }
}
