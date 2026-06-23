/**
 * POST/GET /api/social/meteo — météo intérieure du jour + mode disponibilité.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { getSocialMeteo, setSocialMeteo } from '@/lib/community-meteo'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })
    if (!isDbConfigured()) {
      return NextResponse.json({ meteoPetal: null, socialMode: 'open' })
    }
    const state = await getSocialMeteo(uid)
    return NextResponse.json(state)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const meteoPetal =
      body.meteoPetal !== undefined
        ? body.meteoPetal
        : body.meteo_petal !== undefined
          ? body.meteo_petal
          : undefined
    const socialMode =
      body.socialMode === 'focus' || body.socialMode === 'open'
        ? body.socialMode
        : body.social_mode === 'focus' || body.social_mode === 'open'
          ? body.social_mode
          : undefined

    if (!isDbConfigured()) {
      return NextResponse.json({ meteoPetal: meteoPetal ?? null, socialMode: socialMode ?? 'open' })
    }

    const state = await setSocialMeteo(uid, {
      ...(meteoPetal !== undefined ? { meteoPetal } : {}),
      ...(socialMode ? { socialMode } : {}),
    })
    return NextResponse.json(state)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 400 })
  }
}
