/**
 * GET /api/ai/test
 * Test OpenRouter (réponse JSON simple) — réservé aux admins, tous environnements.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { openrouterCall } from '@/lib/openrouter'
import { getOpenRouterModel } from '@/lib/openrouter-config'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Accès refusé' }, { status: e.status ?? 403 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({
      ok: false,
      error: 'OPENROUTER_API_KEY vide. Vérifiez .env et redéployez.',
    })
  }
  const result = await openrouterCall(
    'Tu réponds UNIQUEMENT par ce JSON exact, sans aucun texte avant ou après : {"test":"ok"}',
    [{ role: 'user', content: 'Réponds uniquement par {"test":"ok"}' }],
    { maxTokens: 50 }
  )
  const ok =
    result &&
    typeof result === 'object' &&
    (result as Record<string, unknown>).test === 'ok'
  return NextResponse.json({
    ok: !!ok,
    message: ok ? 'OpenRouter opérationnel' : 'Réponse invalide',
    model: getOpenRouterModel(),
  })
}
