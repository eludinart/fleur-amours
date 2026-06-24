/**
 * Contexte personnalisé pour relances (profil, tirages, parcours en cours).
 */
import type { RowDataPacket } from 'mysql2'
import { authMe } from './db-auth'
import { my as tarotMy } from './db-tarot'
import { listByEmailForTimeline } from './db-sessions'
import { getPool, isDbConfigured, table } from './db'
import { dominantPetalId } from './petal-tarot'
import { resolveUserPetalsProfile } from './resolve-user-petals'
import { detectCoachGateway } from './petal-persistence'
import { getUserLocalesBatch } from './user-locale'
import { tServer, type ServerLocale } from './i18n-server'

export type EngagementPersonalization = {
  locale: ServerLocale
  displayName: string
  pseudo: string | null
  dominantPetalId: string | null
  dominantPetalName: string | null
  shadowPetalName: string | null
  lastCardName: string | null
  inProgressSessionId: number | null
  inProgressDoor: string | null
}

async function readPseudo(userId: number): Promise<string | null> {
  if (!isDbConfigured()) return null
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT meta_value FROM ${table('usermeta')} WHERE user_id = ? AND meta_key = 'fleur_pseudo' LIMIT 1`,
    [userId]
  )
  const v = String(rows[0]?.meta_value ?? '').trim()
  return v || null
}

function petalLabel(locale: ServerLocale, petalId: string | null): string | null {
  if (!petalId) return null
  return tServer(locale, `engagement.petals.${petalId}`, {})
}

function extractLastCardName(reading: Record<string, unknown> | undefined): string | null {
  if (!reading) return null
  const type = String(reading.type ?? 'simple')
  if (type === 'four' && Array.isArray(reading.cards)) {
    const first = (reading.cards as Array<{ name?: string }>)[0]
    return first?.name ? String(first.name) : null
  }
  const card = (reading.card || (reading.cards as unknown[])?.[0]) as { name?: string } | undefined
  return card?.name ? String(card.name) : null
}

export async function loadEngagementPersonalization(
  userId: number,
  email: string | null
): Promise<EngagementPersonalization> {
  const localeMap = await getUserLocalesBatch([userId])
  const locale = localeMap.get(userId) ?? 'fr'

  let displayName = ''
  let userEmail = email
  try {
    const me = await authMe(userId)
    displayName = String(me.name ?? '').trim()
    userEmail = userEmail || me.email || null
  } catch {
    /* ignore */
  }

  const pseudo = await readPseudo(userId)
  const nameForGreeting = pseudo || displayName || ''

  const petals = await resolveUserPetalsProfile(userId, userEmail)
  const domId = dominantPetalId(petals)
  const dominantPetalName = petalLabel(locale, domId)

  const { items: readings } = await tarotMy(String(userId), userEmail)
  const lastCardName = extractLastCardName(readings[0])

  let inProgressSessionId: number | null = null
  let inProgressDoor: string | null = null
  let sessions: Array<Record<string, unknown>> = []
  if (userEmail) {
    const { items } = await listByEmailForTimeline(userEmail, 15)
    sessions = items
    const open = items.find((s) => {
      const st = String(s.status ?? '').toLowerCase()
      return st === 'in_progress' || st === 'open' || st === 'active' || st === 'started'
    })
    if (open) {
      inProgressSessionId = Number(open.id) || null
      inProgressDoor = open.door_suggested ? String(open.door_suggested) : null
    }
  }

  const gateway = detectCoachGateway({ sessions, readings })
  const shadowPetalName = gateway ? petalLabel(locale, gateway.petalId) : null

  return {
    locale,
    displayName: nameForGreeting,
    pseudo,
    dominantPetalId: domId,
    dominantPetalName,
    shadowPetalName,
    lastCardName,
    inProgressSessionId,
    inProgressDoor,
  }
}

export async function loadEngagementPersonalizationsBatch(
  users: Array<{ userId: number; email: string | null }>
): Promise<Map<number, EngagementPersonalization>> {
  const out = new Map<number, EngagementPersonalization>()
  for (const u of users) {
    out.set(u.userId, await loadEngagementPersonalization(u.userId, u.email))
  }
  return out
}
