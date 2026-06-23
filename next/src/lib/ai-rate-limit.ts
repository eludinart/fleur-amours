/**
 * Rate limiting IA — fenêtre glissante en mémoire (mono-instance).
 */
import type { AiTaskId } from './ai-task-registry'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 3_600_000

function gc(now: number): void {
  if (buckets.size < 20_000) return
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key)
  }
}

export function checkAiRateLimit(
  userId: number,
  taskId: AiTaskId,
  limit: number
): { limited: boolean; retryAfterSec?: number } {
  if (limit <= 0) return { limited: false }

  const now = Date.now()
  gc(now)
  const id = `ai:${userId}:${taskId}`
  const bucket = buckets.get(id)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + WINDOW_MS })
    return { limited: false }
  }

  bucket.count += 1
  if (bucket.count <= limit) return { limited: false }

  return {
    limited: true,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  }
}

/** Pour tests / observabilité admin. */
export function peekAiRateLimit(userId: number, taskId: AiTaskId): number {
  const bucket = buckets.get(`ai:${userId}:${taskId}`)
  if (!bucket || bucket.resetAt <= Date.now()) return 0
  return bucket.count
}
