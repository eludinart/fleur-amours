/**
 * Recherche d'infos carte (thème, question racine) pour le Tuteur.
 * Infos carte (thème, question racine) pour le Tuteur.
 */
import { readFile } from 'fs/promises'
import { join } from 'path'

const CARDS_PATHS = [
  join(process.cwd(), 'public', 'api', 'data', 'all_cards.json'),
]

type CardData = {
  name?: string
  slug?: string
  info?: string[]
  sections?: Array<{ subtitle?: string; paragraphs?: string[] }>
}

let cardsCache: Map<string, CardData> | null = null

async function loadCards(): Promise<Map<string, CardData>> {
  if (cardsCache) return cardsCache
  for (const p of CARDS_PATHS) {
    try {
      const raw = await readFile(p, 'utf8')
      const all = JSON.parse(raw) as { cards?: CardData[] }
      const map = new Map<string, CardData>()
      for (const c of all.cards ?? []) {
        const slug = (c.slug ?? (c.name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '_'))
        map.set(slug, c)
        if (c.name) map.set(c.name.toLowerCase(), c)
      }
      cardsCache = map
      return map
    } catch {
      continue
    }
  }
  cardsCache = new Map()
  return cardsCache
}

export async function getCardInfo(
  cardName: string
): Promise<{ theme: string; questionRacine: string } | null> {
  if (!cardName || cardName === '__no_card__') return null
  const cards = await loadCards()
  const key = cardName.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  let card = cards.get(key) ?? cards.get(cardName.toLowerCase())
  if (!card) {
    for (const [, c] of cards) {
      if (
        (c.name ?? '').toLowerCase().includes(cardName.toLowerCase()) ||
        (c.slug ?? '').includes(key)
      ) {
        card = c
        break
      }
    }
  }
  if (!card) return null
  let theme = ''
  let questionRacine = ''
  for (const sec of card.sections ?? []) {
    if (sec.subtitle === 'Question Racine :' && sec.paragraphs?.[0]) {
      questionRacine = sec.paragraphs[0]
    }
    if (sec.subtitle === 'Description étendue :' && sec.paragraphs?.[0]) {
      theme = sec.paragraphs[0]
    }
  }
  if (!theme && card.info?.[0]) theme = card.info[0]
  return theme || questionRacine ? { theme, questionRacine } : null
}
