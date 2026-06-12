import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { processBroadcastChannelBatch } from '@/lib/broadcast-worker'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as { id?: number; limit?: number }
    const id = Number(body.id ?? 0)
    if (!id) throw new Error('id requis')
    const limit = Math.min(200, Math.max(1, Number(body.limit ?? 50)))

    const emailRes = await processBroadcastChannelBatch({ broadcastId: id, channel: 'email', limit })
    const inappRes = await processBroadcastChannelBatch({ broadcastId: id, channel: 'inapp', limit })
    const processed = emailRes.processed + inappRes.processed

    return NextResponse.json({
      ok: true,
      processed,
      errors: [...emailRes.errors, ...inappRes.errors].slice(0, 10),
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}
