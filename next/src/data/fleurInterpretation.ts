/**
 * Explications pour l'interprétation de la Fleur d'AmOurs.
 * Chaque pétale correspond à une dimension de l'amour (modèle des 8 amours grecs).
 */

import enCards from './tarotCards.en.json'
import esCards from './tarotCards.es.json'
import itCards from './tarotCards.it.json'
import deCards from './tarotCards.de.json'

type FleurInterpretationData = {
  intro?: string
  howToReadTitle?: string
  howToReadPoints?: string[]
  conseil?: string
  petals?: Record<string, { label: string; subtitle: string; description: string }>
}

type LocaleData = { fleurInterpretation?: FleurInterpretationData }

export function getFleurInterpretationLocale(locale: string | null) {
  const data: LocaleData | null =
    locale === 'en' ? enCards :
    locale === 'es' ? esCards :
    locale === 'it' ? itCards :
    locale === 'de' ? deCards :
    null
  const fi = data?.fleurInterpretation
  if (!fi) return null
  return {
    intro: fi.intro,
    howToRead: { title: fi.howToReadTitle, points: fi.howToReadPoints ?? [] },
    conseil: fi.conseil,
    petalInterpretations: fi.petals ?? PETAL_INTERPRETATIONS,
  }
}

export const FLEUR_INTRO = `Votre Fleur d'AmOurs représente la façon dont vous vivez et exprimez l'amour à travers huit dimensions. 
Plus un pétale est long, plus cette dimension est présente dans votre manière d'aimer. 
La forme globale de la fleur reflète votre profil relationnel actuel — aucune configuration n'est « meilleure » qu'une autre : chacune a ses forces et ses points d'attention.`

export const FLEUR_COMMENT_LIRE = {
  title: 'Comment lire votre fleur',
  points: [
    "Chaque pétale correspond à une dimension de l'amour selon le modèle des 8 amours grecs.",
    "La longueur du pétale indique l'importance de cette dimension dans votre façon d'aimer : plus il est long, plus cette facette est développée.",
    "La forme globale (symétrique, déséquilibrée, ronde…) reflète votre style relationnel : pas de bonne ou mauvaise forme.",
    "Les scores (0 à 5) vous permettent de comparer les dimensions entre elles et d'identifier vos points forts et axes de développement.",
  ],
}

export const PETAL_INTERPRETATIONS: Record<string, { label: string; subtitle: string; description: string }> = {
  agape: {
    label: 'Agapè',
    subtitle: 'Amour inconditionnel',
    description:
      "L'amour qui donne sans attendre en retour : bienveillance, compassion, don de soi. Une dimension forte traduit une capacité à aimer au-delà de l'ego ; une dimension plus légère peut inviter à recevoir davantage.",
  },
  philautia: {
    label: 'Philautia',
    subtitle: 'Amour de soi',
    description:
      "L'estime de soi, l'écoute de ses besoins, la bienveillance envers soi-même. Fondement de l'équilibre relationnel : s'aimer permet d'aimer l'autre sans fusion ni dépendance.",
  },
  mania: {
    label: 'Mania',
    subtitle: 'Amour passionnel',
    description:
      "L'intensité émotionnelle, la passion, parfois la jalousie ou l'attachement anxieux. Une dimension présente peut nourrir la vie du couple ; en excès, elle peut générer des tensions.",
  },
  storge: {
    label: 'Storgè',
    subtitle: 'Amour familier',
    description:
      "L'attachement, la fidélité, le sentiment de « chez soi » avec l'autre. Dimension de la sécurité affective, du lien qui se construit dans la durée et la confiance.",
  },
  pragma: {
    label: 'Pragma',
    subtitle: 'Amour pragmatique',
    description:
      'La compatibilité, les compromis, le choix conscient de construire ensemble. Une dimension présente reflète une approche réfléchie de la relation et du partenariat.',
  },
  philia: {
    label: 'Philia',
    subtitle: 'Amitié amoureuse',
    description:
      "L'affection, la complicité, le lien fraternel ou amical au sein du couple. Dimension de la tendresse, du partage et du « être ensemble » au quotidien.",
  },
  ludus: {
    label: 'Ludus',
    subtitle: 'Amour ludique',
    description:
      'La légèreté, le jeu, la séduction, le plaisir de la connivence. Une dimension présente apporte fraîcheur et dynamisme ; elle peut inviter à ne pas tout prendre au sérieux.',
  },
  eros: {
    label: 'Éros',
    subtitle: 'Désir et attirance',
    description:
      "L'attirance physique, le désir, la sensualité, la dimension romantique. Dimension centrale de l'intimité ; elle coexiste et dialogue avec les autres pétales de la fleur.",
  },
}

export const FLEUR_CONSEIL = `Votre fleur est un instantané — elle peut évoluer avec le temps et selon les relations. 
Utilisez-la comme point de départ pour vous questionner, en couple ou en solo, sur ce qui vous nourrit et ce que vous souhaitez cultiver.`
