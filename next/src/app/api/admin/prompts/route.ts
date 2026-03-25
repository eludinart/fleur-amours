/**
 * GET /api/admin/prompts
 * Liste les prompts Tuteur/Seuil depuis MariaDB (USE_NODE_API).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { listPrompts } from '@/lib/prompts-db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const type = req.nextUrl.searchParams.get('type') as 'tuteur' | 'threshold' | 'coach' | null
    const validType = type === 'tuteur' || type === 'threshold' || type === 'coach' ? type : undefined
    const data = await listPrompts(validType)
    return NextResponse.json({
      prompts: data.prompts,
      type: validType ?? null,
      active: data.active,
      db_configured: data.db_configured ?? true,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message, prompts: [] }, { status: e.status || 401 })
  }
}
