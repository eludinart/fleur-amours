/**
 * POST /api/social/community_onboarding_done
 * Marque l'onboarding communautaire comme terminé pour l'utilisateur courant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import { markCommunityOnboardingDone } from '@/lib/db-social'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    const uid = parseInt(userId, 10)
    if (!uid) {
      return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 401 })
    }
    if (!isDbConfigured()) {
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }
    await markCommunityOnboardingDone(uid)
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 400 })
  }
}
