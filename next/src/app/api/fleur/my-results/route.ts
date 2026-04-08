/**
 * GET /api/fleur/my-results
 * Liste les explorations Fleur et DUO de l'utilisateur connecté depuis MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { getMyResults } from '@/lib/db-fleur'
import { listFleurBetaResults } from '@/lib/db-fleur-beta'
import { requireAuth } from '@/lib/api-auth'
import { cacheGet, cacheSet } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'

const TTL_MS = 45_000

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Backend non configuré (MARIADB_*)' },
        { status: 503 }
      )
    }

    const cacheKey = `fleur_my_results:${userId}`
    const cached = cacheGet<object>(cacheKey)
    if (cached) return NextResponse.json(cached)

    // getMyResults et listFleurBetaResults en parallèle
    const [data, betaRows] = await Promise.all([
      getMyResults(userId),
      listFleurBetaResults(parseInt(userId, 10)),
    ])
    const betaItems = betaRows.map((b) => ({
      type: 'fleur-beta' as const,
      id: b.id,
      created_at: b.created_at,
      token: `beta-${b.id}`,
      questionnaire_version: b.questionnaire_version,
      porte: b.porte,
    }))
    const items = [...data.items, ...betaItems].sort((a, b) => {
      const ta = new Date(String(a.created_at ?? 0)).getTime()
      const tb = new Date(String(b.created_at ?? 0)).getTime()
      return tb - ta
    })
    const result = { items }
    cacheSet(cacheKey, result, TTL_MS)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const status = e.status ?? 500
    return NextResponse.json(
      { error: e.message ?? 'Impossible de charger vos fleurs' },
      { status }
    )
  }
}
