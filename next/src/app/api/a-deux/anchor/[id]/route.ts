/**
 * GET /api/a-deux/anchor/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { getAnchor } from '@/lib/db-a-deux'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth(req)
    const { id } = await params
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const anchor = await getAnchor(parseInt(id, 10), parseInt(userId, 10))
    if (!anchor) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    return NextResponse.json(anchor)
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
