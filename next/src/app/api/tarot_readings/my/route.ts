/**
 * GET /api/tarot_readings/my
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { my } from '@/lib/db-tarot'
import { isDbConfigured } from '@/lib/db'
import { cacheGet, cacheSet } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'

const TTL_MS = 45_000

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ items: [] })
    }

    const cacheKey = `tarot_my:${userId}`
    const cached = cacheGet<object>(cacheKey)
    if (cached) return NextResponse.json(cached)

    // Pas d’authMe ici : requireAuth a déjà validé le JWT ; my() filtre par user_id uniquement.
    const data = await my(userId)
    cacheSet(cacheKey, data, TTL_MS)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, items: [] }, { status: e.status || 401 })
  }
}
