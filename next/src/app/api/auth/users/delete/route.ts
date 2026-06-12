/**
 * POST /api/auth/users/delete
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { deleteUserByAdmin } from '@/lib/db-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const id = parseInt(String(body.id ?? body.user_id ?? 0), 10)
    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    await deleteUserByAdmin(id, parseInt(userId, 10))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status || 400 })
  }
}
