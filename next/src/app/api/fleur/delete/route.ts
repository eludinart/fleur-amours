/**
 * POST /api/fleur/delete
 * Supprime un résultat Fleur de l'utilisateur connecté.
 * Body : { id } (solo) ou { token } (groupe DUO).
 */
import { NextRequest, NextResponse } from 'next/server'
import { isDbConfigured } from '@/lib/db'
import { deleteMyResult } from '@/lib/db-fleur'
import { requireAuth } from '@/lib/api-auth'
import { cacheDel } from '@/lib/server-cache'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req)
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
    }

    const body = (await req.json().catch(() => ({}))) as { id?: number | string; token?: string }
    const id = body.id != null ? parseInt(String(body.id), 10) : null
    const token = body.token ? String(body.token).trim() : null
    if (!id && !token) {
      return NextResponse.json({ error: 'id ou token requis' }, { status: 422 })
    }

    const { deleted } = await deleteMyResult(userId, { id, token })
    cacheDel(`fleur_my_results:${userId}`)
    return NextResponse.json({ ok: deleted > 0, deleted })
  } catch (err: unknown) {
    const e = err as Error & { status?: number }
    const msg = e.message ?? 'Erreur lors de la suppression'
    const status = e.status ?? (msg.includes('non autorisé') ? 403 : 500)
    return NextResponse.json({ error: msg }, { status })
  }
}
