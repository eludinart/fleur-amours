/**
 * GET /api/ai/test
 * Test du provider IA actif — réservé aux admins.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { aiProviderLabel } from '@/lib/ai-providers'
import { getAiRuntimeConfig, isActiveAiConfigured, resolveActiveModel } from '@/lib/db-ai-config'
import { llmCall } from '@/lib/llm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Accès refusé' }, { status: e.status ?? 403 })
  }

  const cfg = await getAiRuntimeConfig()
  const model = await resolveActiveModel(cfg)
  const configured = await isActiveAiConfigured(cfg)

  if (!configured) {
    return NextResponse.json({
      ok: false,
      provider: cfg.provider,
      error: `Clé API ${aiProviderLabel(cfg.provider)} manquante. Vérifiez .env et redéployez.`,
    })
  }

  const result = await llmCall(
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
    provider: cfg.provider,
    provider_label: aiProviderLabel(cfg.provider),
    message: ok ? `${aiProviderLabel(cfg.provider)} opérationnel` : 'Réponse invalide',
    model,
  })
}
