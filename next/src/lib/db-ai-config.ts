/**
 * Configuration IA runtime — choix du provider (admin) + modèles par tier.
 * Les clés API restent dans les variables d'environnement.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import type { AiProvider } from './ai-providers'
import { isAiProvider } from './ai-providers'
import type { AiTier } from './ai-tiers'
import { AI_TIERS } from './ai-tiers'
import {
  DEFAULT_OPENROUTER_MODEL,
  getOpenRouterModelForTier,
  OPENROUTER_TIER_DEFAULTS,
} from './openrouter-config'
import {
  DEFAULT_MISTRAL_MODEL,
  getMistralModelForTier,
  MISTRAL_TIER_DEFAULTS,
} from './mistral-config'

const TBL = () => table('fleur_ai_config')

export type TierModels = Record<AiTier, string | null>

export type AiRuntimeConfig = {
  provider: AiProvider
  /** Legacy — équivalent tier standard. */
  openrouterModel: string | null
  mistralModel: string | null
  openrouterModels: TierModels
  mistralModels: TierModels
  source: 'db' | 'env'
}

const DEFAULT_PROVIDER: AiProvider =
  process.env.AI_PROVIDER?.trim().toLowerCase() === 'mistral' ? 'mistral' : 'openrouter'

function emptyTierModels(): TierModels {
  return { light: null, standard: null, premium: null }
}

async function ensureTable(): Promise<boolean> {
  if (!isDbConfigured()) return false
  const pool = getPool()
  const prefix = process.env.DB_PREFIX || 'wp_'
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ${TBL()} (
      id INT PRIMARY KEY DEFAULT 1,
      provider VARCHAR(32) NOT NULL DEFAULT 'openrouter',
      openrouter_model VARCHAR(120) DEFAULT NULL,
      mistral_model VARCHAR(120) DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  const tierCols = [
    'openrouter_model_light',
    'openrouter_model_standard',
    'openrouter_model_premium',
    'mistral_model_light',
    'mistral_model_standard',
    'mistral_model_premium',
  ]
  for (const col of tierCols) {
    await pool
      .execute(
        `ALTER TABLE ${prefix}fleur_ai_config ADD COLUMN IF NOT EXISTS ${col} VARCHAR(120) DEFAULT NULL`
      )
      .catch(() => {})
  }

  try {
    await pool.execute(`INSERT IGNORE INTO ${TBL()} (id, provider) VALUES (1, ?)`, [DEFAULT_PROVIDER])
  } catch {
    /* ignore */
  }
  return true
}

function envFallback(): AiRuntimeConfig {
  return {
    provider: DEFAULT_PROVIDER,
    openrouterModel: null,
    mistralModel: null,
    openrouterModels: emptyTierModels(),
    mistralModels: emptyTierModels(),
    source: 'env',
  }
}

function readTierModels(row: RowDataPacket, prefix: 'openrouter' | 'mistral'): TierModels {
  const out = emptyTierModels()
  for (const tier of AI_TIERS) {
    const col = `${prefix}_model_${tier}`
    const v = row[col]
    out[tier] = v ? String(v) : null
  }
  return out
}

export async function getAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  const ok = await ensureTable()
  if (!ok) return envFallback()

  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM ${TBL()} WHERE id = 1 LIMIT 1`)
  const r = rows[0]
  if (!r) return envFallback()

  const providerRaw = String(r.provider ?? '').trim().toLowerCase()
  const provider: AiProvider = isAiProvider(providerRaw) ? providerRaw : DEFAULT_PROVIDER

  return {
    provider,
    openrouterModel: r.openrouter_model ? String(r.openrouter_model) : null,
    mistralModel: r.mistral_model ? String(r.mistral_model) : null,
    openrouterModels: readTierModels(r, 'openrouter'),
    mistralModels: readTierModels(r, 'mistral'),
    source: 'db',
  }
}

export async function setAiRuntimeConfig(partial: {
  provider?: AiProvider
  openrouterModel?: string | null
  mistralModel?: string | null
  openrouterModels?: Partial<TierModels>
  mistralModels?: Partial<TierModels>
}): Promise<{ saved: boolean }> {
  const ok = await ensureTable()
  if (!ok) return { saved: false }

  const pool = getPool()
  const current = await getAiRuntimeConfig()
  const provider = partial.provider ?? current.provider
  const openrouterModel =
    partial.openrouterModel !== undefined ? partial.openrouterModel : current.openrouterModel
  const mistralModel =
    partial.mistralModel !== undefined ? partial.mistralModel : current.mistralModel

  const orModels = { ...current.openrouterModels, ...partial.openrouterModels }
  const miModels = { ...current.mistralModels, ...partial.mistralModels }

  await pool.execute(
    `UPDATE ${TBL()} SET
      provider = ?,
      openrouter_model = ?,
      mistral_model = ?,
      openrouter_model_light = ?,
      openrouter_model_standard = ?,
      openrouter_model_premium = ?,
      mistral_model_light = ?,
      mistral_model_standard = ?,
      mistral_model_premium = ?
     WHERE id = 1`,
    [
      provider,
      openrouterModel,
      mistralModel,
      orModels.light,
      orModels.standard,
      orModels.premium,
      miModels.light,
      miModels.standard,
      miModels.premium,
    ]
  )
  return { saved: true }
}

export function isOpenRouterKeyConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY?.trim()
}

export function isMistralKeyConfigured(): boolean {
  return !!process.env.MISTRAL_API_KEY?.trim()
}

export async function resolveModelForTier(
  tier: AiTier = 'standard',
  cfg?: AiRuntimeConfig
): Promise<string> {
  const c = cfg ?? (await getAiRuntimeConfig())
  if (c.provider === 'mistral') {
    return (
      c.mistralModels[tier]?.trim() ||
      (tier === 'standard' ? c.mistralModel?.trim() : null) ||
      getMistralModelForTier(tier) ||
      MISTRAL_TIER_DEFAULTS[tier] ||
      DEFAULT_MISTRAL_MODEL
    )
  }
  return (
    c.openrouterModels[tier]?.trim() ||
    (tier === 'standard' ? c.openrouterModel?.trim() : null) ||
    getOpenRouterModelForTier(tier) ||
    OPENROUTER_TIER_DEFAULTS[tier] ||
    DEFAULT_OPENROUTER_MODEL
  )
}

/** @deprecated Préférer resolveModelForTier('standard') */
export async function resolveActiveModel(cfg?: AiRuntimeConfig): Promise<string> {
  return resolveModelForTier('standard', cfg)
}

export async function isActiveAiConfigured(cfg?: AiRuntimeConfig): Promise<boolean> {
  const c = cfg ?? (await getAiRuntimeConfig())
  return c.provider === 'mistral' ? isMistralKeyConfigured() : isOpenRouterKeyConfigured()
}
