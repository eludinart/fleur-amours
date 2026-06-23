/**
 * GET /api/ai/status
 * Statut de l'API IA (provider actif) — utilisateurs connectés.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, ApiError } from '@/lib/api-auth'
import { aiProviderLabel } from '@/lib/ai-providers'
import { getAiRuntimeConfig, isActiveAiConfigured, resolveActiveModel } from '@/lib/db-ai-config'

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

  const cfg = await getAiRuntimeConfig()
  const configured = await isActiveAiConfigured(cfg)
  const model = await resolveActiveModel(cfg)

  return NextResponse.json({
    ok: configured,
    provider: cfg.provider,
    provider_label: aiProviderLabel(cfg.provider),
    message: configured
      ? `${aiProviderLabel(cfg.provider)} opérationnel`
      : `Clé API ${aiProviderLabel(cfg.provider)} non configurée`,
    model,
  })
}
