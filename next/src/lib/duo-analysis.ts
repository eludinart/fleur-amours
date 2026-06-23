/**
 * Analyse duo (zones stable / adjust / desync / fragile) — gère échelles 0–1 et 0–5.
 */
import { PETAL_BY_ID } from './petal-theme'

const PETAL_KEYS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

export function computeDuoAnalysis(
  person_a: { scores?: Record<string, number> } | null | undefined,
  person_b: { scores?: Record<string, number> } | null | undefined
) {
  const scoresA = person_a?.scores ?? {}
  const scoresB = person_b?.scores ?? {}
  const allVals = [...Object.values(scoresA), ...Object.values(scoresB)].filter(
    (v) => typeof v === 'number'
  )
  const maxVal = allVals.length ? Math.max(...allVals) : 0
  const normalized = maxVal <= 1.05

  const duo: Record<string, number> = {}
  PETAL_KEYS.forEach((k) => {
    duo[k] = ((scoresA[k] ?? 0) + (scoresB[k] ?? 0)) / 2
  })

  const stable: Record<string, number> = {}
  const adjust: Record<string, number> = {}
  const desync: Record<string, number> = {}
  const fragile: Record<string, number> = {}

  const stableDiff = normalized ? 0.1 : 0.5
  const stableAvg = normalized ? 0.4 : 2
  const adjustDiff = normalized ? 0.2 : 1
  const adjustAvg = normalized ? 0.3 : 1.5
  const desyncDiff = normalized ? 0.35 : 1.5

  PETAL_KEYS.forEach((k) => {
    const a = scoresA[k] ?? 0
    const b = scoresB[k] ?? 0
    const diff = Math.abs(a - b)
    const avg = duo[k]
    if (diff <= stableDiff && avg >= stableAvg) stable[k] = avg
    else if (diff <= adjustDiff && avg >= adjustAvg) adjust[k] = avg
    else if (diff > desyncDiff) desync[k] = avg
    else fragile[k] = avg
  })

  return { duo, stable, adjust, desync, fragile }
}

export type DerivedOperationalSummary = {
  headline: string
  climate: string
  alignments: string
  gaps: string
  nextStep: string
  derived: true
}

function petalNames(keys: string[]): string {
  return keys.map((k) => PETAL_BY_ID[k]?.name ?? k).join(', ')
}

/** Synthèse opérationnelle dérivée des zones duo (parcours questionnaire sans jardin actif). */
export function deriveOperationalSummaryFromDuo(
  duo: ReturnType<typeof computeDuoAnalysis>,
  locale = 'fr'
): DerivedOperationalSummary {
  const stableKeys = Object.keys(duo.stable)
  const adjustKeys = Object.keys(duo.adjust)
  const desyncKeys = Object.keys(duo.desync)
  const fragileKeys = Object.keys(duo.fragile)
  const en = locale.startsWith('en')
  const es = locale.startsWith('es')

  const stableNames = petalNames(stableKeys)
  const adjustNames = petalNames(adjustKeys)
  const desyncNames = petalNames(desyncKeys)
  const fragileNames = petalNames(fragileKeys)

  if (en) {
    return {
      derived: true,
      headline:
        stableKeys.length >= 3
          ? 'Strong shared ground — your duo flower shows clear alignments'
          : desyncKeys.length >= 2
            ? 'Rich differences to explore — your profiles complement each other'
            : 'A balanced map of your relationship dynamics',
      climate:
        stableKeys.length > desyncKeys.length
          ? 'The overall tone is cooperative: several dimensions resonate similarly between you.'
          : desyncKeys.length > 0
            ? 'Marked gaps coexist with points of agreement — a fertile mix for dialogue.'
            : 'Moderate gaps invite curiosity rather than conflict.',
      alignments:
        stableNames
          ? `In phase together on: ${stableNames}. These are resources to lean on.`
          : 'Look for small echoes even where scores differ — they are starting points.',
      gaps:
        desyncNames
          ? `Watch with kindness: ${desyncNames}.`
          : adjustNames
            ? `To explore together: ${adjustNames}.`
            : fragileNames
              ? `Gentle attention on: ${fragileNames}.`
              : 'No major alert zones — stay curious about the nuances.',
      nextStep:
        adjustKeys[0]
          ? `This week, talk about ${PETAL_BY_ID[adjustKeys[0]]?.name ?? adjustKeys[0]}: what does it mean for each of you?`
          : desyncKeys[0]
            ? `Share what ${PETAL_BY_ID[desyncKeys[0]]?.name ?? desyncKeys[0]} represents for you — without trying to convince.`
            : 'Pick one petal where you feel closest and name one concrete gesture together.',
    }
  }

  if (es) {
    return {
      derived: true,
      headline:
        stableKeys.length >= 3
          ? 'Base sólida compartida — vuestra flor de duo muestra alineaciones claras'
          : desyncKeys.length >= 2
            ? 'Diferencias ricas por explorar — vuestros perfiles se complementan'
            : 'Un mapa equilibrado de vuestra dinámica relacional',
      climate:
        stableKeys.length > desyncKeys.length
          ? 'El tono general es cooperativo: varias dimensiones resuenan de forma similar.'
          : desyncKeys.length > 0
            ? 'Los huecos marcados coexisten con puntos de acuerdo — un terreno fértil para el diálogo.'
            : 'Los ecarts moderados invitan a la curiosidad más que al conflicto.',
      alignments: stableNames
        ? `En fase juntos en: ${stableNames}. Son recursos sobre los que apoyarse.`
        : 'Buscad pequeños ecos incluso donde los puntajes difieren.',
      gaps: desyncNames
        ? `Vigilad con benevolencia: ${desyncNames}.`
        : adjustNames
          ? `Por explorar juntos: ${adjustNames}.`
          : fragileNames
            ? `Atención suave en: ${fragileNames}.`
            : 'Sin zonas de alerta mayor — mantened la curiosidad.',
      nextStep: adjustKeys[0]
        ? `Esta semana, hablad de ${PETAL_BY_ID[adjustKeys[0]]?.name ?? adjustKeys[0]}: ¿qué significa para cada uno?`
        : 'Elegid un pétalo cercano y nombrad un gesto concreto juntos.',
    }
  }

  return {
    derived: true,
    headline:
      stableKeys.length >= 3
        ? 'Un socle commun solide — votre fleur de duo montre des alignements nets'
        : desyncKeys.length >= 2
          ? 'Des différences riches à explorer — vos profils se complètent'
          : 'Une cartographie équilibrée de votre dynamique à deux',
    climate:
      stableKeys.length > desyncKeys.length
        ? 'Le climat global est coopératif : plusieurs dimensions résonnent de façon proche entre vous.'
        : desyncKeys.length > 0
          ? 'Des écarts marqués coexistent avec des points d’accord — un terrain fertile pour le dialogue.'
          : 'Des écarts modérés invitent à la curiosité plutôt qu’au conflit.',
    alignments: stableNames
      ? `En phase ensemble sur : ${stableNames}. Ce sont des ressources sur lesquelles vous appuyer.`
      : 'Cherchez les petits échos même là où les scores diffèrent — ce sont des points de départ.',
    gaps: desyncNames
      ? `À regarder avec bienveillance : ${desyncNames}.`
      : adjustNames
        ? `À explorer ensemble : ${adjustNames}.`
        : fragileNames
          ? `Attention douce sur : ${fragileNames}.`
          : 'Pas de zone d’alerte majeure — restez curieux des nuances.',
    nextStep: adjustKeys[0]
      ? `Cette semaine, parlez de ${PETAL_BY_ID[adjustKeys[0]]?.name ?? adjustKeys[0]} : qu’est-ce que cela représente pour chacun·e ?`
      : desyncKeys[0]
        ? `Partagez ce que ${PETAL_BY_ID[desyncKeys[0]]?.name ?? desyncKeys[0]} signifie pour vous — sans chercher à convaincre.`
        : 'Choisissez un pétale où vous vous sentez proches et nommez un geste concret à deux.',
  }
}
