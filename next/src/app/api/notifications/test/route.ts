/**
 * POST /api/notifications/test
 * Crée une notification de test adressée à l'utilisateur connecté
 * (vérification du pipeline in-app depuis la page préférences).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createNotification } from '@/lib/db-notifications'
import { isDbConfigured } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }
    const uid = parseInt(userId, 10)
    const result = await createNotification({
      type: 'system',
      title: 'Notification de test',
      body: 'Si vous voyez ce message, vos notifications fonctionnent.',
      action_url: '/',
      action_label: 'Retour au jardin',
      recipient_type: 'user',
      recipient_id: uid,
      priority: 'normal',
      created_by: uid,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: e.status ?? 500 })
  }
}
