/**
 * Source unique : couleurs et métadonnées visuelles des pétales (fleur SVG, graphiques, OG, carte, etc.).
 * Modifier uniquement ce fichier pour harmoniser toutes les fleurs de l’app.
 */
export type PetalDef = {
  id: string
  name: string
  angle: number
  /** Couleur principale du pétale (remplissage / trait). */
  color: string
  /** Fond léger associé (UI, cartes). */
  bg: string
}

/** Couleurs : grille symbolique, tirées plus lumineuses pour l’écran. */
export const PETAL_DEFS: PetalDef[] = [
  { id: 'agape', name: 'Agapè', angle: 0, color: '#ec8698', bg: '#fff5f7' },
  { id: 'philautia', name: 'Philautia', angle: 45, color: '#b8a2e8', bg: '#f7f4ff' },
  { id: 'mania', name: 'Mania', angle: 90, color: '#e11d48', bg: '#fff1f3' },
  { id: 'storge', name: 'Storgè', angle: 135, color: '#5fa06e', bg: '#f1faf3' },
  { id: 'pragma', name: 'Pragma', angle: 180, color: '#4b7ab8', bg: '#f2f6fc' },
  { id: 'philia', name: 'Philia', angle: 225, color: '#12c48e', bg: '#edfcf6' },
  { id: 'ludus', name: 'Ludus', angle: 270, color: '#14c4e8', bg: '#e8fbff' },
  { id: 'eros', name: 'Éros', angle: 315, color: '#9559f2', bg: '#f6f0ff' },
]

export const PETAL_BY_ID: Record<string, PetalDef> = Object.fromEntries(PETAL_DEFS.map((p) => [p.id, p]))

/** Ordre stable pour normalisation des scores (identique à `PETAL_ORDER` côté tarot). */
export const PETAL_ORDER_IDS: readonly string[] = PETAL_DEFS.map((p) => p.id)

const agape = PETAL_BY_ID.agape
const philia = PETAL_BY_ID.philia
const eros = PETAL_BY_ID.eros

/** Cœur de la fleur (dégradé radial par défaut, hors accent zen) — aligné sur Agapè corail. */
export const FLOWER_CORE_GRADIENT_STOPS = {
  inner: { color: '#fdeef2', opacity: 0.92 },
  mid: { color: '#efb0c0', opacity: 0.65 },
  outer: { color: agape.color, opacity: 0.45 },
} as const

/**
 * Mode comparatif deux personnes : teintes des pastilles + lien vers les pétalés pour le trait.
 */
export const FLOWER_PERSON_GRADIENT = {
  a: { fill: '#efb0c0' as const, strokeFromPetalId: 'agape' as const },
  b: { fill: '#6ee7b7' as const, strokeFromPetalId: 'philia' as const },
} as const

/** Point central secondaire quand aucun accent zen. */
export const FLOWER_CENTER_INNER_DOT_FALLBACK = agape.color

/** OG / métriques : dominant inconnu ou hors liste. */
export const PETAL_COLOR_UNKNOWN_DOMINANT = eros.color

/** Accès rapide à la couleur trait d’un pétale. */
export function petalColor(id: string | null | undefined): string | undefined {
  if (!id) return undefined
  return PETAL_BY_ID[id]?.color
}
