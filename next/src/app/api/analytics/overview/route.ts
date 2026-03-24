/**
 * GET /api/analytics/overview
 * Vue d'ensemble analytics (admin/coach).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    return NextResponse.json({ overview: {} })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur', overview: {} },
      { status: e.status || 401 }
    )
  }
}
