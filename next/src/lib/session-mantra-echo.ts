/**
 * Repère les « premiers mots » de session qui ne sont en fait qu’un écho
 * du placeholder (seuil / porte) — à ne pas afficher comme citation personnelle.
 */
export function normalizeMantraForEchoCheck(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[«»""'`,.;:?!…—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isSessionMantraEcho(text: string | null | undefined): boolean {
  if (text == null) return false
  const raw = String(text).trim()
  if (raw.length < 4) return true

  const n = normalizeMantraForEchoCheck(raw)

  if (n.includes('le plus vivant pour vous') || n.includes('le plus vivant pour toi')) return true
  if (n.includes('quest ce qui est le plus vivant')) return true

  if (n === 'une question' || n === 'une tension' || n === 'un desir') return true

  const shortEcho =
    /\bune tension\b/.test(n) &&
    /\bun desir\b|\bune desir\b/.test(n) &&
    n.length <= 48

  if (shortEcho) return true

  return false
}
