/**
 * GET /api/ai/test
 * Test OpenRouter (réponse JSON simple).
 */
import { NextResponse } from 'next/server'
import { openrouterCall } from '@/lib/openrouter'
import { getOpenRouterModel } from '@/lib/openrouter-config'

export const dynamic = 'force-dynamic'

export async function GET() {
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
