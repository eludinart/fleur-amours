import type { ManuelManifestSection } from '@/lib/manuel'

/** Numéro de chapitre depuis le préfixe du fichier (`21-agape.md` → 21). */
export function manuelFileNum(file: string): number {
  const m = file.match(/^(\d+)-/)
  return m ? parseInt(m[1], 10) : 0
}

export type ManuelZoneId =
  | 'intro'
  | 'heart'
  | 'time'
  | 'climate'
  | 'history'
  | 'annex'

export type IntroGroupId = 'origins' | 'ethics' | 'draws' | 'architecture'

export type ManuelIntroGroup = {
  id: IntroGroupId
  labelKey: string
  hintKey: string
  from: number
  to: number
}

export type ManuelClimateCycle = {
  id: string
  labelKey: string
  from: number
  to: number
}

/** Chapitres absents du sommaire cartographique (toujours accessibles par URL directe). */
export const MANUEL_CARTO_HIDDEN_FILES = new Set([
  '01-le-sol-fertile-du-jardin-d-amours.md',
  '94-l-herbier-des-mots-cles.md',
])

export function isManuelCartoVisible(file: string): boolean {
  return !MANUEL_CARTO_HIDDEN_FILES.has(file)
}

/** Sous-parcours de la partie « Jardin du manuel » (ch. 01–20, avant AGAPÈ). */
export const MANUEL_INTRO_GROUPS: ManuelIntroGroup[] = [
  {
    id: 'origins',
    labelKey: 'manuel.carto.intro.origins',
    hintKey: 'manuel.carto.intro.originsHint',
    from: 1,
    to: 5,
  },
  {
    id: 'ethics',
    labelKey: 'manuel.carto.intro.ethics',
    hintKey: 'manuel.carto.intro.ethicsHint',
    from: 6,
    to: 9,
  },
  {
    id: 'draws',
    labelKey: 'manuel.carto.intro.draws',
    hintKey: 'manuel.carto.intro.drawsHint',
    from: 10,
    to: 14,
  },
  {
    id: 'architecture',
    labelKey: 'manuel.carto.intro.architecture',
    hintKey: 'manuel.carto.intro.architectureHint',
    from: 15,
    to: 20,
  },
]

/** Sous-cycles de la Porte du Climat (éléments + 5 cycles). */
export const MANUEL_CLIMATE_CYCLES: ManuelClimateCycle[] = [
  { id: 'raw', labelKey: 'manuel.carto.climate.raw', from: 41, to: 45 },
  { id: 'earth', labelKey: 'manuel.carto.climate.earth', from: 46, to: 52 },
  { id: 'water', labelKey: 'manuel.carto.climate.water', from: 53, to: 59 },
  { id: 'air', labelKey: 'manuel.carto.climate.air', from: 60, to: 66 },
  { id: 'fire', labelKey: 'manuel.carto.climate.fire', from: 67, to: 73 },
  { id: 'ether', labelKey: 'manuel.carto.climate.ether', from: 74, to: 80 },
]

export type ManuelDoorZone = {
  id: Exclude<ManuelZoneId, 'intro' | 'annex'>
  doorKey: 'love' | 'vegetal' | 'elements' | 'life'
  labelKey: string
  subtitleKey: string
  aspectKey: string
  introFrom: number
  introTo: number
  cardsFrom: number
  cardsTo: number
}

export const MANUEL_DOOR_ZONES: ManuelDoorZone[] = [
  {
    id: 'heart',
    doorKey: 'love',
    labelKey: 'manuel.carto.door.heart',
    subtitleKey: 'manuel.carto.door.heartSub',
    aspectKey: 'manuel.carto.door.heartAspect',
    introFrom: 20,
    introTo: 20,
    cardsFrom: 21,
    cardsTo: 28,
  },
  {
    id: 'time',
    doorKey: 'vegetal',
    labelKey: 'manuel.carto.door.time',
    subtitleKey: 'manuel.carto.door.timeSub',
    aspectKey: 'manuel.carto.door.timeAspect',
    introFrom: 29,
    introTo: 29,
    cardsFrom: 30,
    cardsTo: 39,
  },
  {
    id: 'climate',
    doorKey: 'elements',
    labelKey: 'manuel.carto.door.climate',
    subtitleKey: 'manuel.carto.door.climateSub',
    aspectKey: 'manuel.carto.door.climateAspect',
    introFrom: 40,
    introTo: 40,
    cardsFrom: 41,
    cardsTo: 80,
  },
  {
    id: 'history',
    doorKey: 'life',
    labelKey: 'manuel.carto.door.history',
    subtitleKey: 'manuel.carto.door.historySub',
    aspectKey: 'manuel.carto.door.historyAspect',
    introFrom: 81,
    introTo: 81,
    cardsFrom: 82,
    cardsTo: 93,
  },
]

export function sectionsInRange(
  sections: ManuelManifestSection[],
  from: number,
  to: number,
): ManuelManifestSection[] {
  return sections.filter((s) => {
    const n = manuelFileNum(s.file)
    return n >= from && n <= to
  })
}

export function filterSections(
  sections: ManuelManifestSection[],
  query: string,
  titleFor: (section: ManuelManifestSection) => string = (s) => s.title,
): ManuelManifestSection[] {
  const q = query.trim().toLowerCase()
  if (!q) return sections
  return sections.filter((s) => titleFor(s).toLowerCase().includes(q))
}

export function zoneForSection(file: string): ManuelZoneId {
  const n = manuelFileNum(file)
  if (n >= 1 && n <= 20) return 'intro'
  if (n >= 21 && n <= 28) return 'heart'
  if (n >= 29 && n <= 39) return 'time'
  if (n >= 40 && n <= 80) return 'climate'
  if (n >= 81 && n <= 93) return 'history'
  return 'annex'
}

/** Ordre d'affichage du cycle végétal : graine (haut) → nectar (bas). */
export const MANUEL_VEGETAL_STEM_SLUGS = [
  'la-graine-endormie',
  'la-germination',
  'les-racines',
  'la-tige',
  'les-feuilles',
  'le-bouton',
  'la-fleur',
  'le-fruit',
  'le-pollen',
  'le-nectar',
] as const

function vegetalStemSlug(file: string): string {
  return file.replace(/^\d+-/, '').replace(/\.md$/i, '')
}

/** Trie les fiches du cycle végétal (graine en haut, nectar en bas). */
export function sortVegetalStemSections(
  sections: ManuelManifestSection[],
): ManuelManifestSection[] {
  const rank = new Map(MANUEL_VEGETAL_STEM_SLUGS.map((s, i) => [s, i]))
  return [...sections].sort((a, b) => {
    const ra = rank.get(vegetalStemSlug(a.file)) ?? 99
    const rb = rank.get(vegetalStemSlug(b.file)) ?? 99
    return ra - rb
  })
}

/** Rang botanique 1–10 depuis la graine (1) jusqu'au nectar (10). */
export function vegetalStemStep(file: string): number {
  const idx = MANUEL_VEGETAL_STEM_SLUGS.indexOf(
    vegetalStemSlug(file) as (typeof MANUEL_VEGETAL_STEM_SLUGS)[number],
  )
  if (idx < 0) return 0
  return idx + 1
}
export function isManuelCardFile(file: string): boolean {
  const slug = file.replace(/\.md$/i, '').replace(/^\d+-/, '')
  if (/^cycle-(de|du|d)/i.test(slug)) return false
  if (slug === 'les-elements') return false
  if (slug === 'la-fleur-d-amours') return false
  return true
}
