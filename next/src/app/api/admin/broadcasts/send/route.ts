/**
 * POST /api/admin/broadcasts/send — enqueue puis envoi complet en un appel.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { enqueueDeliveries } from '@/lib/db-broadcasts'
import { processBroadcastUntilDone } from '@/lib/broadcast-worker'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as { id?: number; batchSize?: number }
    const id = Number(body.id ?? 0)
    if (!id) throw new Error('id requis')

    const { queued } = await enqueueDeliveries({ broadcastId: id })
    const result = await processBroadcastUntilDone({
      broadcastId: id,
      batchSize: body.batchSize ?? 80,
    })

    return NextResponse.json({
      ok: true,
      queued,
      processed: result.processed,
      status: result.status,
      errors: result.errors,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
