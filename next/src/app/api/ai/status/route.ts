/**
 * GET /api/ai/status
 * Statut de l'API IA (OpenRouter).
 */
import { NextResponse } from 'next/server'
import { getOpenRouterModel } from '@/lib/openrouter-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY
  return NextResponse.json({
    ok: hasOpenRouter,
    message: hasOpenRouter
      ? 'OpenRouter opérationnel'
      : 'OPENROUTER_API_KEY non configurée',
    model: getOpenRouterModel(),
  })
}
