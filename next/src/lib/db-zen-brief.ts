/**
 * Cache serveur du bloc « En bref » (Mon Jardin zen home).
 * Règle jardin-ai-token-cache : lire avant d'appeler le modèle.
 */
import type { RowDataPacket } from 'mysql2'
import { exec, getPool, isDbConfigured, table } from './db'

const TBL = () => table('fleur_zen_brief_cache')

let _ensurePromise: Promise<void> | null = null

function ensureTable(): Promise<void> {
  if (!isDbConfigured()) return Promise.resolve()
  if (!_ensurePromise) {
    _ensurePromise = getPool()
      .execute(`
        CREATE TABLE IF NOT EXISTS ${TBL()} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          signature VARCHAR(96) NOT NULL,
          locale VARCHAR(8) NOT NULL DEFAULT 'fr',
          brief_json MEDIUMTEXT NOT NULL,
          provider VARCHAR(40) DEFAULT NULL,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_user_locale (user_id, locale),
          INDEX idx_signature (signature)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      .then(() => undefined)
      .catch((err) => {
        _ensurePromise = null
        throw err
      })
  }
  return _ensurePromise
}

export type ZenBriefPayload = {
  headline: string
  profile: string
  aspirations: string
  movement: string
}

/** Coupe au dernier point si dépassement — évite les phrases tronquées en milieu de mot. */
export function truncateAtSentence(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const lastEnd = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'), cut.lastIndexOf('…'))
  if (lastEnd >= Math.floor(max * 0.45)) return cut.slice(0, lastEnd + 1).trim()
  const lastSpace = cut.lastIndexOf(' ')
  if (lastSpace >= 40) return `${cut.slice(0, lastSpace).trim()}…`
  return `${cut.trim()}…`
}

/** Normalise une réponse modèle ou un cache legacy (ancien champ portrait). */
export function normalizeZenBriefPayload(raw: Record<string, unknown>): ZenBriefPayload {
  const headline = String(raw.headline ?? '').trim()
  const legacyPortrait = String(raw.portrait ?? '').trim()
  const profile = String(raw.profile ?? '').trim() || legacyPortrait
  const aspirations = String(raw.aspirations ?? '').trim()
  const movement = String(raw.movement ?? raw.focus ?? '').trim()
  return {
    headline: truncateAtSentence(headline, 160),
    profile: truncateAtSentence(profile, 520),
    aspirations: truncateAtSentence(aspirations, 520),
    movement: truncateAtSentence(movement, 420),
  }
}

export async function getCachedZenBrief(
  userId: number,
  locale: string,
  signature: string
): Promise<ZenBriefPayload | null> {
  if (!isDbConfigured()) return null
  await ensureTable()
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT brief_json FROM ${TBL()} WHERE user_id = ? AND locale = ? AND signature = ? LIMIT 1`,
    [userId, locale, signature]
  )
  if (!rows?.length) return null
  try {
    const parsed = JSON.parse(rows[0].brief_json as string) as Record<string, unknown>
    if (!parsed?.headline && !parsed?.profile && !parsed?.portrait && !parsed?.movement) return null
    return normalizeZenBriefPayload(parsed)
  } catch {
    return null
  }
}

export async function setCachedZenBrief(
  userId: number,
  locale: string,
  signature: string,
  brief: ZenBriefPayload,
  provider: string
): Promise<void> {
  if (!isDbConfigured()) return
  await ensureTable()
  const pool = getPool()
  const json = JSON.stringify({
    ...brief,
    cached_at: new Date().toISOString(),
    provider,
  })
  await exec(
    pool,
    `INSERT INTO ${TBL()} (user_id, signature, locale, brief_json, provider)
       VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE signature = VALUES(signature), brief_json = VALUES(brief_json),
       provider = VALUES(provider), cached_at = CURRENT_TIMESTAMP`,
    [userId, signature, locale, json, provider]
  )
}

/** Signature stable : timeline + profil pétales arrondi. */
export function zenBriefSignature(
  timelineSig: string,
  petals: Record<string, number> | null
): string {
  const petalPart = petals
    ? Object.entries(petals)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${Math.round(Number(v) * 100)}`)
        .join(',')
    : 'none'
  return `zb-v1:${timelineSig}:${petalPart}`
}
