/**
 * Textes partage social / OG — ton conversion (clarté, bénéfice, CTA).
 * Utilisé par les routes /api/og/* et les métas injectées côté client.
 */
export const OG_BRAND = "Fleur d'AmOurs"
export const OG_BRAND_LINE = "Bien-être sensible · amour · introspection guidée"

export const OG_CHIP_FREE = 'Gratuit pour commencer'
export const OG_CHIP_PRIVATE = 'Espace bienveillant'
export const OG_CHIP_FAST = 'Résultat en quelques minutes'

/** Promenade Onirique */
export const OG_DREAMSCAPE_KICKER = 'Expérience immersive'
export const OG_DREAMSCAPE_HOOK = 'Un voyage intérieur, doux et profond.'
export const OG_DREAMSCAPE_SUB =
  'Imaginaire, symbolique et mots justes — une pause pour vous retrouver.'
export const OG_DREAMSCAPE_FALLBACK_TITLE = 'Une Promenade à vivre soi-même'
export const OG_DREAMSCAPE_CTA = 'Découvrir la Promenade'
export const OG_DREAMSCAPE_CHIPS = ['Parcours guidé', 'Ton poétique', 'Anonyme'] as const

/** Fleur d'AmOurs */
export const OG_FLEUR_KICKER = 'Cartographie du cœur'
export const OG_FLEUR_HOOK = 'Quelle forme prend votre amour ?'
export const OG_FLEUR_SUB =
  'Huit pétales, huit manières d’aimer — visualisez votre équilibre émotionnel.'
export const OG_FLEUR_CTA = 'Faire le test gratuit'
export const OG_FLEUR_CHIPS = ['8 dimensions', 'Visuel unique', 'Interprétation guidée'] as const

/** Tirage tarot */
export const OG_TAROT_KICKER_SIMPLE = 'Tirage en ligne'
export const OG_TAROT_KICKER_4 = 'Tirage 4 portes'
export const OG_TAROT_HOOK_SIMPLE = 'Une carte pour éclairer votre chemin.'
export const OG_TAROT_HOOK_4 = 'Quatre cartes, une lecture d’ensemble.'
export const OG_TAROT_SUB = 'Tarot d’accompagnement — symboles, cartes et synthèse.'
export const OG_TAROT_CTA = 'Tirer mes cartes gratuitement'
export const OG_TAROT_CHIPS_SIMPLE = ['Intention', 'Symbolique', 'Synthèse'] as const
export const OG_TAROT_CHIPS_4 = ['4 positions', 'Vue d’ensemble', 'Message clair'] as const

/** Meta descriptions max ~155 chars for social snippets */
export function ogMetaDescriptionDreamscape(synthesisSnippet: string | null | undefined): string {
  const hook =
    'Promenade Onirique sur Fleur d’AmOurs : expérience poétique guidée. '
  const tail = ' Essayez gratuitement — quelques minutes, à votre rythme.'
  if (!synthesisSnippet?.trim()) return (hook + tail).slice(0, 300)
  const q = synthesisSnippet.trim().replace(/\s+/g, ' ')
  const maxQuote = 90
  const quote = q.length > maxQuote ? `${q.slice(0, maxQuote)}…` : q
  return `${hook}« ${quote} »${tail}`.slice(0, 300)
}

export function ogMetaDescriptionFleur(): string {
  return (
    'Ma Fleur d’AmOurs : découvrez en un visuel vos 8 dimensions de l’amour ' +
    '(Agapè, Philia, Éros…). Test gratuit sur Fleur d’AmOurs — inscription en un clic.'
  )
}

export function ogMetaDescriptionTirage(cardHint: string, synthSnippet: string | null): string {
  const open = `Tirage Fleur d’AmOurs — ${cardHint}. `
  const mid = synthSnippet?.trim()
    ? `« ${synthSnippet.trim().slice(0, 75)}${synthSnippet.length > 75 ? '…' : ''} » `
    : ''
  const close = 'Tirez vos cartes gratuitement et recevez votre synthèse.'
  return (open + mid + close).slice(0, 300)
}

export function ogMetaTitleDreamscape(): string {
  return `Promenade Onirique — ${OG_BRAND}`
}

export function ogMetaTitleFleur(): string {
  return `Ma Fleur d’AmOurs — ${OG_BRAND}`
}

export function ogMetaTitleTirage(cardName: string): string {
  const hint = cardName ? ` — ${cardName}` : ''
  return `Mon tirage${hint} — ${OG_BRAND}`
}
