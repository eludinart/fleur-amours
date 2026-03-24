/**
 * Traduit les IDs techniques des leviers en formulations humaines lisibles.
 */

export const LEVER_LABELS_FR: Record<string, string> = {
  bridge_feedback: "Introduire de petits moments partagés pour créer un lien",
  time_delay_intervention: "Rythmer ses interventions pour éviter l'oscillation émotionnelle",
  climate_modulation: "Moduler le contexte pour permettre un cadrage bienveillant",
  exploration_guidée: "Explorer avec guidance, un pas à la fois",
  micro_expériences: "Tester des micro-expériences concrètes",
  pragma_clarification: "Clarifier les attentes et les accords mutuels",
  storge_repair: "Réparer le lien d'attachement par de petits gestes",
  contracting: "Définir ensemble des accords clairs",
  cooling_protocol: "Introduire des pauses pour laisser refroidir les tensions",
  containment: "Créer un cadre contenant pour les émotions",
  stop_protocol: "Arrêter et sécuriser avant d'avancer",
  external_support: "S'appuyer sur un soutien extérieur",
  risk_management: "Identifier et gérer les risques avec soin",
}

/**
 * Affiche une action de levier de façon compréhensible.
 */
export function humanizeLever(action: string | null | undefined): string {
  if (!action || typeof action !== 'string') return action ?? ''
  const trimmed = action.trim()
  const label = LEVER_LABELS_FR[trimmed]
  if (label) return label
  const idMatch = trimmed.match(/^([a-z_àéè]+)($|\s|—)/)
  if (idMatch && LEVER_LABELS_FR[idMatch[1]]) return LEVER_LABELS_FR[idMatch[1]]
  return trimmed
}

export interface ParsedLever {
  action: string
  anchor: string | null
}

/**
 * Formate un levier complet "action — à ancrer après : habitude" pour affichage.
 */
export function parseLever(lever: string | null | undefined): ParsedLever {
  if (!lever || typeof lever !== 'string') return { action: lever ?? '', anchor: null }
  const sep = ' — à ancrer après : '
  const idx = lever.indexOf(sep)
  if (idx === -1) return { action: humanizeLever(lever), anchor: null }
  const actionRaw = lever.slice(0, idx).trim()
  const anchor = lever.slice(idx + sep.length).trim().replace(/\.$/, '')
  return { action: humanizeLever(actionRaw), anchor: anchor || null }
}
