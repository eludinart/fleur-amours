/**
 * GET /api/chat/coaches
 * Liste les coaches (pour "Choisir mon coach").
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { listCoaches } from '@/lib/db-chat'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ coaches: [] })
    }
    const coaches = await listCoaches()
    return NextResponse.json({ coaches })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, coaches: [] }, { status: e.status ?? 401 })
  }
}
