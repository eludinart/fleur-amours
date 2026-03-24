/**
 * GET /api/sessions/shadow-stats
 * Stats ombre (admin/coach).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { shadowStats } from '@/lib/db-sessions'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ total: 0, by_level: {} })
    }
    await requireAuth(req)
    const data = await shadowStats()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur', total: 0, by_level: {} },
      { status: e.status || 401 }
    )
  }
}
