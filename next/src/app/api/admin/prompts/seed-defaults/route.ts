/**
 * POST /api/admin/prompts/seed-defaults
 * Insère les prompts Tuteur et Seuil par défaut en MariaDB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { seedDefaults } from '@/lib/prompts-db'
import { TUTEUR_SYSTEM_PROMPT, THRESHOLD_SYSTEM_PROMPT } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = await req.json().catch(() => ({}))
    const tuteur = (body.tuteur as string) || TUTEUR_SYSTEM_PROMPT
    const threshold = (body.threshold as string) || THRESHOLD_SYSTEM_PROMPT
    if (!tuteur && !threshold) {
      return NextResponse.json({ error: 'tuteur ou threshold requis' }, { status: 400 })
    }
    const ids = await seedDefaults(tuteur, threshold)
    return NextResponse.json({ saved: true, ids })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
