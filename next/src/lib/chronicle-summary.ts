import { t } from '@/i18n'
import { isSessionMantraEcho } from '@/lib/session-mantra-echo'
import { PETAL_TO_LANDING_CARD, dominantPetalId } from '@/lib/petal-tarot'

const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'] as const

function fleurScoresTo01(scores: Record<string, number> | undefined, maxScale = 5): Record<string, number> {
  if (!scores) return {}
  const out: Record<string, number> = {}
  for (const p of PETAL_IDS) {
    out[p] = Math.min(1, Math.max(0, (scores[p] ?? 0) / maxScale))
  }
  return out
}

/** Résumé court d'une exploration Ma Fleur / DUO / beta pour le journal dashboard. */
export function buildFleurChronicleSummary(fr: Record<string, unknown>): string {
  const scores = fr.scores as Record<string, number> | undefined
  const typ = String(fr.type ?? 'solo')
  const dom = dominantPetalId(fleurScoresTo01(scores))
  const petalName = dom ? PETAL_TO_LANDING_CARD[dom] ?? dom : ''

  if (typ === 'duo') {
    return petalName
      ? t('chronicle.fleurDuoWithPetal', { petal: petalName })
      : t('chronicle.fleurDuo')
  }
  if (typ === 'fleur-beta') {
    const porte = String(fr.porte ?? '').trim()
    if (porte && petalName) return t('chronicle.fleurBetaWithPorte', { porte, petal: petalName })
    if (porte) return t('chronicle.fleurPorte', { porte })
    return petalName ? t('chronicle.fleurBetaWithPetal', { petal: petalName }) : t('chronicle.fleurBeta')
  }
  return petalName
    ? t('chronicle.fleurSoloWithPetal', { petal: petalName })
    : t('chronicle.fleurSolo')
}

function truncate(str: string, n: number): string {
  const x = str.trim().replace(/\s+/g, ' ')
  if (x.length <= n) return x
  return x.slice(0, n - 1).trim() + '…'
}

/** Premier fragment lisible (phrase ou coupure propre) pour affichage journal. */
export function firstReadableChunk(str: string, max: number): string {
  const flat = str.trim().replace(/\s+/g, ' ')
  if (!flat) return ''
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastPeriod = cut.lastIndexOf('.')
  if (lastPeriod > max * 0.35) return cut.slice(0, lastPeriod + 1).trim()
  const lastSp = cut.lastIndexOf(' ')
  return (lastSp > 24 ? cut.slice(0, lastSp) : cut).trim() + '…'
}

function extractQuotedCardNames(s: string): string[] {
  const out: string[] = []
  const re = /[«"]([^»"]{2,52})[»"]|"([^"]{2,40})"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    const name = (m[1] || m[2] || '').trim()
    if (name.length >= 2 && !out.includes(name)) out.push(name)
  }
  return out
}

function stripLeadingDoorBoilerplate(s: string): string {
  const parts = s.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) return s.trim()
  const first = parts[0]
  if (/cœur|coeur|heart/i.test(first.slice(0, 50)) && /ouvre|opens|abre/i.test(first)) {
    return parts.slice(1).join(' ').trim() || s.trim()
  }
  return s.trim()
}

export function buildReadingChronicleSummary(r: Record<string, unknown>): string {
  const intentionRaw = String(r.intention ?? '').trim()
  const intention = intentionRaw && !isSessionMantraEcho(intentionRaw) ? intentionRaw : ''
  const type = String(r.type ?? 'simple')
  const cards = r.cards as Array<{ name?: string }> | undefined

  if (type === 'four' && Array.isArray(cards) && cards.length >= 4) {
    const n = cards.map((c) => c?.name).filter(Boolean) as string[]
    if (n.length >= 4) {
      if (intention) {
        return t('chronicle.readingFourWithIntent', {
          intent: truncate(intention, 100),
          c1: n[0],
          c2: n[1],
          c3: n[2],
          c4: n[3],
        })
      }
      return t('chronicle.readingFour', {
        c1: n[0],
        c2: n[1],
        c3: n[2],
        c4: n[3],
      })
    }
  }

  const oldSyn = String(r.synthesis ?? '').trim()
  if (type === 'four' && oldSyn) {
    const quoted = extractQuotedCardNames(oldSyn)
    if (quoted.length >= 4) {
      if (intention) {
        return t('chronicle.readingFourWithIntent', {
          intent: truncate(intention, 100),
          c1: quoted[0],
          c2: quoted[1],
          c3: quoted[2],
          c4: quoted[3],
        })
      }
      return t('chronicle.readingFour', {
        c1: quoted[0],
        c2: quoted[1],
        c3: quoted[2],
        c4: quoted[3],
      })
    }
  }

  const card = r.card as { name?: string; synth?: string } | undefined
  const name = card?.name || ''
  const interp = String(r.interpretation ?? '').trim()
  const synth = String(card?.synth ?? '').trim()

  const detailSource = interp || synth || stripLeadingDoorBoilerplate(oldSyn)
  const detail = detailSource ? firstReadableChunk(detailSource, 220) : ''

  if (!name && !oldSyn && !(cards && cards.length)) return ''

  const cardName = name || t('chronicle.readingCardFallback')

  if (intention) {
    const tail = detail ? ` — ${detail}` : ''
    return t('chronicle.readingSimpleWithIntent', {
      card: cardName,
      intent: truncate(intention, 110),
      tail,
    })
  }
  if (detail) {
    return t('chronicle.readingSimple', { card: cardName, detail })
  }
  if (oldSyn) {
    return truncate(stripLeadingDoorBoilerplate(oldSyn), 320)
  }
  return t('chronicle.readingSimpleShort', { card: cardName })
}

export function buildSessionChronicleSummary(
  synthesis: string,
  firstWords?: string | null,
  maxBody = 300
): string {
  const syn = String(synthesis ?? '').trim()
  if (!syn) return ''
  const fw =
    firstWords && !isSessionMantraEcho(String(firstWords)) ? String(firstWords).trim() : ''
  const body = firstReadableChunk(syn, maxBody)
  if (fw) {
    return t('chronicle.sessionWithEntry', {
      entry: truncate(fw, 160),
      body,
    })
  }
  return t('chronicle.sessionSynthesis', { body })
}

export function buildDreamscapeChronicleSummary(
  d: Record<string, unknown>,
  maxText = 280
): string {
  const poetic = String(d.poeticReflection ?? '').trim()
  const history = d.history as Array<{ role: string; content: string }> | undefined
  const assistant = history?.find((m) => m.role === 'assistant')?.content
  const raw = (poetic || assistant || '').trim()
  if (!raw) return t('chronicle.dreamscapeFallback')
  const cleaned = raw
    .replace(/^promenade onirique\.?\s*/i, '')
    .replace(/^conversation intérieure\.?\s*/i, '')
    .trim() || raw
  return t('chronicle.dreamscapeLine', { text: firstReadableChunk(cleaned, maxText) })
}

const PAPER_LAYOUT_LABEL: Record<string, string> = {
  one: '1 carte',
  two: '2 cartes',
  three: '3 cartes',
  four_doors: '4 Portes',
  flower_8: 'Fleur 8 pétales',
  free: 'libre',
}

/** Résumé chronique / timeline pour un tirage papier enregistré. */
export function buildPaperDrawChronicleSummary(r: Record<string, unknown>): string {
  const intention = String(r.intention ?? '').trim()
  const layout = String(r.layout_template ?? 'free')
  const layoutLabel = PAPER_LAYOUT_LABEL[layout] ?? layout
  const cards = (r.cards as Array<{ name?: string }> | undefined) ?? []
  const names = cards.map((c) => c?.name).filter(Boolean) as string[]
  const interp = String(r.interpretation ?? '').trim()
  const detail = interp ? firstReadableChunk(interp, 200) : ''

  if (!names.length && !detail && !intention) return ''

  const cardList = names.slice(0, 8).join(', ')

  if (intention && cardList && detail) {
    return t('chronicle.paperDrawFull', {
      layout: layoutLabel,
      intent: truncate(intention, 100),
      cards: cardList,
      detail,
    })
  }
  if (intention && cardList) {
    return t('chronicle.paperDrawWithIntent', {
      layout: layoutLabel,
      intent: truncate(intention, 100),
      cards: cardList,
    })
  }
  if (cardList && detail) {
    return t('chronicle.paperDrawWithDetail', { layout: layoutLabel, cards: cardList, detail })
  }
  if (cardList) {
    return t('chronicle.paperDrawShort', { layout: layoutLabel, cards: cardList })
  }
  if (detail) {
    return t('chronicle.paperDrawInterpretOnly', { layout: layoutLabel, detail })
  }
  return t('chronicle.paperDrawIntentOnly', {
    layout: layoutLabel,
    intent: truncate(intention, 120),
  })
}

export function paperDrawTimelineTitle(layoutTemplate: string): string {
  const label = PAPER_LAYOUT_LABEL[layoutTemplate] ?? 'tirage'
  return `Tirage papier — ${label}`
}
