/**
 * GET /api/ai/status
 * Statut de l'API IA (OpenRouter) — réservé aux utilisateurs connectés.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { getOpenRouterModel } from '@/lib/openrouter-config'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY
  return NextResponse.json({
    ok: hasOpenRouter,
    message: hasOpenRouter
      ? 'OpenRouter opérationnel'
      : 'OPENROUTER_API_KEY non configurée',
    model: getOpenRouterModel(),
  })
}
