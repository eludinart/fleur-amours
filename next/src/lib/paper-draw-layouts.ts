/**
 * Formats de tirage papier — grilles de lecture (souples, non contraignantes).
 */
import { FOUR_DOORS, ALL_CARDS } from '@/data/tarotCards'
import { PETAL_DEFS } from '@/lib/petal-theme'

export type PaperDrawLayoutId =
  | 'one'
  | 'two'
  | 'three'
  | 'four_doors'
  | 'flower_8'
  | 'free'

export type PaperDrawSlotRole = 'position' | 'door' | 'petal' | 'free'

export type PaperDrawSlot = {
  id: string
  label: string
  role: PaperDrawSlotRole
  hint?: string
}

export type PaperDrawLayoutDef = {
  id: PaperDrawLayoutId
  labelKey: string
  descKey: string
  icon: string
  slots: PaperDrawSlot[]
  flexHintKey: string
}

const COMPACT_LABELS = ['Situation', 'Ressource', 'Évolution'] as const

function compactSlots(count: 1 | 2 | 3): PaperDrawSlot[] {
  return COMPACT_LABELS.slice(0, count).map((label, i) => ({
    id: `pos_${i + 1}`,
    label,
    role: 'position' as const,
  }))
}

const FOUR_DOOR_SLOTS: PaperDrawSlot[] = FOUR_DOORS.map((d) => ({
  id: d.key,
  label: d.subtitle ?? d.title ?? d.key,
  role: 'door' as const,
  hint: d.title,
}))

const FLOWER_SLOTS: PaperDrawSlot[] = PETAL_DEFS.map((p) => ({
  id: p.id,
  label: p.name,
  role: 'petal' as const,
}))

export const PAPER_DRAW_LAYOUTS: PaperDrawLayoutDef[] = [
  {
    id: 'one',
    labelKey: 'paperDraw.layoutOne',
    descKey: 'paperDraw.layoutOneDesc',
    icon: '1️⃣',
    slots: compactSlots(1),
    flexHintKey: 'paperDraw.flexHint',
  },
  {
    id: 'two',
    labelKey: 'paperDraw.layoutTwo',
    descKey: 'paperDraw.layoutTwoDesc',
    icon: '2️⃣',
    slots: compactSlots(2),
    flexHintKey: 'paperDraw.flexHint',
  },
  {
    id: 'three',
    labelKey: 'paperDraw.layoutThree',
    descKey: 'paperDraw.layoutThreeDesc',
    icon: '3️⃣',
    slots: compactSlots(3),
    flexHintKey: 'paperDraw.flexHint',
  },
  {
    id: 'four_doors',
    labelKey: 'paperDraw.layoutFourDoors',
    descKey: 'paperDraw.layoutFourDoorsDesc',
    icon: '🚪',
    slots: FOUR_DOOR_SLOTS,
    flexHintKey: 'paperDraw.flexHint',
  },
  {
    id: 'flower_8',
    labelKey: 'paperDraw.layoutFlower8',
    descKey: 'paperDraw.layoutFlower8Desc',
    icon: '🌸',
    slots: FLOWER_SLOTS,
    flexHintKey: 'paperDraw.flexHintFlower',
  },
  {
    id: 'free',
    labelKey: 'paperDraw.layoutFree',
    descKey: 'paperDraw.layoutFreeDesc',
    icon: '✨',
    slots: [],
    flexHintKey: 'paperDraw.flexHintFree',
  },
]

export function getPaperDrawLayout(id: PaperDrawLayoutId): PaperDrawLayoutDef | undefined {
  return PAPER_DRAW_LAYOUTS.find((l) => l.id === id)
}

export const ALL_CARD_NAMES: string[] = ALL_CARDS.map((c) => c.name)

export type PaperDrawAssignedCard = {
  card: string
  slot?: string
  role?: 'core' | 'satellite' | 'extra'
  duplicate?: boolean
}

export type PaperDrawUserLayout = {
  assigned: PaperDrawAssignedCard[]
  extras: PaperDrawAssignedCard[]
}
