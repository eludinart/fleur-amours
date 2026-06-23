/**
 * GET /api/admin/ai/test — test du provider IA actif (par tier).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { aiProviderLabel } from '@/lib/ai-providers'
import type { AiTier } from '@/lib/ai-tiers'
import { AI_TIERS } from '@/lib/ai-tiers'
import { getAiRuntimeConfig, isActiveAiConfigured, resolveModelForTier } from '@/lib/db-ai-config'
import { llmCall } from '@/lib/llm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message ?? 'Accès refusé' }, { status: e.status ?? 403 })
  }

  const tierParam = req.nextUrl.searchParams.get('tier') as AiTier | null
  const tiers: AiTier[] =
    tierParam && AI_TIERS.includes(tierParam) ? [tierParam] : ['light', 'standard', 'premium']

  const cfg = await getAiRuntimeConfig()
  const configured = await isActiveAiConfigured(cfg)

  if (!configured) {
    return NextResponse.json({
      ok: false,
      provider: cfg.provider,
      provider_label: aiProviderLabel(cfg.provider),
      error: `Clé API ${aiProviderLabel(cfg.provider)} manquante.`,
    })
  }

  const results: Array<{ tier: AiTier; model: string; ok: boolean; message: string }> = []

  for (const tier of tiers) {
    const model = await resolveModelForTier(tier, cfg)
    try {
      const result = await llmCall(
        'Réponds UNIQUEMENT par {"test":"ok"}',
        [{ role: 'user', content: 'test' }],
        { maxTokens: 50, tier }
      )
      const ok =
        result && typeof result === 'object' && (result as Record<string, unknown>).test === 'ok'
      results.push({
        tier,
        model,
        ok: !!ok,
        message: ok ? 'OK' : 'Réponse invalide',
      })
    } catch (e: unknown) {
      results.push({
        tier,
        model,
        ok: false,
        message: (e as Error)?.message ?? 'Erreur',
      })
    }
  }

  const allOk = results.every((r) => r.ok)
  return NextResponse.json({
    ok: allOk,
    provider: cfg.provider,
    provider_label: aiProviderLabel(cfg.provider),
    results,
    message: allOk ? `${aiProviderLabel(cfg.provider)} opérationnel` : 'Un ou plusieurs tiers ont échoué',
  })
}
