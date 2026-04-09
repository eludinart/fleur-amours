/**
 * POST /api/ai/flower-state-haiku — mini-haïku pour l’état affiché (vue zen).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { generateFlowerStateHaiku } from '@/lib/flower-state-haiku'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const body = (await req.json().catch(() => ({}))) as {
      mode?: string
      petals?: Record<string, number>
      locale?: string
      cacheKey?: string
      snapshotMeta?: { dateIso?: string; type?: string; label?: string }
    }

    const mode = body.mode === 'snapshot' ? 'snapshot' : 'blend'
    const petals = body.petals && typeof body.petals === 'object' ? body.petals : {}
    const locale = String(body.locale ?? req.headers.get('x-locale') ?? 'fr')
      .toLowerCase()
      .split('-')[0]
    const cacheKey = String(body.cacheKey ?? (mode === 'blend' ? 'blend' : 'snap')).slice(0, 120)

    const haiku = await generateFlowerStateHaiku({
      mode,
      petals,
      locale,
      cacheKey,
      snapshotMeta:
        mode === 'snapshot' && body.snapshotMeta && typeof body.snapshotMeta === 'object'
          ? {
              dateIso: body.snapshotMeta.dateIso,
              type: body.snapshotMeta.type,
              label: body.snapshotMeta.label?.slice(0, 800),
            }
          : undefined,
    })

    if (!haiku) {
      return NextResponse.json({ haiku: '', ok: false })
    }
    return NextResponse.json({ haiku, ok: true, cacheKey })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ haiku: '', ok: false, error: e.message }, { status: e.status || 401 })
  }
}
