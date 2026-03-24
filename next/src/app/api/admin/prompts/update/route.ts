/**
 * POST /api/admin/prompts/update
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { updatePrompt } from '@/lib/prompts-db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const id = parseInt(String(body.id ?? 0), 10)
    const name = String(body.name || '').trim()
    const content = String(body.content || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 })
    await updatePrompt(id, name, content)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
