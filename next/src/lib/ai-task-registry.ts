/**
 * Registre des tâches IA — tier, mode de sortie, coût SAP, politique d'accès.
 * Le tier est imposé côté serveur ; le client ne peut pas l'escalader.
 */
import type { AiDomain, AiOutputMode, AiTier } from './ai-tiers'
import { TUTEUR_SAP_COST } from './db-sap'

export type AiTaskId =
  | 'threshold'
  | 'door-intro'
  | 'card-context'
  | 'card-question'
  | 'flower-state-haiku'
  | 'help-chat'
  | 'analyze-mood'
  | 'tarot-interpretation'
  | 'landing-reading'
  | 'extract-door-summary'
  | 'translate-questions'
  | 'tuteur'
  | 'plan14j'
  | 'fleur-interpretation'
  | 'zen-brief'
  | 'science-rebuild'
  | 'dyad-summary'
  | 'mycelium-synthesis'
  | 'mycelium-interview'
  | 'coach-fiche'
  | 'coach-patient-fiche'
  | 'dreamscape-summarize'
  | 'timeline-narrative'
  | 'relational-mediation'
  | 'fleur-beta-interpretation'
  | 'paper-draw-recognize'
  | 'paper-draw-interpret'
  | 'paper-draw-dialogue'
  | 'checkin-echo'
  | 'admin-test'

export type AiTaskDef = {
  id: AiTaskId
  tier: AiTier
  outputMode: AiOutputMode
  domain: AiDomain
  /** Génération autorisée en freemium (tier léger). */
  freeTierAllowed: boolean
  /** Réservé admin (coach, test). */
  adminOnly?: boolean
  /** Coût SAP si génération premium sans accès promo illimité. */
  sapCost: number
  /** Lecture cache autorisée même si génération bloquée. */
  cacheReadable: boolean
  /** Limite horaire (requêtes / heure / utilisateur). 0 = pas de limite dédiée. */
  hourlyLimit: number
  /** Quota mensuel freemium (tâches légères). 0 = illimité dans le tier gratuit. */
  monthlyFreeQuota: number
}

const LIGHT_DEFAULTS = {
  freeTierAllowed: true,
  cacheReadable: true,
  hourlyLimit: 30,
  monthlyFreeQuota: 40,
} as const

const PREMIUM_DEFAULTS = {
  freeTierAllowed: false,
  cacheReadable: true,
  hourlyLimit: 0,
  monthlyFreeQuota: 0,
} as const

export const AI_TASK_REGISTRY: Record<AiTaskId, AiTaskDef> = {
  threshold: {
    id: 'threshold',
    tier: 'light',
    outputMode: 'json',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
  },
  'door-intro': {
    id: 'door-intro',
    tier: 'light',
    outputMode: 'markdown',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
  },
  'card-context': {
    id: 'card-context',
    tier: 'light',
    outputMode: 'json',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
  },
  'card-question': {
    id: 'card-question',
    tier: 'light',
    outputMode: 'json',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
  },
  'flower-state-haiku': {
    id: 'flower-state-haiku',
    tier: 'light',
    outputMode: 'json',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
  },
  'help-chat': {
    id: 'help-chat',
    tier: 'light',
    outputMode: 'raw',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
  },
  'analyze-mood': {
    id: 'analyze-mood',
    tier: 'light',
    outputMode: 'json',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
  },
  'tarot-interpretation': {
    id: 'tarot-interpretation',
    tier: 'light',
    outputMode: 'markdown',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
  },
  'landing-reading': {
    id: 'landing-reading',
    tier: 'standard',
    outputMode: 'json',
    domain: 'fleur',
    freeTierAllowed: true,
    cacheReadable: true,
    hourlyLimit: 0,
    monthlyFreeQuota: 0,
    sapCost: 0,
  },
  'extract-door-summary': {
    id: 'extract-door-summary',
    tier: 'light',
    outputMode: 'json',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
  },
  'translate-questions': {
    id: 'translate-questions',
    tier: 'light',
    outputMode: 'json',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
  },
  tuteur: {
    id: 'tuteur',
    tier: 'premium',
    outputMode: 'json',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    sapCost: TUTEUR_SAP_COST,
    hourlyLimit: 60,
  },
  plan14j: {
    id: 'plan14j',
    tier: 'premium',
    outputMode: 'json',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    sapCost: 10,
  },
  'fleur-interpretation': {
    id: 'fleur-interpretation',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    sapCost: 8,
  },
  'zen-brief': {
    id: 'zen-brief',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    sapCost: 5,
  },
  'science-rebuild': {
    id: 'science-rebuild',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    adminOnly: true,
    sapCost: 0,
  },
  'dyad-summary': {
    id: 'dyad-summary',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    sapCost: 6,
  },
  'mycelium-synthesis': {
    id: 'mycelium-synthesis',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'mycelium',
    ...PREMIUM_DEFAULTS,
    sapCost: 10,
    freeTierAllowed: true, // RH org — pas de SAP utilisateur final
  },
  'mycelium-interview': {
    id: 'mycelium-interview',
    tier: 'light',
    outputMode: 'json',
    domain: 'mycelium',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
    freeTierAllowed: true,
  },
  'coach-fiche': {
    id: 'coach-fiche',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    adminOnly: true,
    sapCost: 0,
  },
  'coach-patient-fiche': {
    id: 'coach-patient-fiche',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    adminOnly: true,
    sapCost: 0,
  },
  'dreamscape-summarize': {
    id: 'dreamscape-summarize',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    sapCost: 5,
  },
  'timeline-narrative': {
    id: 'timeline-narrative',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    sapCost: 5,
  },
  'relational-mediation': {
    id: 'relational-mediation',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    sapCost: 8,
  },
  'fleur-beta-interpretation': {
    id: 'fleur-beta-interpretation',
    tier: 'premium',
    outputMode: 'markdown',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    sapCost: 8,
  },
  'paper-draw-recognize': {
    id: 'paper-draw-recognize',
    tier: 'premium',
    outputMode: 'json',
    domain: 'fleur',
    ...PREMIUM_DEFAULTS,
    sapCost: 3,
    hourlyLimit: 20,
  },
  'paper-draw-interpret': {
    id: 'paper-draw-interpret',
    tier: 'standard',
    outputMode: 'markdown',
    domain: 'fleur',
    freeTierAllowed: true,
    cacheReadable: true,
    sapCost: 0,
    hourlyLimit: 30,
    monthlyFreeQuota: 40,
  },
  'paper-draw-dialogue': {
    id: 'paper-draw-dialogue',
    tier: 'standard',
    outputMode: 'json',
    domain: 'fleur',
    freeTierAllowed: true,
    cacheReadable: true,
    sapCost: 2,
    hourlyLimit: 40,
    monthlyFreeQuota: 60,
  },
  'checkin-echo': {
    id: 'checkin-echo',
    tier: 'light',
    outputMode: 'json',
    domain: 'fleur',
    ...LIGHT_DEFAULTS,
    sapCost: 0,
    hourlyLimit: 20,
    monthlyFreeQuota: 60,
  },
  'admin-test': {
    id: 'admin-test',
    tier: 'light',
    outputMode: 'json',
    domain: 'none',
    freeTierAllowed: true,
    adminOnly: true,
    cacheReadable: true,
    sapCost: 0,
    hourlyLimit: 0,
    monthlyFreeQuota: 0,
  },
}

export function getAiTask(taskId: AiTaskId): AiTaskDef {
  return AI_TASK_REGISTRY[taskId]
}

export function isAiTaskId(v: string): v is AiTaskId {
  return v in AI_TASK_REGISTRY
}
