/**
 * GET /api/admin/ai/usage — statistiques d'usage IA (tokens estimés).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { getAiUsageStats } from '@/lib/db-ai-usage-log'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const days = parseInt(req.nextUrl.searchParams.get('days') ?? '7', 10)
    const stats = await getAiUsageStats(Number.isFinite(days) ? days : 7)
    return NextResponse.json(stats)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
