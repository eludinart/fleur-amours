/**
 * POST /api/admin/prompts/set-active
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { setActivePrompts } from '@/lib/prompts-db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const tuteur = body.active_tuteur_id != null ? parseInt(String(body.active_tuteur_id), 10) : null
    const threshold = body.active_threshold_id != null ? parseInt(String(body.active_threshold_id), 10) : null
    await setActivePrompts(tuteur || null, threshold || null)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
