/**
 * GET/POST /api/admin/engagement/config — planification des relances automatiques.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import {
  ENGAGEMENT_COOLDOWN_PRESETS,
  cooldownPresetId,
  getEngagementRuntimeConfig,
  setEngagementRuntimeConfig,
} from '@/lib/db-engagement-config'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const config = await getEngagementRuntimeConfig()
    return NextResponse.json({
      config: {
        ...config,
        cooldownPreset: cooldownPresetId(config.cooldownHours),
      },
      presets: ENGAGEMENT_COOLDOWN_PRESETS,
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as {
      enabled?: boolean
      cooldownPreset?: string
      cooldownHours?: number
      inactiveDays?: number
      limit?: number
    }

    const { saved, config } = await setEngagementRuntimeConfig({
      enabled: body.enabled,
      cooldownPreset: body.cooldownPreset,
      cooldownHours: body.cooldownHours,
      inactiveDays: body.inactiveDays,
      limit: body.limit,
    })

    return NextResponse.json({
      saved,
      config: {
        ...config,
        cooldownPreset: cooldownPresetId(config.cooldownHours),
      },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
