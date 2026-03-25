/**
 * POST /api/admin/prompts/create
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createPrompt } from '@/lib/prompts-db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const type = String(body.type || '').trim()
    const name = String(body.name || '').trim()
    const content = String(body.content || '')
    if (!type || !name) {
      return NextResponse.json({ error: 'type et name requis' }, { status: 400 })
    }
    if (type !== 'tuteur' && type !== 'threshold' && type !== 'coach') {
      return NextResponse.json({ error: 'type doit être tuteur, threshold ou coach' }, { status: 400 })
    }
    const id = await createPrompt(type, name, content)
    return NextResponse.json({ id }, { status: 201 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
