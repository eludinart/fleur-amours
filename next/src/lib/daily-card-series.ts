/**
 * Série 3 jours après ouverture de la carte du jour.
 * Stockage usermeta JSON.
 */
import type { RowDataPacket } from 'mysql2'
import { getPool, isDbConfigured, table } from './db'

const META_KEY = 'fleur_daily_card_series'

export type DailyCardSeriesState = {
  /** 0 = pas démarré, 1 = J1 envoyé/ouvert, 2 = J2, 3 = J3 terminé */
  dayIndex: number
  startedOn: string | null
  lastSentOn: string | null
  cardSlug: string | null
}

const EMPTY: DailyCardSeriesState = {
  dayIndex: 0,
  startedOn: null,
  lastSentOn: null,
  cardSlug: null,
}

function parisDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export async function readDailyCardSeries(userId: number): Promise<DailyCardSeriesState> {
  if (!isDbConfigured() || !userId) return { ...EMPTY }
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${table('usermeta')} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, META_KEY]
  )
  if (!rows?.length) return { ...EMPTY }
  try {
    const raw = JSON.parse(String(rows[0].meta_value ?? '{}')) as Record<string, unknown>
    return {
      dayIndex: Math.min(3, Math.max(0, Number(raw.dayIndex) || 0)),
      startedOn: raw.startedOn ? String(raw.startedOn) : null,
      lastSentOn: raw.lastSentOn ? String(raw.lastSentOn) : null,
      cardSlug: raw.cardSlug ? String(raw.cardSlug) : null,
    }
  } catch {
    return { ...EMPTY }
  }
}

async function writeDailyCardSeries(userId: number, state: DailyCardSeriesState): Promise<void> {
  const pool = getPool()
  const tMeta = table('usermeta')
  const json = JSON.stringify(state)
  const [existing] = await pool.execute<RowDataPacket[]>(
    `SELECT umeta_id FROM ${tMeta} WHERE user_id = ? AND meta_key = ? LIMIT 1`,
    [userId, META_KEY]
  )
  if (existing?.length) {
    await pool.execute(`UPDATE ${tMeta} SET meta_value = ? WHERE umeta_id = ?`, [
      json,
      Number(existing[0].umeta_id),
    ])
  } else {
    await pool.execute(
      `INSERT INTO ${tMeta} (user_id, meta_key, meta_value) VALUES (?, ?, ?)`,
      [userId, META_KEY, json]
    )
  }
}

/** Démarre / marque J1 après envoi carte du jour. */
export async function markSeriesDay1Sent(userId: number, cardSlug: string): Promise<void> {
  const today = parisDateKey()
  await writeDailyCardSeries(userId, {
    dayIndex: 1,
    startedOn: today,
    lastSentOn: today,
    cardSlug,
  })
}

/** Aperçu sans écrire : série due pour J2 ou J3. */
export async function peekSeriesDue(
  userId: number
): Promise<{ campaign: 'serie_j2' | 'serie_j3' | null; state: DailyCardSeriesState }> {
  const state = await readDailyCardSeries(userId)
  const today = parisDateKey()
  if (!state.dayIndex || state.dayIndex >= 3) return { campaign: null, state }
  if (state.lastSentOn === today) return { campaign: null, state }
  if (state.dayIndex === 1) return { campaign: 'serie_j2', state }
  if (state.dayIndex === 2) return { campaign: 'serie_j3', state }
  return { campaign: null, state }
}

/** Après envoi réussi J2/J3. */
export async function markSeriesAdvanced(
  userId: number,
  campaign: 'serie_j2' | 'serie_j3'
): Promise<void> {
  const state = await readDailyCardSeries(userId)
  const today = parisDateKey()
  const dayIndex = campaign === 'serie_j2' ? 2 : 3
  await writeDailyCardSeries(userId, {
    ...state,
    dayIndex,
    lastSentOn: today,
  })
}

export function isSundayParis(d = new Date()): boolean {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
  }).format(d)
  return wd === 'Sun'
}

/** Question courte liée à la carte (template, pas d'IA). */
export function seriesQuestionForCard(locale: string, cardName: string): string {
  const name = cardName || 'cette carte'
  if (locale.startsWith('en')) {
    return `Where do you recognize the energy of ${name} in your life today?`
  }
  return `Où reconnaissez-vous l'énergie de ${name} dans votre vie aujourd'hui ?`
}

export function seriesMicroGeste(locale: string): string {
  if (locale.startsWith('en')) {
    return 'Take 30 seconds for a check-in: name one tension and one resource.'
  }
  return 'Prenez 30 secondes pour un check-in : nommez une tension et une ressource.'
}
