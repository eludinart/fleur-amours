/**
 * Journal d'usage IA — tier, modèle, cache, tokens estimés.
 */
import type { RowDataPacket } from 'mysql2'
import type { AiProvider } from './ai-providers'
import type { AiTier } from './ai-tiers'
import type { AiTaskId } from './ai-task-registry'
import { getPool, isDbConfigured, table } from './db'

const TBL = () => table('fleur_ai_usage_log')

export type AiUsageLogEntry = {
  userId: number | null
  taskId: AiTaskId
  tier: AiTier
  provider: AiProvider | 'none'
  model: string
  cached: boolean
  promptChars: number
  responseChars: number
  estimatedTokens: number
  sapCost: number
  billingMode: string
}

let _ensurePromise: Promise<void> | null = null

export async function ensureAiUsageLogTable(): Promise<boolean> {
  if (!isDbConfigured()) return false
  if (_ensurePromise) return _ensurePromise.then(() => true)

  const prefix = process.env.DB_PREFIX || 'wp_'
  _ensurePromise = getPool()
    .execute(`
      CREATE TABLE IF NOT EXISTS ${prefix}fleur_ai_usage_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        task_id VARCHAR(64) NOT NULL,
        tier VARCHAR(16) NOT NULL,
        provider VARCHAR(32) NOT NULL DEFAULT 'none',
        model VARCHAR(120) NOT NULL DEFAULT '',
        cached TINYINT(1) NOT NULL DEFAULT 0,
        prompt_chars INT NOT NULL DEFAULT 0,
        response_chars INT NOT NULL DEFAULT 0,
        estimated_tokens INT NOT NULL DEFAULT 0,
        sap_cost INT NOT NULL DEFAULT 0,
        billing_mode VARCHAR(24) NOT NULL DEFAULT 'free',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_created (user_id, created_at),
        INDEX idx_task_created (task_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    .then(() => undefined)
    .catch((err) => {
      _ensurePromise = null
      throw err
    })

  return _ensurePromise.then(() => true)
}

function estimateTokens(chars: number): number {
  return Math.max(1, Math.ceil(chars / 4))
}

export async function logAiUsage(entry: AiUsageLogEntry): Promise<void> {
  const ok = await ensureAiUsageLogTable()
  if (!ok) return

  const promptChars = Math.max(0, entry.promptChars)
  const responseChars = Math.max(0, entry.responseChars)
  const estimated =
    entry.estimatedTokens > 0
      ? entry.estimatedTokens
      : estimateTokens(promptChars + responseChars)

  await getPool().execute(
    `INSERT INTO ${TBL()}
     (user_id, task_id, tier, provider, model, cached, prompt_chars, response_chars, estimated_tokens, sap_cost, billing_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.taskId,
      entry.tier,
      entry.provider,
      entry.model.slice(0, 120),
      entry.cached ? 1 : 0,
      promptChars,
      responseChars,
      estimated,
      entry.sapCost,
      entry.billingMode.slice(0, 24),
    ]
  )
}

export type AiUsageStats = {
  totalCalls: number
  cachedCalls: number
  estimatedTokens: number
  byTask: Array<{ task_id: string; count: number; tokens: number }>
  byTier: Array<{ tier: string; count: number; tokens: number }>
  recent: Array<{
    id: number
    user_id: number | null
    task_id: string
    tier: string
    provider: string
    model: string
    cached: boolean
    estimated_tokens: number
    created_at: string
  }>
}

export async function getAiUsageStats(days = 7): Promise<AiUsageStats> {
  const empty: AiUsageStats = {
    totalCalls: 0,
    cachedCalls: 0,
    estimatedTokens: 0,
    byTask: [],
    byTier: [],
    recent: [],
  }
  const ok = await ensureAiUsageLogTable()
  if (!ok) return empty

  const pool = getPool()
  const since = new Date()
  since.setDate(since.getDate() - Math.max(1, Math.min(days, 90)))

  const [totals] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            SUM(cached) AS cached,
            SUM(estimated_tokens) AS tokens
     FROM ${TBL()} WHERE created_at >= ?`,
    [since.toISOString().slice(0, 19).replace('T', ' ')]
  )
  const t = totals[0]
  empty.totalCalls = Number(t?.total ?? 0)
  empty.cachedCalls = Number(t?.cached ?? 0)
  empty.estimatedTokens = Number(t?.tokens ?? 0)

  const [byTask] = await pool.execute<RowDataPacket[]>(
    `SELECT task_id, COUNT(*) AS cnt, SUM(estimated_tokens) AS tokens
     FROM ${TBL()} WHERE created_at >= ?
     GROUP BY task_id ORDER BY cnt DESC LIMIT 30`,
    [since.toISOString().slice(0, 19).replace('T', ' ')]
  )
  empty.byTask = byTask.map((r) => ({
    task_id: String(r.task_id),
    count: Number(r.cnt),
    tokens: Number(r.tokens ?? 0),
  }))

  const [byTier] = await pool.execute<RowDataPacket[]>(
    `SELECT tier, COUNT(*) AS cnt, SUM(estimated_tokens) AS tokens
     FROM ${TBL()} WHERE created_at >= ?
     GROUP BY tier ORDER BY cnt DESC`,
    [since.toISOString().slice(0, 19).replace('T', ' ')]
  )
  empty.byTier = byTier.map((r) => ({
    tier: String(r.tier),
    count: Number(r.cnt),
    tokens: Number(r.tokens ?? 0),
  }))

  const [recent] = await pool.execute<RowDataPacket[]>(
    `SELECT id, user_id, task_id, tier, provider, model, cached, estimated_tokens, created_at
     FROM ${TBL()} ORDER BY id DESC LIMIT 50`
  )
  empty.recent = recent.map((r) => ({
    id: Number(r.id),
    user_id: r.user_id != null ? Number(r.user_id) : null,
    task_id: String(r.task_id),
    tier: String(r.tier),
    provider: String(r.provider),
    model: String(r.model),
    cached: Boolean(r.cached),
    estimated_tokens: Number(r.estimated_tokens ?? 0),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }))

  return empty
}
