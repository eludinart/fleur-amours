/**
 * GET /api/sessions/stats
 * Statistiques des sessions (admin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { stats } from '@/lib/db-sessions'
import { requireAdmin } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ total: 0, by_status: {} })
    }
    await requireAdmin(req)
    const data = await stats()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json(
      { error: e.message || 'Erreur', total: 0, by_status: {} },
      { status: e.status || 401 }
    )
  }
}
