/**
 * Appel IA protégé — accès, tier, journalisation.
 */
import { NextResponse } from 'next/server'
import type { AiTaskId } from './ai-task-registry'
import { getAiTask } from './ai-task-registry'
import {
  resolveAiAccess,
  recordLightAiUsage,
  type AiAccessResult,
} from './ai-access'
import { llmCall, getLlmMeta, type LlmMessage, type LlmOptions, type LlmCallMeta } from './llm'
import { logAiUsage } from './db-ai-usage-log'
import type { AiTier } from './ai-tiers'

export class AiAccessDeniedError extends Error {
  readonly result: AiAccessResult

  constructor(result: AiAccessResult) {
    super(result.reason ?? 'Accès IA refusé')
    this.name = 'AiAccessDeniedError'
    this.result = result
  }
}

export function aiAccessErrorResponse(result: AiAccessResult): NextResponse {
  const status =
    result.code === 'RATE_LIMITED'
      ? 429
      : result.code === 'INSUFFICIENT_SAP' || result.code === 'QUOTA_EXCEEDED'
        ? 402
        : 403
  const headers: Record<string, string> = {}
  if (result.code === 'RATE_LIMITED' && result.reason) {
    const m = result.reason.match(/(\d+)s/)
    if (m) headers['Retry-After'] = m[1]
  }
  return NextResponse.json(
    {
      error: result.reason ?? 'Accès IA refusé',
      code: result.code,
      sap_cost: result.sapCost,
      can_use_fallback: result.canUseFallback,
    },
    { status, headers }
  )
}

export type GuardedLlmCallInput = {
  taskId: AiTaskId
  userId: number | null
  system: string
  messages: LlmMessage[]
  options?: LlmOptions
  force?: boolean
  isAdmin?: boolean
  /** Ne pas refacturer / re-vérifier si déjà servi depuis le cache. */
  skipAccessCheck?: boolean
}

export type GuardedLlmCallResult = {
  result: Record<string, unknown> | string | null
  meta: LlmCallMeta & { tier: AiTier }
  access: AiAccessResult
}

export async function guardedLlmCall(input: GuardedLlmCallInput): Promise<GuardedLlmCallResult> {
  const task = getAiTask(input.taskId)

  const access = input.skipAccessCheck
    ? {
        allowed: true,
        tier: task.tier,
        taskId: input.taskId,
        billingMode: (input.isAdmin ? 'admin' : 'free') as AiAccessResult['billingMode'],
        sapCost: task.sapCost,
        requiresSap: false,
        canUseFallback: false,
      }
    : await resolveAiAccess(input.userId, input.taskId, {
        force: input.force,
        isAdmin: input.isAdmin,
      })

  if (!access.allowed) {
    throw new AiAccessDeniedError(access)
  }

  const result = await llmCall(input.system, input.messages, {
    ...input.options,
    tier: task.tier,
  })

  const meta = await getLlmMeta(task.tier)

  const promptChars =
    input.system.length +
    input.messages.reduce((n, msg) => n + String(msg.content ?? '').length, 0)
  const responseChars =
    typeof result === 'string'
      ? result.length
      : result
        ? JSON.stringify(result).length
        : 0

  void logAiUsage({
    userId: input.userId,
    taskId: input.taskId,
    tier: task.tier,
    provider: meta.provider,
    model: meta.model,
    cached: false,
    promptChars,
    responseChars,
    estimatedTokens: 0,
    sapCost: access.billingMode === 'sap' ? task.sapCost : 0,
    billingMode: access.billingMode,
  }).catch(() => {})

  if (access.billingMode === 'free' && task.tier === 'light' && input.userId != null) {
    void recordLightAiUsage(input.userId).catch(() => {})
  }

  return { result, meta: { ...meta, tier: task.tier }, access }
}

/** Journalise une lecture cache (pas d'appel modèle). */
export async function logAiCacheHit(
  taskId: AiTaskId,
  userId: number | null,
  responseChars = 0
): Promise<void> {
  const task = getAiTask(taskId)
  void logAiUsage({
    userId,
    taskId,
    tier: task.tier,
    provider: 'none',
    model: 'cache',
    cached: true,
    promptChars: 0,
    responseChars,
    estimatedTokens: 0,
    sapCost: 0,
    billingMode: 'free',
  }).catch(() => {})
}
