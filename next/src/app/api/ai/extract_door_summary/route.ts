/**
 * POST /api/ai/extract_door_summary
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    return NextResponse.json({
      synthesis_suggestion: '',
      paths_solutions: '',
      intention_emerged: '',
      choices_emerged: '',
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
