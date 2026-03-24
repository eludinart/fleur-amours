/**
 * POST /api/admin/prompts/delete
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { deletePrompt } from '@/lib/prompts-db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const id = parseInt(String(body.id ?? 0), 10)
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    await deletePrompt(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
