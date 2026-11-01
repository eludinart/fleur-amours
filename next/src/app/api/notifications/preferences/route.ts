/**
 * GET  /api/notifications/preferences — préférences de notification de l'utilisateur.
 * POST /api/notifications/preferences — sauvegarde (JSON dans usermeta).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefs,
  readNotificationPrefs,
  writeNotificationPrefs,
} from '@/lib/notification-prefs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) return NextResponse.json(DEFAULT_NOTIFICATION_PREFS)
    const prefs = await readNotificationPrefs(parseInt(userId, 10))
    return NextResponse.json(prefs)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const prefs = normalizeNotificationPrefs(body)
    await writeNotificationPrefs(parseInt(userId, 10), prefs)
    return NextResponse.json(prefs)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
