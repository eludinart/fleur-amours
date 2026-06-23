/**
 * Prompts pour le module Tirage papier (autonome).
 */
import type { PaperDrawLayoutId } from './paper-draw-layouts'
import { getPaperDrawLayout } from './paper-draw-layouts'
import { getLangInstruction } from './prompts'
import { ALL_CARDS } from '@/data/tarotCards'

export function buildRecognizeSystem(cardNames: string[]): string {
  return (
    "Tu identifies les cartes du Tarot Fleur d'AmOurs sur une photo de tirage physique. " +
    'Réponds UNIQUEMENT en JSON : {"cards":[{"name":"Nom exact","confidence":0.0-1.0}]}. ' +
    'Utilise uniquement ces noms (65 cartes) : ' +
    cardNames.join(', ') +
    '. ' +
    'Si une carte apparaît plusieurs fois, liste chaque occurrence. ' +
    'Si incertain, omets la carte ou baisse la confidence. Pas de texte hors JSON.'
  )
}

export function buildRecognizeUserPrompt(layoutId: PaperDrawLayoutId): string {
  const layout = getPaperDrawLayout(layoutId)
  const slots =
    layout?.slots.map((s) => s.label).join(', ') ||
    'disposition libre'
  return (
    `Format de tirage choisi par l'utilisateur : ${layoutId}. ` +
    `Grille indicative (souple) : ${slots}. ` +
    'Identifie toutes les cartes visibles face visible sur la photo.'
  )
}

function cardsContextBlock(
  cards: Array<{ name: string; slot?: string; role?: string; duplicate?: boolean }>
): string {
  return cards
    .map((c, i) => {
      const parts = [`${i + 1}. ${c.name}`]
      if (c.slot) parts.push(`emplacement: ${c.slot}`)
      if (c.role === 'extra' || c.role === 'satellite') parts.push('(carte autour / extra)')
      if (c.duplicate) parts.push('(doublon sur le même emplacement)')
      const meta = ALL_CARDS.find((x) => x.name === c.name)
      if (meta?.synth) parts.push(`synthèse: ${meta.synth.slice(0, 200)}`)
      if (meta?.desc) parts.push(`description: ${meta.desc.split('\n')[0].slice(0, 200)}`)
      return parts.join(' — ')
    })
    .join('\n')
}

export function layoutReadingHint(layoutId: PaperDrawLayoutId): string {
  switch (layoutId) {
    case 'one':
      return 'Tirage d\'une carte : éclairage de la Situation actuelle.'
    case 'two':
      return 'Tirage de deux cartes : Situation puis Ressource disponible.'
    case 'three':
      return 'Tirage de trois cartes : Situation, Ressource, Évolution.'
    case 'four_doors':
      return 'Tirage des 4 Portes : Cœur (amour), Temps (végétal), Climat (éléments), Histoire (vie). Les cartes extras sont un contexte latéral.'
    case 'flower_8':
      return 'Fleur d\'AmOurs à 8 pétales : Agapè, Philautia, Mania, Storgè, Pragma, Philia, Ludus, Éros (depuis le haut, sens horaire). Doublons = intensification du thème. Extras = cartes autour de la fleur.'
    default:
      return 'Tirage libre : lecture de l\'ensemble des cartes présentes, sans grille rigide.'
  }
}

export function buildInterpretSystem(locale: string): string {
  return (
    "Tu es un accompagnant symbolique du Tarot Fleur d'AmOurs pour un tirage PHYSIQUE (jeu de cartes papier). " +
    'Pas de divination ni prédiction. Ton chaleureux, concret, jamais clinique. ' +
    'Relie les cartes à l\'intention et au contexte. Mentionne les doublons et cartes extras si présents. ' +
    'Réponds en texte simple (pas de JSON, pas de markdown), 3 paragraphes max, 1400 caractères max.' +
    getLangInstruction(locale)
  )
}

export function buildInterpretUser(params: {
  layoutId: PaperDrawLayoutId
  intention: string
  context: string
  cards: Array<{ name: string; slot?: string; role?: string; duplicate?: boolean }>
}): string {
  const blocks = [
    layoutReadingHint(params.layoutId),
    params.intention ? `Intention : ${params.intention}` : '',
    params.context ? `Contexte / raison du tirage : ${params.context}` : '',
    'Cartes sur le tapis :\n' + cardsContextBlock(params.cards),
  ].filter(Boolean)
  return blocks.join('\n\n')
}

export function buildDialogueSystem(locale: string): string {
  return (
    "Tu accompagnes un tirage PHYSIQUE du Tarot Fleur d'AmOurs. " +
    'Réponds UNIQUEMENT en JSON : {"response_a":"accueil court (1-2 phrases)","question":"une seule question ouverte liée à l\'intention et aux cartes"}. ' +
    'Pas de diagnostic. Question maïeutique, ancrée dans le vécu.' +
    getLangInstruction(locale)
  )
}

export function buildDialogueUser(params: {
  layoutId: PaperDrawLayoutId
  intention: string
  context: string
  cards: Array<{ name: string; slot?: string; role?: string }>
  history: Array<{ role?: string; content?: string }>
  transcript: string
}): string {
  const tail = params.history
    .slice(-6)
    .map((m) => `${m.role ?? 'user'}: ${String(m.content ?? '').slice(0, 400)}`)
    .join('\n')
  return [
    layoutReadingHint(params.layoutId),
    params.intention ? `Intention : ${params.intention}` : '',
    params.context ? `Contexte : ${params.context}` : '',
    'Cartes :\n' + cardsContextBlock(params.cards),
    tail ? `Échanges précédents :\n${tail}` : '',
    `Dernier message utilisateur : ${params.transcript}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
