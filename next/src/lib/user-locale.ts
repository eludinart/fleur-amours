/**
 * Langue UI persistée en base (usermeta) pour e-mails et notifications serveur.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'
import { normalizeServerLocale, type ServerLocale } from './i18n-server'

export const USER_LOCALE_META_KEY = 'fleur_ui_locale'

export async function getUserLocale(userId: number): Promise<ServerLocale> {
  if (!isDbConfigured() || !userId) return 'fr'
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${table('usermeta')} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, USER_LOCALE_META_KEY]
  )
  const raw = rows[0]?.meta_value
  return raw ? normalizeServerLocale(String(raw)) : 'fr'
}

export async function getUserLocalesBatch(userIds: number[]): Promise<Map<number, ServerLocale>> {
  const out = new Map<number, ServerLocale>()
  if (!isDbConfigured() || userIds.length === 0) return out
  const ids = [...new Set(userIds.filter((id) => id > 0))]
  if (!ids.length) return out
  const pool = getPool()
  const ph = ids.map(() => '?').join(', ')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id, meta_value FROM ${table('usermeta')}
     WHERE meta_key = ? AND user_id IN (${ph})`,
    [USER_LOCALE_META_KEY, ...ids]
  )
  for (const r of rows) {
    out.set(Number(r.user_id), normalizeServerLocale(String(r.meta_value ?? 'fr')))
  }
  for (const id of ids) {
    if (!out.has(id)) out.set(id, 'fr')
  }
  return out
}

export async function saveUserLocale(userId: number, locale: string): Promise<void> {
  if (!isDbConfigured() || !userId) return
  const loc = normalizeServerLocale(locale)
  const pool = getPool()
  const tMeta = table('usermeta')
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, USER_LOCALE_META_KEY]
  )
  if (existing.length) {
    await pool.execute(`UPDATE ${tMeta} SET meta_value = ? WHERE user_id = ? AND meta_key = ?`, [
      loc,
      userId,
      USER_LOCALE_META_KEY,
    ])
  } else {
    await pool.execute(`INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`, [
      userId,
      USER_LOCALE_META_KEY,
      loc,
    ])
  }
}
