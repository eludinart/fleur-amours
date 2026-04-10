/**
 * Fusionne la fleur utilisateur (scores normalisés) avec un accent lié au tirage,
 * pour le payload `shareFlower` et l’aperçu sur l’écran de tirage.
 */
import { tarotCardSubdeck } from '@/data/tarotCards'
import { PETAL_TO_LANDING_CARD } from '@/lib/petal-tarot'
import { PETAL_ORDER_IDS } from '@/lib/petal-theme'

const BOOST_LOVE_SOLO = 0.28
const BOOST_PAIR = 0.16
const DEFAULT_BASE = 0.18
/** Quatre cartes : éviter de saturer les pétales. */
const FOUR_SCALE = 0.72

const SUBDECK_PAIR: Record<'vegetal' | 'elements' | 'life', readonly [string, string]> = {
  vegetal: ['storge', 'pragma'],
  elements: ['eros', 'ludus'],
  life: ['agape', 'philia'],
}

function emptyBase(): Record<string, number> {
  const o: Record<string, number> = {}
  for (const id of PETAL_ORDER_IDS) o[id] = DEFAULT_BASE
  return o
}

function cloneBase(base: Record<string, number> | null | undefined): Record<string, number> {
  if (!base || typeof base !== 'object') return emptyBase()
  const o: Record<string, number> = {}
  for (const id of PETAL_ORDER_IDS) {
    o[id] = Math.min(1, Math.max(0, Number(base[id] ?? 0)))
  }
  return o
}

export function petalIdFromLoveCardNameFr(cardNameFr: string): string | null {
  const n = cardNameFr.trim()
  const hit = Object.entries(PETAL_TO_LANDING_CARD).find(([, card]) => card === n)
  return hit ? hit[0] : null
}

function applyBoost(out: Record<string, number>, id: string, amount: number) {
  out[id] = Math.min(1, Math.max(0, (out[id] ?? 0) + amount))
}

export type TirageFlowerDrawInput =
  | { mode: 'simple'; cardNameFr: string }
  | { mode: 'four'; cardNamesFr: string[] }

export function buildSharePetalsWithTirageInfluence(
  basePetals: Record<string, number> | null | undefined,
  draw: TirageFlowerDrawInput
): { petals: Record<string, number>; drawPetalIds: string[] } {
  const out = cloneBase(basePetals)
  const drawPetalIds = new Set<string>()

  if (draw.mode === 'simple') {
    const name = draw.cardNameFr.trim()
    const lovePetal = petalIdFromLoveCardNameFr(name)
    if (lovePetal) {
      applyBoost(out, lovePetal, BOOST_LOVE_SOLO)
      drawPetalIds.add(lovePetal)
    } else {
      const deck = tarotCardSubdeck(name)
      if (deck && deck !== 'love') {
        const [a, b] = SUBDECK_PAIR[deck]
        applyBoost(out, a, BOOST_PAIR)
        applyBoost(out, b, BOOST_PAIR)
        drawPetalIds.add(a)
        drawPetalIds.add(b)
      }
    }
  } else {
    for (const raw of draw.cardNamesFr.slice(0, 4)) {
      const name = raw.trim()
      if (!name) continue
      const lovePetal = petalIdFromLoveCardNameFr(name)
      if (lovePetal) {
        applyBoost(out, lovePetal, BOOST_LOVE_SOLO * FOUR_SCALE)
        drawPetalIds.add(lovePetal)
      } else {
        const deck = tarotCardSubdeck(name)
        if (deck && deck !== 'love') {
          const [a, b] = SUBDECK_PAIR[deck]
          applyBoost(out, a, BOOST_PAIR * FOUR_SCALE)
          applyBoost(out, b, BOOST_PAIR * FOUR_SCALE)
          drawPetalIds.add(a)
          drawPetalIds.add(b)
        }
      }
    }
  }

  return { petals: out, drawPetalIds: [...drawPetalIds] }
}

export function enrichTarotPayloadWithShareFlower(
  payload: Record<string, unknown>,
  basePetals: Record<string, number> | null | undefined
): Record<string, unknown> {
  const typ = payload.type === 'four' ? 'four' : 'simple'
  let result: { petals: Record<string, number>; drawPetalIds: string[] }
  if (typ === 'four') {
    const cards = (payload.cards as Array<{ name?: string }>) || []
    result = buildSharePetalsWithTirageInfluence(basePetals, {
      mode: 'four',
      cardNamesFr: cards.map((c) => String(c?.name ?? '').trim()),
    })
  } else {
    const card = payload.card as { name?: string } | undefined
    result = buildSharePetalsWithTirageInfluence(basePetals, {
      mode: 'simple',
      cardNameFr: String(card?.name ?? '').trim(),
    })
  }
  return {
    ...payload,
    shareFlower: {
      petals: result.petals,
      drawPetalIds: result.drawPetalIds,
      capturedAt: new Date().toISOString(),
    },
  }
}
