import { PETAL_DEFS } from '@/lib/petal-theme'

const PETAL_ORDER = PETAL_DEFS.map((p) => p.id)

const ECHO_BY_PETAL: Record<string, string> = {
  agape: "Une présence tournée vers l'accueil, le don et la bienveillance.",
  philautia: "Un jardin qui cultive d'abord l'écoute de soi et la juste mesure.",
  mania: "Une intensité passionnelle, parfois exigeante, qui cherche à se poser.",
  storge: "Un ancrage dans la tendresse familière, la fidélité et le lien durable.",
  pragma: "Une façon d'aimer réfléchie, concrète, tournée vers ce qui dure.",
  philia: "Une amitié vivante, l'alliance et le lien fraternel au cœur du jardin.",
  ludus: "Une touche de jeu, de légèreté et d'exploration dans la rencontre.",
  eros: "Une vibration désirante, créatrice, qui appelle la présence au corps et au mystère.",
}

export type LisiereTopPetal = { id: string; name: string; value: number; color: string }

export function buildLisierePublicProfile(
  scores: Record<string, number>,
  bio: string | null | undefined,
): {
  dominantPetal: string
  dominantPetalName: string
  topPetals: LisiereTopPetal[]
  echoInflorescence: string
} {
  const topPetals = PETAL_DEFS
    .map((p) => ({ id: p.id, name: p.name, value: Number(scores[p.id] ?? 0), color: p.color }))
    .filter((p) => p.value > 0.05)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)

  const dominant = topPetals[0] ?? { id: PETAL_ORDER[0], name: PETAL_DEFS[0].name }
  const bioExcerpt = String(bio ?? '').trim().slice(0, 280)
  const parts: string[] = []

  if (bioExcerpt) {
    parts.push(bioExcerpt)
  } else {
    parts.push(ECHO_BY_PETAL[dominant.id] ?? "Un jardinier du Grand Jardin, en train de faire éclore sa fleur.")
  }

  if (topPetals.length >= 2) {
    const names = topPetals.map((p) => p.name).join(', ')
    parts.push(`Tonalités marquantes : ${names}.`)
  }

  return {
    dominantPetal: dominant.id,
    dominantPetalName: dominant.name,
    topPetals,
    echoInflorescence: parts.join(' '),
  }
}
