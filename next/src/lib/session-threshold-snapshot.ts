/**
 * Snapshot du résultat IA « seuil » — persisté dans step_data pour reprise, coach, admin
 * sans rappeler /api/ai/threshold (économie tokens).
 */
export type ThresholdDataLike = {
  firstWords?: string
  door_suggested?: string
  first_question?: string
  door_reason?: string
  card_group_hint?: string
  provider?: string
} | null
  | undefined

export function thresholdSnapshotFromThresholdData(
  td: ThresholdDataLike,
  options?: { withCachedAt?: boolean }
): Record<string, unknown> | null {
  if (!td?.firstWords) return null
  const snap: Record<string, unknown> = {
    first_words: td.firstWords,
    door_suggested: td.door_suggested ?? null,
    door_reason: td.door_reason ?? null,
    first_question: td.first_question ?? null,
    card_group_hint: td.card_group_hint ?? null,
    provider: td.provider ?? null,
  }
  if (options?.withCachedAt) snap.cached_at = new Date().toISOString()
  return snap
}
