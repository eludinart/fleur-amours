/**
 * POST /api/simulate
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { simulateGraphDiffusion } from '@/lib/graph-engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const body = (await req.json().catch(() => ({}))) as {
      seeds?: string[]
      steps?: number
      decay?: number
    }
    const seeds = Array.isArray(body.seeds) ? body.seeds.map(String) : []
    const result = await simulateGraphDiffusion({
      seeds,
      steps: body.steps,
      decay: body.decay,
    })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
