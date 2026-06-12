/**
 * Lecture / écriture du catalogue de cartes (all_cards.json).
 */
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export type CardRecord = {
  name?: string
  slug?: string
  tags?: string[]
  info?: string[]
  sections?: Array<{
    subtitle?: string
    paragraphs?: string[]
    correspondances?: Record<string, string>
  }>
  meta?: { source?: string; image?: string; last_modified?: string }
}

const CARDS_PATH = join(process.cwd(), 'public', 'api', 'data', 'all_cards.json')

const LOVE_SLUGS = new Set(['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'])
const VEGETAL_SLUGS = new Set([
  'les_racines', 'la_tige', 'les_feuilles', 'le_bouton', 'la_fleur', 'le_fruit',
  'le_pollen', 'le_nectar', 'la_graine_endormie', 'la_germination',
])

let cache: { generated_at?: string; count?: number; cards: CardRecord[] } | null = null

function normalizeSlug(card: CardRecord): string {
  const raw = String(card.slug ?? card.name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return raw
}

export function extractCardTags(card: CardRecord): string[] {
  const tags = new Set<string>((card.tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))
  const slug = normalizeSlug(card)
  if (LOVE_SLUGS.has(slug)) tags.add('porte-coeur')
  if (VEGETAL_SLUGS.has(slug)) tags.add('porte-temps')
  if (!LOVE_SLUGS.has(slug) && !VEGETAL_SLUGS.has(slug)) tags.add('porte-climat')

  for (const sec of card.sections ?? []) {
    const corr = sec.correspondances
    if (!corr) continue
    for (const v of Object.values(corr)) {
      String(v)
        .split(/[,;/]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .forEach((t) => tags.add(t))
    }
  }
  if (card.meta?.image) {
    tags.add(String(card.meta.image).replace(/\.[^.]+$/, '').toLowerCase())
  }
  return [...tags]
}

async function loadStore(): Promise<{ generated_at?: string; count?: number; cards: CardRecord[] }> {
  if (cache) return cache
  const raw = await readFile(CARDS_PATH, 'utf8')
  const data = JSON.parse(raw) as { generated_at?: string; count?: number; cards?: CardRecord[] }
  cache = {
    generated_at: data.generated_at,
    count: data.count,
    cards: (data.cards ?? []).map((c) => ({ ...c, slug: normalizeSlug(c) || c.slug })),
  }
  return cache
}

async function saveStore(data: { generated_at?: string; count?: number; cards: CardRecord[] }): Promise<void> {
  const payload = {
    ...data,
    count: data.cards.length,
    generated_at: new Date().toISOString(),
  }
  await writeFile(CARDS_PATH, JSON.stringify(payload, null, 2), 'utf8')
  cache = payload
}

export async function listCards(): Promise<CardRecord[]> {
  const store = await loadStore()
  return store.cards
}

export async function getCardBySlug(slugOrId: string): Promise<CardRecord | null> {
  const key = String(slugOrId ?? '').trim().toLowerCase()
  if (!key) return null
  const cards = await listCards()
  const byIndex = /^\d+$/.test(key) ? cards[parseInt(key, 10) - 1] : null
  if (byIndex) return byIndex
  return (
    cards.find((c) => normalizeSlug(c) === key.replace(/-/g, '_')) ??
    cards.find((c) => String(c.slug ?? '').toLowerCase() === key) ??
    cards.find((c) => String(c.name ?? '').toLowerCase() === key) ??
    null
  )
}

export async function updateCard(slug: string, card: CardRecord): Promise<CardRecord> {
  const store = await loadStore()
  const norm = normalizeSlug(card)
  const idx = store.cards.findIndex((c) => normalizeSlug(c) === normalizeSlug({ slug }) || normalizeSlug(c) === norm)
  if (idx < 0) throw new Error('Carte introuvable')
  const updated: CardRecord = {
    ...card,
    slug: norm || card.slug,
    meta: { ...(store.cards[idx].meta ?? {}), ...(card.meta ?? {}), last_modified: new Date().toISOString() },
  }
  store.cards[idx] = updated
  await saveStore(store)
  return updated
}

export async function importCards(payload: { cards?: CardRecord[] }): Promise<{ imported: number }> {
  const incoming = payload.cards ?? []
  if (!incoming.length) throw new Error('cards requis')
  const store = await loadStore()
  const bySlug = new Map(store.cards.map((c) => [normalizeSlug(c), c]))
  for (const c of incoming) {
    bySlug.set(normalizeSlug(c), { ...c, slug: normalizeSlug(c) })
  }
  store.cards = [...bySlug.values()]
  await saveStore(store)
  return { imported: incoming.length }
}

export async function listCardFiles(): Promise<Array<{ path: string; name: string }>> {
  const cards = await listCards()
  return cards
    .filter((c) => c.meta?.source || c.meta?.image)
    .map((c) => ({
      path: c.meta?.source ?? c.meta?.image ?? '',
      name: c.name ?? c.slug ?? '',
    }))
}
