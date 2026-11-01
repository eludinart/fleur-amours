/**
 * Carte du jour déterministe par utilisateur (userId + date UTC).
 */
import { access } from 'fs/promises'
import { constants } from 'fs'
import { join } from 'path'
import { listCards, type CardRecord } from './cards-data'
import { CANONICAL_JARDIN_ORIGIN } from './app-public-url'

/** CDN / vitrine où les PNG des cartes sont servis publiquement. */
export const CARD_IMAGE_PUBLIC_ORIGIN = 'https://eludein.art'

export type DailyCardPick = {
  slug: string
  name: string
  imageFile: string
  shortDescription: string
  /** URL absolue HTTPS (fallback e-mail si pas de CID). */
  imageUrl: string
}

const SHORT_DESC_MAX = 220

function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/** Hash FNV-1a 32 bits — stable, sans dépendance crypto. */
export function hashDailySeed(userId: number, dateKey: string): number {
  const s = `${Math.floor(userId)}:${dateKey}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function truncateBlurb(text: string, max = SHORT_DESC_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('。'), cut.lastIndexOf('! '))
  if (lastStop > max * 0.45) return cut.slice(0, lastStop + 1).trim()
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function cardShortDescription(card: CardRecord): string {
  const fromInfo = Array.isArray(card.info) ? String(card.info[0] ?? '').trim() : ''
  if (fromInfo) return truncateBlurb(fromInfo)
  const para = card.sections?.[0]?.paragraphs?.find((p) => String(p).trim().length > 20)
  if (para) return truncateBlurb(String(para))
  return ''
}

function publicCardImageUrl(imageFile: string): string {
  const file = String(imageFile || '').replace(/^\/+/, '')
  return `${CARD_IMAGE_PUBLIC_ORIGIN}/cartes/${file}`
}

function cardsWithImages(cards: CardRecord[]): CardRecord[] {
  return cards.filter((c) => {
    const img = String(c.meta?.image ?? '').trim()
    const slug = String(c.slug ?? '').trim()
    const name = String(c.name ?? '').trim()
    return !!img && (!!slug || !!name)
  })
}

export function dailyCardFromRecord(card: CardRecord): DailyCardPick {
  const imageFile = String(card.meta?.image ?? '').trim()
  const slug = String(card.slug ?? card.name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return {
    slug: slug || 'carte',
    name: String(card.name ?? slug).trim() || 'Carte',
    imageFile,
    shortDescription: cardShortDescription(card),
    imageUrl: publicCardImageUrl(imageFile),
  }
}

/** Tirage déterministe pour un utilisateur et un jour (UTC). */
export async function pickDailyCardForUser(
  userId: number,
  date: Date = new Date()
): Promise<DailyCardPick | null> {
  const uid = Math.floor(Number(userId) || 0)
  if (!uid) return null
  const cards = cardsWithImages(await listCards())
  if (!cards.length) return null
  const idx = hashDailySeed(uid, utcDateKey(date)) % cards.length
  return dailyCardFromRecord(cards[idx])
}

/** Carte démo stable pour aperçus admin (même jour → même carte). */
export async function pickDailyCardForPreview(date: Date = new Date()): Promise<DailyCardPick | null> {
  return pickDailyCardForUser(42, date)
}

/**
 * Chemins locaux possibles pour le PNG (dev / standalone / monorepo).
 * Retourne le premier fichier lisible, sinon null.
 */
export async function resolveLocalCardImagePath(imageFile: string): Promise<string | null> {
  const file = String(imageFile || '').trim()
  if (!file || file.includes('..')) return null
  const cwd = process.cwd()
  const candidates = [
    join(cwd, 'FRAMEWORK DOCS', 'CARTES', file),
    join(cwd, '..', 'FRAMEWORK DOCS', 'CARTES', file),
    join(cwd, 'public', 'cartes', file),
    join(cwd, '..', 'public', 'cartes', file),
  ]
  for (const p of candidates) {
    try {
      await access(p, constants.R_OK)
      return p
    } catch {
      /* suivant */
    }
  }
  return null
}

/**
 * Deep link vers le tirage simple avec la carte pré-révélée.
 * TarotPage lit `?landing_card=` (nom exact de la carte, ex. « L’UNITÉ »).
 */
export function dailyCardAppPath(cardNameOrSlug: string): string {
  const s = String(cardNameOrSlug || '').trim()
  if (!s) return '/tirage'
  return `/tirage?landing_card=${encodeURIComponent(s)}`
}

/**
 * CTA e-mail / notif : cible directe le tirage.
 * Si non connecté, ProtectedLayout renvoie vers /login en conservant la query.
 */
export function dailyCardLoginPath(cardNameOrSlug: string): string {
  return dailyCardAppPath(cardNameOrSlug)
}

/** Origine app (debug / docs). */
export function dailyCardShareOrigin(): string {
  return CANONICAL_JARDIN_ORIGIN
}
