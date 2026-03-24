/**
 * POST /api/ai/card-question
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    return NextResponse.json({
      response_a: '',
      question: "Qu'est-ce que cette carte vous inspire ?",
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
