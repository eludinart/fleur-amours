/**
 * GET/POST /api/admin/ai/config
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { AI_PROVIDERS, isAiProvider } from '@/lib/ai-providers'
import type { AiTier } from '@/lib/ai-tiers'
import { AI_TIERS } from '@/lib/ai-tiers'
import {
  getAiRuntimeConfig,
  isMistralKeyConfigured,
  isOpenRouterKeyConfigured,
  resolveModelForTier,
  setAiRuntimeConfig,
} from '@/lib/db-ai-config'

export const dynamic = 'force-dynamic'

function tierModelsPayload(cfg: Awaited<ReturnType<typeof getAiRuntimeConfig>>) {
  const openrouter: Record<AiTier, string | null> = { light: null, standard: null, premium: null }
  const mistral: Record<AiTier, string | null> = { light: null, standard: null, premium: null }
  for (const tier of AI_TIERS) {
    openrouter[tier] = cfg.openrouterModels[tier]
    mistral[tier] = cfg.mistralModels[tier]
  }
  return { openrouter, mistral }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)
    const cfg = await getAiRuntimeConfig()
    const models: Record<AiTier, string> = {
      light: await resolveModelForTier('light', cfg),
      standard: await resolveModelForTier('standard', cfg),
      premium: await resolveModelForTier('premium', cfg),
    }
    return NextResponse.json({
      config: {
        provider: cfg.provider,
        openrouter_model: cfg.openrouterModel,
        mistral_model: cfg.mistralModel,
        openrouter_models: tierModelsPayload(cfg).openrouter,
        mistral_models: tierModelsPayload(cfg).mistral,
        source: cfg.source,
      },
      providers: AI_PROVIDERS,
      keys: {
        openrouter: isOpenRouterKeyConfigured(),
        mistral: isMistralKeyConfigured(),
        openrouter_chars: process.env.OPENROUTER_API_KEY?.trim().length ?? 0,
        mistral_chars: process.env.MISTRAL_API_KEY?.trim().length ?? 0,
      },
      active: {
        provider: cfg.provider,
        models,
        model: models.standard,
        configured: cfg.provider === 'mistral' ? isMistralKeyConfigured() : isOpenRouterKeyConfigured(),
      },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req)
    const body = (await req.json().catch(() => ({}))) as {
      provider?: string
      openrouter_model?: string | null
      mistral_model?: string | null
      openrouter_models?: Partial<Record<AiTier, string | null>>
      mistral_models?: Partial<Record<AiTier, string | null>>
    }

    const partial: Parameters<typeof setAiRuntimeConfig>[0] = {}

    if (body.provider !== undefined) {
      const p = String(body.provider).trim().toLowerCase()
      if (!isAiProvider(p)) {
        return NextResponse.json({ error: 'Provider invalide' }, { status: 422 })
      }
      partial.provider = p
    }
    if (body.openrouter_model !== undefined) {
      partial.openrouterModel =
        body.openrouter_model == null || body.openrouter_model === ''
          ? null
          : String(body.openrouter_model).trim().slice(0, 120)
    }
    if (body.mistral_model !== undefined) {
      partial.mistralModel =
        body.mistral_model == null || body.mistral_model === ''
          ? null
          : String(body.mistral_model).trim().slice(0, 120)
    }
    if (body.openrouter_models) {
      const m: Partial<Record<AiTier, string | null>> = {}
      for (const tier of AI_TIERS) {
        if (body.openrouter_models[tier] !== undefined) {
          const v = body.openrouter_models[tier]
          m[tier] = v == null || v === '' ? null : String(v).trim().slice(0, 120)
        }
      }
      partial.openrouterModels = m
    }
    if (body.mistral_models) {
      const m: Partial<Record<AiTier, string | null>> = {}
      for (const tier of AI_TIERS) {
        if (body.mistral_models[tier] !== undefined) {
          const v = body.mistral_models[tier]
          m[tier] = v == null || v === '' ? null : String(v).trim().slice(0, 120)
        }
      }
      partial.mistralModels = m
    }

    const res = await setAiRuntimeConfig(partial)
    const cfg = await getAiRuntimeConfig()
    return NextResponse.json({
      saved: res.saved,
      config: {
        provider: cfg.provider,
        openrouter_model: cfg.openrouterModel,
        mistral_model: cfg.mistralModel,
        openrouter_models: tierModelsPayload(cfg).openrouter,
        mistral_models: tierModelsPayload(cfg).mistral,
      },
    })
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
