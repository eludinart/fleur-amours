/**
 * GET /api/social/my_badges — badges de maturité communautaire de l'utilisateur.
 * Utilisé sur la Zen home (visibilité de la progression sociale hors Prairie).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { computeMaturityBadges, fetchMaturityStats } from '@/lib/community-maturity'
import { cacheGet, cacheSet } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'

const BADGES_TTL_MS = 120_000

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid || !isDbConfigured()) return NextResponse.json({ badges: [] })

    const cacheKey = `my_badges:${uid}`
    const cached = cacheGet<string[]>(cacheKey)
    if (cached !== undefined) return NextResponse.json({ badges: cached })

    const stats = await fetchMaturityStats(uid)
    const badges = computeMaturityBadges(stats)
    cacheSet(cacheKey, badges, BADGES_TTL_MS)
    return NextResponse.json({ badges })
  } catch {
    return NextResponse.json({ badges: [] })
  }
}
