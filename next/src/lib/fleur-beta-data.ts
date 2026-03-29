/**
 * Ma Fleur 2-Beta — banque de questions, ordre par Porte, calcul des scores 0–1 (8 pétales).
 * Portes : mêmes clés que FOUR_DOORS (tarotCards).
 */
export const FLEUR_BETA_DOOR_KEYS = ['love', 'vegetal', 'elements', 'life'] as const
export type FleurBetaDoorKey = (typeof FLEUR_BETA_DOOR_KEYS)[number]

export const FLEUR_BETA_PETAL_KEYS = [
  'agape',
  'philautia',
  'mania',
  'storge',
  'pragma',
  'philia',
  'ludus',
  'eros',
] as const
export type FleurBetaPetalKey = (typeof FLEUR_BETA_PETAL_KEYS)[number]

export const FLEUR_BETA_CHOICE_VALUES = [0, 0.33, 0.66, 1] as const

export type FleurBetaPetalWeight = { id: FleurBetaPetalKey; weight: number }

export type FleurBetaQuestionDef = {
  id: string
  porte: FleurBetaDoorKey
  text: string
  petals: FleurBetaPetalWeight[]
}

/** 12 questions fixes (3 par Porte), langage archétypal FR — à internationaliser côté API si besoin. */
export const FLEUR_BETA_QUESTION_BANK: FleurBetaQuestionDef[] = [
  {
    id: 'b1',
    porte: 'love',
    text: 'Quelle part de votre feu osez-vous montrer aujourd’hui ?',
    petals: [{ id: 'eros', weight: 1 }],
  },
  {
    id: 'b2',
    porte: 'love',
    text: 'À quel point votre sentiment de sécurité affective est-il nourri par le lien à l’autre (plutôt que par l’écart ou la distance) ?',
    petals: [{ id: 'storge', weight: 1 }],
  },
  {
    id: 'b3',
    porte: 'love',
    text: 'À quel point votre parole est-elle alignée avec votre action ?',
    petals: [{ id: 'philautia', weight: 1 }],
  },
  {
    id: 'b4',
    porte: 'vegetal',
    text: 'Dans quelle mesure vous sentez-vous aujourd’hui en phase de passage à l’acte visible (« bouture »), plutôt qu’en maturation intérieure ou attente (« graine ») ?',
    petals: [{ id: 'ludus', weight: 1 }],
  },
  {
    id: 'b5',
    porte: 'vegetal',
    text: 'Le fruit que vous portez est-il mûr pour être partagé ?',
    petals: [{ id: 'agape', weight: 1 }],
  },
  {
    id: 'b6',
    porte: 'elements',
    text: 'Dans quelle mesure le climat autour de vous vous porte, vous ouvre et vous vitalise (plutôt qu’il ne vous assaille ou ne vous épuise) ?',
    petals: [{ id: 'mania', weight: 1 }],
  },
  {
    id: 'b7',
    porte: 'elements',
    text: 'Y a-t-il assez de terre (cadre) pour soutenir votre élan ?',
    petals: [{ id: 'pragma', weight: 1 }],
  },
  {
    id: 'b8',
    porte: 'elements',
    text: 'L’eau du lien circule-t-elle librement entre vous ?',
    petals: [{ id: 'philia', weight: 1 }],
  },
  {
    id: 'b9',
    porte: 'life',
    text: 'Dans quelle mesure vous sentez-vous capable d’avancer sur un terrain neuf — qui vous ressemble aujourd’hui — plutôt que de porter encore tout le poids d’un ancien jardin (héritages, blessures, histoires répétées) ?',
    petals: [{ id: 'philautia', weight: 1 }],
  },
  {
    id: 'b10',
    porte: 'life',
    text: 'Quelle est la prochaine métamorphose que vous sentez venir ?',
    petals: [{ id: 'eros', weight: 1 }],
  },
  {
    id: 'b11',
    porte: 'vegetal',
    text: 'À quel point les cadres actuels de votre lien (engagements, règles, habitudes) laissent-ils une vraie place au jeu et à l’imprévu ?',
    petals: [
      { id: 'pragma', weight: 0.5 },
      { id: 'ludus', weight: 0.5 },
    ],
  },
  {
    id: 'b12',
    porte: 'life',
    text: 'À quel point l’intensité vécue dans le lien fragilise-t-elle pour vous le sentiment de sécurité ou d’ancrage ?',
    petals: [
      { id: 'mania', weight: 0.5 },
      { id: 'storge', weight: 0.5 },
    ],
  },
]

export function isFleurBetaDoorKey(s: string | null | undefined): s is FleurBetaDoorKey {
  return !!s && (FLEUR_BETA_DOOR_KEYS as readonly string[]).includes(s)
}

/** Place les 3 questions de la porte choisie en tête, puis les autres blocs dans l’ordre des portes. */
export function orderQuestionsForPorte(porte: FleurBetaDoorKey): FleurBetaQuestionDef[] {
  const byPorte: Record<FleurBetaDoorKey, FleurBetaQuestionDef[]> = {
    love: [],
    vegetal: [],
    elements: [],
    life: [],
  }
  for (const q of FLEUR_BETA_QUESTION_BANK) {
    byPorte[q.porte].push(q)
  }
  const order: FleurBetaDoorKey[] = [porte, ...FLEUR_BETA_DOOR_KEYS.filter((p) => p !== porte)]
  return order.flatMap((p) => byPorte[p])
}

function emptyAccum(): Record<FleurBetaPetalKey, number> {
  return Object.fromEntries(FLEUR_BETA_PETAL_KEYS.map((k) => [k, 0])) as Record<FleurBetaPetalKey, number>
}

export function computePetalMaxPossible(questions: FleurBetaQuestionDef[]): Record<FleurBetaPetalKey, number> {
  const max = emptyAccum()
  const maxVal = 1
  for (const q of questions) {
    for (const { id, weight } of q.petals) {
      max[id] += maxVal * weight
    }
  }
  return max
}

export type FleurBetaAnswerInput = { questionId: string; value: number }

/**
 * Agrège les réponses (valeurs 0 / 0,33 / 0,66 / 1) et normalise chaque pétale sur [0,1]
 * par rapport au maximum théorique atteignable sur ce questionnaire.
 */
export function calculateBetaScore(
  orderedQuestions: FleurBetaQuestionDef[],
  answers: FleurBetaAnswerInput[]
): Record<FleurBetaPetalKey, number> {
  const byId = new Map(orderedQuestions.map((q) => [q.id, q]))
  const maxPossible = computePetalMaxPossible(orderedQuestions)
  const accum = emptyAccum()

  for (const a of answers) {
    const q = byId.get(a.questionId)
    if (!q) continue
    const v = Math.min(1, Math.max(0, Number(a.value)))
    for (const { id, weight } of q.petals) {
      accum[id] += v * weight
    }
  }

  const out = emptyAccum()
  for (const p of FLEUR_BETA_PETAL_KEYS) {
    const m = maxPossible[p]
    out[p] = m > 0 ? Math.min(1, Math.max(0, accum[p] / m)) : 0
  }
  return out
}
