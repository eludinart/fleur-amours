/**
 * GET /api/engagement/audience
 * Aperçu admin : qui recevrait la prochaine relance auto et quel contenu.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { previewEngagementAudience } from '@/lib/engagement-remind-run'

export const dynamic = 'force-dynamic'

function parseIntParam(raw: string | null, fallback: number, min: number, max: number): number {
  const n = raw ? Number(raw) : fallback
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.round(n), min), max)
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const { searchParams } = new URL(req.url)

    const result = await previewEngagementAudience({
      limit: parseIntParam(searchParams.get('limit'), 250, 1, 500),
      cooldownHours: parseIntParam(searchParams.get('cooldownHours'), 20, 6, 168),
      inactiveDays: parseIntParam(searchParams.get('inactiveDays'), 15, 7, 90),
      activityDays: parseIntParam(searchParams.get('activityDays'), 30, 7, 90),
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    const status = err instanceof ApiError ? err.status : e.status || 500
    return NextResponse.json({ error: e.message || 'Erreur' }, { status })
  }
}
