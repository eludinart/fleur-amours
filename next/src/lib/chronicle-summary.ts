import { t } from '@/i18n'
import { isSessionMantraEcho } from '@/lib/session-mantra-echo'

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
  firstWords?: string | null
): string {
  const syn = String(synthesis ?? '').trim()
  if (!syn) return ''
  const fw =
    firstWords && !isSessionMantraEcho(String(firstWords)) ? String(firstWords).trim() : ''
  const body = firstReadableChunk(syn, 300)
  if (fw) {
    return t('chronicle.sessionWithEntry', {
      entry: truncate(fw, 110),
      body,
    })
  }
  return t('chronicle.sessionSynthesis', { body })
}

export function buildDreamscapeChronicleSummary(d: Record<string, unknown>): string {
  const poetic = String(d.poeticReflection ?? '').trim()
  const history = d.history as Array<{ role: string; content: string }> | undefined
  const assistant = history?.find((m) => m.role === 'assistant')?.content
  const raw = (poetic || assistant || '').trim()
  if (!raw) return t('chronicle.dreamscapeFallback')
  const cleaned = raw.replace(/^promenade onirique\.?\s*/i, '').trim() || raw
  return t('chronicle.dreamscapeLine', { text: firstReadableChunk(cleaned, 280) })
}
