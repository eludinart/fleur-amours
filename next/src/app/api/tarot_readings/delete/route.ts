/**
 * POST /api/tarot_readings/delete
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { deleteById } from '@/lib/db-tarot'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)

    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = await req.json().catch(() => ({}))
    const id = parseInt(String(body.id ?? 0), 10)

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }

    const deleted = await deleteById(id, userId)
    return NextResponse.json({ deleted })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
