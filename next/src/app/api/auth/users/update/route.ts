/**
 * POST /api/auth/users/update
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { requireAdmin } from '@/lib/api-auth'
import { adminPatchUser } from '@/lib/db-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const id = Number(body.id ?? body.user_id)
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }
    await adminPatchUser(id, body)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message || 'Erreur' }, { status: e.status || 401 })
  }
}
