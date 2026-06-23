/**
 * Météo intérieure & mode de disponibilité communautaire.
 * Meta usermeta : fleur_meteo_petal, fleur_meteo_date (YYYY-MM-DD), fleur_social_mode (open|focus).
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from './db'

export type SocialAvailabilityMode = 'open' | 'focus'

export type SocialMeteoState = {
  meteoPetal: string | null
  meteoDate: string | null
  socialMode: SocialAvailabilityMode
}

const VALID_PETALS = new Set([
  'agape',
  'philautia',
  'mania',
  'storge',
  'pragma',
  'philia',
  'ludus',
  'eros',
])

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function upsertMeta(
  pool: Awaited<ReturnType<typeof getPool>>,
  userId: number,
  key: string,
  value: string
): Promise<void> {
  const tMeta = table('usermeta')
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = ?`,
    [userId, key]
  )
  if (existing.length > 0) {
    await pool.execute(
      `UPDATE ${tMeta} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`,
      [value, userId, key]
    )
  } else {
    await pool.execute(
      `INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
      [userId, key, value]
    )
  }
}

export function parseSocialMeteoFromMeta(meta: Record<string, string>): SocialMeteoState {
  const meteoDate = String(meta.fleur_meteo_date ?? '').trim() || null
  const today = todayIso()
  let meteoPetal = String(meta.fleur_meteo_petal ?? '').trim() || null
  if (!meteoDate || meteoDate !== today || !meteoPetal || !VALID_PETALS.has(meteoPetal)) {
    meteoPetal = null
  }
  const modeRaw = String(meta.fleur_social_mode ?? 'open').trim().toLowerCase()
  const socialMode: SocialAvailabilityMode = modeRaw === 'focus' ? 'focus' : 'open'
  return { meteoPetal, meteoDate: meteoPetal ? today : null, socialMode }
}

export async function getSocialMeteo(userId: number): Promise<SocialMeteoState> {
  const pool = getPool()
  const tMeta = table('usermeta')
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT meta_key, meta_value FROM ${tMeta}
       WHERE user_id = ? AND meta_key IN ('fleur_meteo_petal', 'fleur_meteo_date', 'fleur_social_mode')`,
      [userId]
    )
    const map: Record<string, string> = {}
    for (const r of rows) map[String(r.meta_key)] = String(r.meta_value ?? '')
    return parseSocialMeteoFromMeta(map)
  } catch {
    return { meteoPetal: null, meteoDate: null, socialMode: 'open' }
  }
}

export async function setSocialMeteo(
  userId: number,
  patch: { meteoPetal?: string | null; socialMode?: SocialAvailabilityMode }
): Promise<SocialMeteoState> {
  const pool = getPool()
  if (patch.meteoPetal !== undefined) {
    const p = patch.meteoPetal ? String(patch.meteoPetal).trim() : ''
    if (p && VALID_PETALS.has(p)) {
      await upsertMeta(pool, userId, 'fleur_meteo_petal', p)
      await upsertMeta(pool, userId, 'fleur_meteo_date', todayIso())
    } else if (patch.meteoPetal === null) {
      await upsertMeta(pool, userId, 'fleur_meteo_petal', '')
      await upsertMeta(pool, userId, 'fleur_meteo_date', '')
    }
  }
  if (patch.socialMode === 'open' || patch.socialMode === 'focus') {
    await upsertMeta(pool, userId, 'fleur_social_mode', patch.socialMode)
  }
  return getSocialMeteo(userId)
}

/** Batch : user_id → SocialMeteoState (pour Prairie). */
export async function getSocialMeteoBatch(
  userIds: number[]
): Promise<Map<number, SocialMeteoState>> {
  const out = new Map<number, SocialMeteoState>()
  if (!userIds.length) return out
  const pool = getPool()
  const tMeta = table('usermeta')
  const placeholders = userIds.map(() => '?').join(',')
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT user_id, meta_key, meta_value FROM ${tMeta}
       WHERE user_id IN (${placeholders})
         AND meta_key IN ('fleur_meteo_petal', 'fleur_meteo_date', 'fleur_social_mode')`,
      userIds
    )
    const byUser = new Map<number, Record<string, string>>()
    for (const r of rows) {
      const uid = Number(r.user_id)
      if (!byUser.has(uid)) byUser.set(uid, {})
      byUser.get(uid)![String(r.meta_key)] = String(r.meta_value ?? '')
    }
    for (const uid of userIds) {
      out.set(uid, parseSocialMeteoFromMeta(byUser.get(uid) ?? {}))
    }
  } catch {
    for (const uid of userIds) out.set(uid, { meteoPetal: null, meteoDate: null, socialMode: 'open' })
  }
  return out
}
