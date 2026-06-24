/**
 * POST /api/engagement/remind
 * Relances d'engagement unifiées : 1 nudge / utilisateur / fenêtre de cooldown.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, ApiError } from '@/lib/api-auth'
import { runEngagementRemind } from '@/lib/engagement-remind-run'

export const dynamic = 'force-dynamic'

async function authorize(req: NextRequest): Promise<void> {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  if (secret && provided && provided === secret) return
  await requireAdmin(req)
}

export async function POST(req: NextRequest) {
  try {
    await authorize(req)

    const body = (await req.json().catch(() => ({}))) as {
      limit?: number
      activityDays?: number
      cooldownHours?: number
      tirageStaleDays?: number
      dreamscapeStaleDays?: number
      dryRun?: boolean
    }

    const result = await runEngagementRemind(body)
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
