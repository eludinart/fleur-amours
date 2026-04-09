/**
 * GET/POST /api/admin/prompts/analyze-mood
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { getAnalyzeMoodPrompt } from '@/lib/prompts-resolver'
import { setPromptOverride } from '@/lib/prompts-db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const content = await getAnalyzeMoodPrompt()
    return NextResponse.json({ content })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const content = String((body as { content?: unknown })?.content ?? '')
    await setPromptOverride('analyze_mood', content)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
