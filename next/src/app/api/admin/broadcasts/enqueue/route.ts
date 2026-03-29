import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { enqueueDeliveries } from '@/lib/db-broadcasts'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as { id?: number }
    const id = Number(body.id ?? 0)
    if (!id) throw new Error('id requis')
    const res = await enqueueDeliveries({ broadcastId: id })
    return NextResponse.json(res)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 400 })
  }
}

