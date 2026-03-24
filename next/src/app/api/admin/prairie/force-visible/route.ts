/**
 * POST /api/admin/prairie/force-visible
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    if (!body.email) {
      return NextResponse.json({ error: 'email requis' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
