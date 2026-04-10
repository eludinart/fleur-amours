/**
 * GET /api/tarot_readings/[id]/public
 * Lecture publique d'un tirage (pour page partagée et OG image).
 * Retourne le tirage sans données personnelles (pas d'email).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getById } from '@/lib/db-tarot'
import { parseShareFlowerFromPayload } from '@/share-engine/petals'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
  }
  try {
    const reading = await getById(Number(id))
    if (!reading) {
      return NextResponse.json({ error: 'Tirage introuvable' }, { status: 404 })
    }
    const r = reading as Record<string, unknown>
    const type = r.type === 'four' ? 'four' : 'simple'
    const created = r.createdAt ?? r.created_at
    const shareFlower = parseShareFlowerFromPayload(r.shareFlower)
    // Partage public : carte(s) + sens générique uniquement — pas d’intention, réflexion ni interprétation IA (contexte perso).
    if (type === 'four') {
      const cards = Array.isArray(r.cards) ? r.cards : []
      return NextResponse.json(
        {
          id: r.id,
          type: 'four',
          createdAt: created,
          created_at: created,
          cards,
          synthesis: r.synthesis ?? null,
          ...(shareFlower ? { shareFlower } : {}),
        },
        {
          headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
        }
      )
    }
    const card = (r.card as Record<string, unknown> | undefined) || {}
    return NextResponse.json(
      {
        id: r.id,
        type: 'simple',
        createdAt: created,
        created_at: created,
        card: {
          name: card.name,
          img: card.img,
          desc: card.desc,
          synth: card.synth,
        },
        ...(shareFlower ? { shareFlower } : {}),
      },
      {
        headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Tirage introuvable' }, { status: 404 })
  }
}
