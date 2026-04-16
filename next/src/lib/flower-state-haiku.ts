/**
 * Mini-haïku (3 vers) pour l’état affiché sous la fleur (vue zen).
 */
import { openrouterCall } from './openrouter'
import { getLangInstruction } from './prompts'

const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function normalizeFlowerHaikuLocale(locale: string): string {
  const l = String(locale ?? 'fr').toLowerCase().split('-')[0]
  if (l === 'en' || l === 'es' || l === 'de' || l === 'it' || l === 'fr') return l
  return 'fr'
}

function petalSnapshot(petals: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of PETAL_IDS) {
    out[id] = clamp01(Number(petals[id] ?? 0))
  }
  return out
}

function topThreeLines(petals: Record<string, number>, locale: string): string {
  const ranked = [...PETAL_IDS].sort((a, b) => petals[b] - petals[a])
  const labels = petalLabelsForPrompt(locale)
  return ranked
    .slice(0, 3)
    .map((id) => `${id}:${petals[id].toFixed(2)} (${labels[id] ?? id})`)
    .join('\n')
}

function petalLabelsForPrompt(locale: string): Record<string, string> {
  const fr: Record<string, string> = {
    agape: 'Agapè — don vers l’autre',
    philautia: 'Philautia — soi',
    mania: 'Mania — possession',
    storge: 'Storgè — attachement familier',
    pragma: 'Pragma — choix durable',
    philia: 'Philia — amitié',
    ludus: 'Ludus — jeu',
    eros: 'Éros — désir',
  }
  const en: Record<string, string> = {
    agape: 'Agape (giving love)',
    philautia: 'Philautia (self)',
    mania: 'Mania (attachment)',
    storge: 'Storge (familiar bond)',
    pragma: 'Pragma (practical love)',
    philia: 'Philia (friendship)',
    ludus: 'Ludus (play)',
    eros: 'Eros (desire)',
  }
  const es: Record<string, string> = {
    agape: 'Ágape — don hacia el otro',
    philautia: 'Filautia — uno mismo',
    mania: 'Manía',
    storge: 'Storgè — vínculo familiar',
    pragma: 'Pragma — amor elegido',
    philia: 'Filía — amistad',
    ludus: 'Ludus — juego',
    eros: 'Eros — deseo',
  }
  const de: Record<string, string> = {
    agape: 'Agape — Hingabe',
    philautia: 'Philautia — Selbst',
    mania: 'Mania',
    storge: 'Storge — Vertrautheit',
    pragma: 'Pragma — gewählte Liebe',
    philia: 'Philia — Freundschaft',
    ludus: 'Ludus — Spiel',
    eros: 'Eros — Begehren',
  }
  const it: Record<string, string> = {
    agape: 'Agape — dono verso l’altro',
    philautia: 'Philautia — sé',
    mania: 'Mania',
    storge: 'Storge — legame familiare',
    pragma: 'Pragma — amore scelto',
    philia: 'Philia — amicizia',
    ludus: 'Ludus — gioco',
    eros: 'Eros — desiderio',
  }
  const map: Record<string, Record<string, string>> = { fr, en, es, de, it }
  return map[locale] ?? fr
}

export type FlowerHaikuContext = {
  mode: 'blend' | 'snapshot'
  petals: Record<string, number>
  locale: string
  /** Référence stable pour cache (id timeline ou "blend"). */
  cacheKey: string
  /** Instantané : méta utile au modèle. */
  snapshotMeta?: {
    dateIso?: string
    type?: string
    label?: string
  }
}

/**
 * Génère un texte en 3 vers (sauts de ligne). Retourne null si pas de clé API ou échec.
 */
export async function generateFlowerStateHaiku(ctx: FlowerHaikuContext): Promise<string | null> {
  const locale = normalizeFlowerHaikuLocale(ctx.locale)
  const snap = petalSnapshot(ctx.petals)
  const top = topThreeLines(snap, locale)

  const blendIntro =
    locale === 'en'
      ? 'This is the CURRENT BLEND on the flower: a synthesis of the user’s recent sessions, questionnaires and dream walks — not a single past moment.'
      : locale === 'es'
        ? 'Es la SÍNTESIS ACTUAL en la flor: mezcla de pasos recientes (sesiones, cuestionarios, paseos oníricos), no un solo momento pasado.'
        : locale === 'de'
          ? 'Das ist die AKTUELLE MISCHUNG auf der Blüte: Synthese aus jüngeren Sessions, Fragebögen und Traumspaziergängen — kein einzelner vergangener Moment.'
          : locale === 'it'
            ? 'È la SINTESI ATTUALE sul fiore: fusione di passaggi recenti (sessioni, questionari, passeggiate oniriche), non un solo istante passato.'
            : 'Il s’agit de la SYNTHÈSE ACTUELLE sur la rose : mélange de tes passages récents (sessions, questionnaires, promenades oniriques) — pas un seul moment passé.'

  const snapIntro =
    locale === 'en'
      ? 'This state is ONE frozen moment from the user’s history (session, questionnaire or dream walk).'
      : locale === 'es'
        ? 'Este estado es UN momento fijado del historial (sesión, cuestionario o paseo onírico).'
        : locale === 'de'
          ? 'Dieser Zustand ist EIN eingefrorener Moment aus der Historie (Sitzung, Fragebogen oder Traumgang).'
          : locale === 'it'
            ? 'Questo stato è UN momento fissato dalla cronologia (sessione, questionario o passeggiata onirica).'
            : 'Cet état est UN moment figé de ton historique (session, questionnaire ou promenade onirique).'

  const metaBlock =
    ctx.mode === 'snapshot' && ctx.snapshotMeta
      ? [
          ctx.snapshotMeta.dateIso ? `date: ${ctx.snapshotMeta.dateIso}` : '',
          ctx.snapshotMeta.type ? `type: ${ctx.snapshotMeta.type}` : '',
          ctx.snapshotMeta.label ? `user-facing summary (may be short):\n${ctx.snapshotMeta.label}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : ''

  const sys = `You write ONE micro-poem for a wellbeing app ("inner garden" metaphor: eight love dynamics as petals on a flower).
Output STRICT JSON with a single key: {"haiku":"..."}
The value "haiku" must be EXACTLY 3 lines separated by a single \\n (no blank line between lines). Each line: 5–11 words, concrete images (breath, water, light, path, garden, tide, roots…), warm tone, no moral pressure.
Do NOT output numbers, scores or percentages. Do not say "data", "score" or "algorithm".
When naming a love form, follow the user's language: FR/ES use official name + em dash + short gloss (e.g. Philia — les liens d'amis); EN use name + gloss in parentheses (e.g. Philia (friendship)); DE/IT use the same idea with natural phrasing.
${getLangInstruction(locale)}`

  const user =
    ctx.mode === 'blend'
      ? `${blendIntro}

Relative weights 0–1 (JSON):
${JSON.stringify(snap)}

Strongest lines:
${top}

Write {"haiku":"line1\\nline2\\nline3"} in the user language.`
      : `${snapIntro}

${metaBlock ? `${metaBlock}\n\n` : ''}Relative weights 0–1 (JSON):
${JSON.stringify(snap)}

Strongest lines:
${top}

Write {"haiku":"line1\\nline2\\nline3"} in the user language. Echo the emotional tone of the moment without copying the summary verbatim.`

  const result = await openrouterCall(sys, [{ role: 'user', content: user }], {
    maxTokens: 220,
    responseFormatJson: true,
    timeoutMs: 20_000,
    maxAttempts: 1,
  })
  if (!result || typeof result !== 'object') return null
  const o = result as Record<string, unknown>
  let raw = String(o.haiku ?? o.poem ?? '').trim()
  if (!raw) return null
  raw = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n').trim()
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length > 3) {
    raw = lines.slice(0, 3).join('\n')
  }
  if (lines.length < 3) {
    const one = lines[0] ?? raw
    const parts = one.split(/\.\s+/).map((p) => p.replace(/\.\s*$/, '').trim()).filter(Boolean)
    if (parts.length >= 3) raw = `${parts[0]}.\n${parts[1]}.\n${parts[2]}.`
    else return null
  }
  if (raw.length > 400) raw = `${raw.slice(0, 397)}…`
  return raw
}
