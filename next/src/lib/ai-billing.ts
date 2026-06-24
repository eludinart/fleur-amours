/**
 * Facturation SAP pour tâches IA premium.
 */
import type { AiTaskId } from './ai-task-registry'
import { getAiTask } from './ai-task-registry'
import type { AiAccessResult } from './ai-access'
import { transactionalSapUpdate } from './db-sap'
import { invalidateUserAccessCache } from './user-billing'

export async function deductSapForAiTask(
  userId: number,
  taskId: AiTaskId,
  access: AiAccessResult,
  idempotencyKey?: string
): Promise<boolean> {
  if (access.billingMode !== 'sap') return true
  const cost = getAiTask(taskId).sapCost
  if (cost <= 0) return true

  const reason = idempotencyKey ? `ai:${taskId}:${idempotencyKey}` : `ai:${taskId}`
  try {
    await transactionalSapUpdate(userId, cost, reason, 'usage')
    invalidateUserAccessCache(userId)
    return true
  } catch {
    return false
  }
}
