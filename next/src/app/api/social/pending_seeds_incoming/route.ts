/**
 * GET /api/social/pending_seeds_incoming
 * Liste les graines (demandes) en attente reçues par l'utilisateur connecté.
 *
 * Query:
 * - intention_ids: CSV optionnel (ex: resonance,eclairage)
 * - limit: number optionnel
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { listPendingSeedsIncoming } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ items: [] }, { status: 401 })
    if (!isDbConfigured()) return NextResponse.json({ items: [] }, { status: 200 })

    const rawIds = String(req.nextUrl.searchParams.get('intention_ids') ?? '').trim()
    const intentionIds = rawIds ? rawIds.split(',').map((s) => s.trim()).filter(Boolean) : []
    const limit = parseInt(String(req.nextUrl.searchParams.get('limit') ?? '50'), 10)

    const items = await listPendingSeedsIncoming({
      userId: uid,
      intentionIds,
      limit: Number.isFinite(limit) ? limit : 50,
    })
    return NextResponse.json({ items })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, items: [] }, { status: e.status ?? 400 })
  }
}

