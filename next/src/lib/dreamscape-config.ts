export type DreamscapeCloseMode = 'manual' | 'model' | 'auto'

export type DreamscapeConfig = {
  // Desired number of user turns for a full walk (soft target)
  objectif_echanges?: number
  // Hard minimum before the AI may propose closing
  min_echanges_avant_cloture?: number
  // How closure is triggered in UI:
  // - manual: user closes via button only (no auto modal)
  // - model: UI opens close modal only when AI returns propose_close=true
  close_mode?: DreamscapeCloseMode
  // Control how many cards can be revealed per user turn
  max_cartes_par_tour?: number
  // Token budget for analyze_mood calls (server-side)
  max_tokens?: number
  // If true, enforce that the final output shown ends with '?'
  force_question_finale?: boolean

  // Hard cap for user turns in a walk. When reached, UI nudges the user to close.
  max_echanges?: number
  // Extra turns allowed after max_echanges before forcing closure (soft).
  extra_echanges_avant_forcer_cloture?: number
}

const DEFAULT_CONFIG: Required<Pick<
  DreamscapeConfig,
  'objectif_echanges' | 'min_echanges_avant_cloture' | 'close_mode' | 'max_cartes_par_tour' | 'max_tokens' | 'force_question_finale' | 'max_echanges' | 'extra_echanges_avant_forcer_cloture'
>> = {
  objectif_echanges: 20,
  min_echanges_avant_cloture: 20,
  close_mode: 'model',
  max_cartes_par_tour: 1,
  max_tokens: 700,
  force_question_finale: true,
  max_echanges: 20,
  extra_echanges_avant_forcer_cloture: 3,
}

function clampInt(n: unknown, min: number, max: number): number | undefined {
  const v = Number(n)
  if (!Number.isFinite(v)) return undefined
  const i = Math.floor(v)
  return Math.max(min, Math.min(max, i))
}

export function parseDreamscapeConfigFromPrompt(prompt: string): DreamscapeConfig {
  const text = String(prompt ?? '')
  const m = text.match(/<DREAMSCAPE_CONFIG_JSON>\s*([\s\S]*?)\s*<\/DREAMSCAPE_CONFIG_JSON>/i)
  if (!m?.[1]) return { ...DEFAULT_CONFIG }
  try {
    const raw = JSON.parse(m[1])
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_CONFIG }
    const o = raw as Record<string, unknown>
    const closeMode =
      o.close_mode === 'manual' || o.close_mode === 'model' || o.close_mode === 'auto'
        ? (o.close_mode as DreamscapeCloseMode)
        : undefined
    const cfg: DreamscapeConfig = {
      objectif_echanges: clampInt(o.objectif_echanges, 1, 200),
      min_echanges_avant_cloture: clampInt(o.min_echanges_avant_cloture, 0, 200),
      close_mode: closeMode,
      max_cartes_par_tour: clampInt(o.max_cartes_par_tour, 0, 3),
      max_tokens: clampInt(o.max_tokens, 150, 4000),
      force_question_finale: typeof o.force_question_finale === 'boolean' ? o.force_question_finale : undefined,
      max_echanges: clampInt(o.max_echanges, 1, 200),
      extra_echanges_avant_forcer_cloture: clampInt(o.extra_echanges_avant_forcer_cloture, 0, 20),
    }
    return { ...DEFAULT_CONFIG, ...Object.fromEntries(Object.entries(cfg).filter(([, v]) => v !== undefined)) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

