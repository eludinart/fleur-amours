/**
 * Corpus « Manuel du Tarot Fleur d'ÅmÔurs » pour contexte IA (serveur uniquement).
 * Fichiers : public/manuel/manifest.json + chapitres .md
 */
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import type { ManuelManifest, ManuelManifestSection } from '@/lib/manuel'
import { formatMoreChaptersLine, getManuelAiStrings } from '@/lib/manuel-ai-i18n'

function manuelAiEnabled(): boolean {
  const v = String(process.env.MANUEL_AI_CONTEXT ?? '1').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'off'
}

function maxContextChars(): number {
  const n = Number(process.env.MANUEL_AI_MAX_CHARS ?? 14_000)
  if (!Number.isFinite(n) || n < 2_000) return 14_000
  return Math.min(80_000, Math.floor(n))
}

export function getManuelPublicRoot(): string {
  return join(process.cwd(), 'public', 'manuel')
}

function parseChapterBody(raw: string): { title: string; body: string } {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/)
  let title = ''
  let i = 0
  if (lines[0]?.startsWith('# ')) {
    title = lines[0].slice(2).trim()
    i = 1
  }
  while (i < lines.length && lines[i].trim() === '') i++
  if (lines[i]?.startsWith('> ')) i += 1
  while (i < lines.length && lines[i].trim() === '') i += 1
  const body = lines.slice(i).join('\n').trim()
  return { title, body }
}

let manifestCache: { mtime: number; manifest: ManuelManifest } | null = null

function loadManifest(): ManuelManifest | null {
  if (!manuelAiEnabled()) return null
  const root = getManuelPublicRoot()
  const path = join(root, 'manifest.json')
  if (!existsSync(path)) return null
  try {
    const st = statSync(path)
    if (manifestCache && manifestCache.mtime === st.mtimeMs) return manifestCache.manifest
    const raw = readFileSync(path, 'utf8')
    const manifest = JSON.parse(raw) as ManuelManifest
    if (!manifest?.sections || !Array.isArray(manifest.sections)) return null
    manifestCache = { mtime: st.mtimeMs, manifest }
    return manifest
  } catch {
    return null
  }
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function tokenize(q: string): string[] {
  return norm(q)
    .split(/[^a-z0-9àâäéèêëïîôùûüçœæ]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3)
}

function scoreSection(words: Set<string>, sec: ManuelManifestSection, bodySample: string): number {
  if (words.size === 0) return 0
  const hay = `${norm(sec.title)} ${norm(sec.id)} ${norm(sec.file)} ${norm(bodySample)}`
  let score = 0
  for (const w of words) {
    if (!w) continue
    const inTitle = norm(sec.title).includes(w) || norm(sec.id).includes(w) || norm(sec.file).includes(w)
    if (inTitle) score += 4
    let idx = 0
    let hits = 0
    while (idx < hay.length) {
      const j = hay.indexOf(w, idx)
      if (j < 0) break
      hits++
      idx = j + w.length
      if (hits > 6) break
    }
    score += hits
  }
  return score
}

function readBodySample(root: string, file: string, maxLen: number): string {
  const full = join(root, file)
  if (!existsSync(full)) return ''
  try {
    const raw = readFileSync(full, 'utf8')
    const { body } = parseChapterBody(raw)
    return body.replace(/\s+/g, ' ').trim().slice(0, maxLen)
  } catch {
    return ''
  }
}

/**
 * Sommaire compact (titres) — utile quand il n’y a pas de requête ciblée.
 */
export function getManuelTitleIndex(maxChars = 4_000, locale?: string): string {
  const manifest = loadManifest()
  if (!manifest) return ''
  const { tocHeading } = getManuelAiStrings(locale)
  const lines: string[] = []
  let used = 0
  for (const s of manifest.sections) {
    const line = `- ${s.title} (${s.file.replace(/\.md$/i, '')})`
    if (used + line.length + 1 > maxChars) {
      const remaining = manifest.sections.length - lines.length
      lines.push(formatMoreChaptersLine(locale, remaining))
      break
    }
    lines.push(line)
    used += line.length + 1
  }
  return [tocHeading, ...lines].join('\n')
}

export type ManuelAiContextOpts = {
  /** Texte libre pour choisir les chapitres les plus pertinents (transcript, question, nom de carte…). */
  retrievalQuery?: string
  /** Plafond de caractères pour tout le bloc (sommaire + extraits). */
  maxChars?: number
  /** Locale UI (`x-locale`) : en-têtes et libellés du bloc manuel pour le modèle. */
  locale?: string
}

/**
 * Construit un bloc de texte : sommaire court + extraits de chapitres choisis par mots-clés.
 */
export function buildManuelAiContext(opts: ManuelAiContextOpts = {}): string {
  if (!manuelAiEnabled()) return ''
  const manifest = loadManifest()
  if (!manifest) return ''

  const maxTotal = Math.min(maxContextChars(), opts.maxChars ?? maxContextChars())
  const root = getManuelPublicRoot()

  const words = new Set(tokenize(opts.retrievalQuery ?? ''))

  const quickRanked = [...manifest.sections]
    .map((sec) => ({ sec, score: scoreSection(words, sec, '') }))
    .sort((a, b) => b.score - a.score)

  const samples = new Map<string, string>()
  if (words.size > 0) {
    const maxQ = quickRanked[0]?.score ?? 0
    const slice = maxQ > 0 ? quickRanked.slice(0, 36) : quickRanked.slice(0, 48)
    for (const { sec } of slice) {
      samples.set(sec.file, readBodySample(root, sec.file, 900))
    }
  }

  const ranked =
    words.size > 0
      ? [...manifest.sections]
          .map((sec) => ({
            sec,
            score: scoreSection(words, sec, samples.get(sec.file) ?? ''),
          }))
          .sort((a, b) => b.score - a.score)
      : quickRanked

  const sommaireBudget = Math.min(3_500, Math.floor(maxTotal * 0.28))
  const aiStrings = getManuelAiStrings(opts.locale)
  let sommaire = getManuelTitleIndex(sommaireBudget, opts.locale)
  let out = sommaire + '\n\n'

  const budgetForExcerpts = maxTotal - out.length - 120
  let used = 0
  const minScore = words.size > 0 ? 1 : 0
  let pool: typeof ranked
  if (words.size > 0) {
    pool = ranked.filter((r) => r.score >= minScore)
  } else {
    const n = ranked.length
    if (n === 0) pool = []
    else {
      const picks = [
        0,
        Math.floor(n / 4),
        Math.floor(n / 2),
        Math.min(n - 1, Math.floor((3 * n) / 4)),
      ]
      const uniq = [...new Set(picks)].sort((a, b) => a - b)
      pool = uniq.map((i) => ranked[i]).filter(Boolean) as typeof ranked
    }
  }

  const perCap = words.size > 0 ? 2_800 : 900
  const maxChapters = words.size > 0 ? 7 : 4

  let n = 0
  for (const { sec, score } of pool) {
    if (n >= maxChapters) break
    if (words.size > 0 && score < 1) break
    const full = join(root, sec.file)
    if (!existsSync(full)) continue
    let excerpt = ''
    try {
      const raw = readFileSync(full, 'utf8')
      const { title, body } = parseChapterBody(raw)
      excerpt = `## ${title || sec.title}\n${body.replace(/\s+/g, ' ').trim()}`
    } catch {
      continue
    }
    excerpt = excerpt.slice(0, perCap) + (excerpt.length > perCap ? '…' : '')
    const block = excerpt + '\n\n'
    if (used + block.length > budgetForExcerpts) break
    out += block
    used += block.length
    n++
  }

  if (words.size === 0 && n === 0) {
    out += aiStrings.excerptsMissing
  }

  return out.trim()
}

/**
 * Ajoute le corpus manuel au prompt système (si activé).
 */
export function appendManuelReferenceToSystem(system: string, opts: ManuelAiContextOpts = {}): string {
  if (!manuelAiEnabled()) return system
  const block = buildManuelAiContext(opts)
  if (!block) return system
  const header = getManuelAiStrings(opts.locale).refHeader
  return system + header + block
}
