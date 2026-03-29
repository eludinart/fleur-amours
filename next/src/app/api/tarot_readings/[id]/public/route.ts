/**
 * GET /api/tarot_readings/[id]/public
 * Lecture publique d'un tirage (pour page partagée et OG image).
 * Retourne le tirage sans données personnelles (pas d'email).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getById } from '@/lib/db-tarot'

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
    // Strip private fields
    const { email: _e, user_id: _u, ...publicReading } = reading as Record<string, unknown>
    return NextResponse.json(publicReading, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    })
  } catch {
    return NextResponse.json({ error: 'Tirage introuvable' }, { status: 404 })
  }
}
