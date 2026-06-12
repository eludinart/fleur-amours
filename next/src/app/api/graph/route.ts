/**
 * GET /api/graph?min_shared=1
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { buildCardGraph } from '@/lib/graph-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const minShared = Math.max(1, parseInt(req.nextUrl.searchParams.get('min_shared') ?? '1', 10) || 1)
    const graph = await buildCardGraph(minShared)
    return NextResponse.json(graph)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
