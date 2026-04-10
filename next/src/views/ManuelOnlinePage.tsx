'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  getManuelAssetUrl,
  manuelChapterBaseName,
  type ManuelManifest,
  type ManuelManifestSection,
} from '@/lib/manuel'
import { t } from '@/i18n'
import { ALL_CARDS } from '@/data/tarotCards'

function parseChapterMarkdown(raw: string): { title: string; meta: string | null; body: string } {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/)
  let title = ''
  let meta: string | null = null
  let i = 0
  if (lines[0]?.startsWith('# ')) {
    title = lines[0].slice(2).trim()
    i = 1
  }
  while (i < lines.length && lines[i].trim() === '') i++
  if (lines[i]?.startsWith('> ')) {
    meta = lines[i].replace(/^>\s?/, '').trim()
    i += 1
  }
  while (i < lines.length && lines[i].trim() === '') i += 1
  const body = lines.slice(i).join('\n').trim()
  return { title, meta, body }
}

function normCardKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`´]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

function canonicalManualTitle(raw: string): string {
  const key = normCardKey(raw)
  const canonical: Record<string, string> = {
    agape: 'AGAPÈ',
    eros: 'ÉROS',
    philia: 'PHILIA',
    storge: 'STORGÈ',
    pragma: 'PRAGMA',
    ludus: 'LUDUS',
    mania: 'MANIA',
    manie: 'MANIA',
    philautia: 'PHILAUTIA',
  }
  return canonical[key] ?? raw
}

type SectionDef = {
  key: string
  label: string
  pattern: RegExp
}

type SectionMatch = {
  key: string
  label: string
  start: number
  end: number
}

const SECTION_DEFS: SectionDef[] = [
  { key: 'description', label: 'Description étendue', pattern: /Description\s+étendue\s*:/gi },
  { key: 'light', label: 'Mots-clés lumière', pattern: /Mots-clés\s+lumière\s*:/gi },
  { key: 'shadow', label: 'Mots-clés ombre', pattern: /Mots-clés\s+ombre\s*:/gi },
  /** Sans flag i : évite d’accrocher « ombre » dans « Mots-clés ombre ». */
  { key: 'ombre', label: 'Ombre', pattern: /Ombre\s*:/g },
  { key: 'integration', label: 'Chemins d’intégration', pattern: /Chemins\s+d[’']intégration\s*:/gi },
  { key: 'resonance', label: "Résonance de l'Âme", pattern: /Résonance\s+de\s+l[’']Âme\s*:/gi },
  { key: 'energy', label: 'Correspondances énergétiques', pattern: /Correspondances\s+énergétiques\s*:/gi },
  { key: 'question', label: 'Question Racine', pattern: /Question\s+Racine\s*:/gi },
  { key: 'exercise', label: 'Exercice / Méditation', pattern: /Exercice\s*\/\s*Méditation\s*:/gi },
]

/** Profondeur de parenthèses avant `index` — évite de couper sur « Ombre : » dans « (Ombre : Explosion) ». */
function parenDepthBefore(s: string, index: number): number {
  let depth = 0
  for (let i = 0; i < index; i++) {
    const c = s[i]
    if (c === '(') depth += 1
    else if (c === ')' && depth > 0) depth -= 1
  }
  return depth
}

function findSections(raw: string): SectionMatch[] {
  const out: SectionMatch[] = []
  for (const def of SECTION_DEFS) {
    if (def.key === 'ombre') {
      const re = /Ombre\s*:/g
      let m: RegExpExecArray | null
      while ((m = re.exec(raw)) !== null) {
        if (m.index != null && parenDepthBefore(raw, m.index) === 0) {
          out.push({
            key: def.key,
            label: def.label,
            start: m.index,
            end: m.index + m[0].length,
          })
          break
        }
      }
      continue
    }
    def.pattern.lastIndex = 0
    const m = def.pattern.exec(raw)
    if (!m || m.index == null) continue
    out.push({
      key: def.key,
      label: def.label,
      start: m.index,
      end: m.index + m[0].length,
    })
  }
  return out.sort((a, b) => a.start - b.start)
}

function splitKeywords(raw: string): string[] {
  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

function parseEnergyFields(raw: string): Array<{ label: string; value: string }> {
  const defs = [
    { label: 'Élément', re: /Élément\s*:/gi },
    { label: 'Polarité', re: /Polarité\s*:/gi },
    { label: 'Correspondances symboliques', re: /Correspondances\s+symboliques\s*:/gi },
    { label: 'En résonance', re: /En\s+résonance\s*:/gi },
  ]
  const points: Array<{ label: string; start: number; end: number }> = []
  for (const d of defs) {
    d.re.lastIndex = 0
    const m = d.re.exec(raw)
    if (!m || m.index == null) continue
    points.push({ label: d.label, start: m.index, end: m.index + m[0].length })
  }
  points.sort((a, b) => a.start - b.start)
  const out: Array<{ label: string; value: string }> = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const next = points[i + 1]
    const value = raw.slice(p.end, next ? next.start : raw.length).trim()
    if (!value) continue
    out.push({ label: p.label, value })
  }
  return out
}

function stripPageAnnotations(raw: string): string {
  const lines = raw.split(/\r?\n/)
  const cleaned = lines
    .map((line) =>
      line
        // "46  Description étendue ..." -> "Description étendue ..."
        .replace(/^\s*\d{1,3}\s{2,}/, '')
        // Supprime les lignes ne contenant qu'un numéro de page.
        .replace(/^\s*\d{1,3}\s*$/, '')
        // " ... La Fleur d'ÅmÔurs 48" -> "... La Fleur d'ÅmÔurs"
        .replace(/\s+\d{1,3}\s*$/, ''),
    )
    // évite les triples lignes vides créées par suppression
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleaned
}

function prepareNarrativeText(raw: string): string {
  return raw
    // Coupe les marqueurs de page inline: "... ressentis. 19 Proposition..."
    .replace(/([.!?…»”])\s+\d{1,3}\s+(?=[A-ZÀ-ÖØ-Ý])/g, '$1\n\n')
    // Introduit des coupures avant des intertitres fréquents dans le manuel.
    .replace(
      /\s+(Introduction|Objectif|Intention|Mise en place|Lecture|Matériel nécessaire|Déroulé|Pourquoi [^:.!?]*|Synthèse|Cadre et limites|Rôle du facilitateur|Écueils classiques|Jeu ouvert ou jeu fermé|Le Tirage|Phrase de Synthèse)\s*:/g,
      '\n\n$1:',
    )
    // Restaure la lisibilité des listes comprimées.
    .replace(/\s+[-•]\s+/g, '\n- ')
    // " ... 10 2. Distinction ..." -> nouveau bloc numéroté.
    .replace(/\s+\d{1,3}\s+(?=\d+\.\s+)/g, '\n\n')
    // Crée des paragraphes à partir des listes numérotées compactées.
    .replace(/\s+(?=\d+\.\s+[A-ZÀ-ÖØ-Ý])/g, '\n\n')
    // Titre suivi d'un " :" collé après une phrase.
    .replace(/([.!?…»”])\s+(?=[A-ZÀ-ÖØ-Ý][^.!?]{2,42}\s*:)/g, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isCycleIntroTitle(title?: string): boolean {
  if (!title) return false
  return /^(Cycle de|Cycle du|Les Éléments)/i.test(title.trim())
}

/** Formulations longues du système uniquement — pas de mots isolés ambigus (ex. « Cycle »). */
const SYSTEM_GLOSSARY_PHRASES = [
  'Tarot Fleur d’ÅmÔurs',
  "Tarot Fleur d'ÅmÔurs",
  'Fleur d’ÅmÔurs',
  "Fleur d'ÅmÔurs",
  'Jardin d’ÅmÔurs',
  "Jardin d'ÅmÔurs",
  'Question Racine',
  'Résonance de l’Âme',
  "Résonance de l'Âme",
  'Correspondances énergétiques',
  'Correspondances symboliques',
  'Chemins d’intégration',
  "Chemins d'intégration",
  'Mots-clés lumière',
  'Mots-clés ombre',
  'Règle du Tuteur',
  'Carte Ressource',
  'Carte Difficile',
  'Libre arbitre',
  'Jardinier de l’Âme',
  "Jardinier de l'Âme",
  'Mémoire de la Sève',
  'Grand Passage',
  'Les Quatre Portes',
  'Triple Fleur',
  'Danse des Cartes',
  'Filtrage Progressif',
  'Pétales de la Fleur',
  'Cycle du Végétal',
  'Cycle de la Vie',
]

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Surlignage discret + citations « » — texte source inchangé, rendu seulement. */
function renderManualInline(text: string, keyPrefix: string): ReactNode {
  const glossarySorted = [...SYSTEM_GLOSSARY_PHRASES].sort((a, b) => b.length - a.length)
  const glossRe = new RegExp(`(${glossarySorted.map(escapeRegExp).join('|')})`, 'giu')

  function applyGlossary(fragment: string, prefix: string): ReactNode[] {
    const nodes: ReactNode[] = []
    let last = 0
    let n = 0
    for (const m of fragment.matchAll(glossRe)) {
      const i = m.index ?? -1
      if (i < 0) continue
      if (i > last) nodes.push(fragment.slice(last, i))
      nodes.push(
        <span
          key={`${prefix}-g-${n++}`}
          className="font-medium text-violet-800 dark:text-violet-200/95 underline decoration-violet-400/40 dark:decoration-violet-500/35 underline-offset-[3px]"
        >
          {m[0]}
        </span>,
      )
      last = i + m[0].length
    }
    if (last < fragment.length) nodes.push(fragment.slice(last))
    return nodes
  }

  const parts = text.split(/(«[^»]*»)/g)
  const out: ReactNode[] = []
  let qi = 0
  for (const part of parts) {
    if (part.startsWith('«') && part.endsWith('»') && part.length > 2) {
      const inner = part.slice(1, -1)
      out.push(
        <blockquote
          key={`${keyPrefix}-q-${qi}`}
          className="border-l-[3px] border-violet-500/55 dark:border-violet-400/50 pl-4 py-2.5 my-3 rounded-r-xl bg-violet-500/[0.07] dark:bg-violet-500/[0.12] text-slate-700 dark:text-slate-200 leading-7 text-[15px] sm:text-base"
        >
          {applyGlossary(inner, `${keyPrefix}-qin-${qi}`)}
        </blockquote>,
      )
      qi += 1
    } else if (part) {
      out.push(...applyGlossary(part, `${keyPrefix}-p-${qi++}`))
    }
  }
  if (out.length === 0) return null
  if (out.length === 1) return out[0]
  return <>{out}</>
}

function pushParagraphChunks(text: string, blocks: NarrativeBlock[]) {
  const t = text.trim()
  if (!t) return
  if (t.length > 420) {
    const sentences = t.split(/(?<=[.!?…»”])\s+(?=[A-ZÀ-ÖØ-Ý«])/g).filter(Boolean)
    let acc = ''
    for (const s of sentences) {
      acc = acc ? `${acc} ${s}` : s
      if (acc.length > 260) {
        blocks.push({ kind: 'paragraph', text: acc.trim() })
        acc = ''
      }
    }
    if (acc.trim()) blocks.push({ kind: 'paragraph', text: acc.trim() })
  } else {
    blocks.push({ kind: 'paragraph', text: t })
  }
}

/** Détecte les listes « 1. Titre : corps » (charte, principes) sans altérer le texte. */
function parseNumberedPrinciples(s: string): { intro: string | null; items: Array<{ num: string; title: string; body: string }> } | null {
  const re = /\b(\d+)\.\s+([^:]+?):\s*/g
  const matches = [...s.matchAll(re)]
  if (matches.length < 2) return null
  for (const m of matches) {
    const title = m[2].trim()
    if (title.length < 4 || title.length > 130) return null
  }
  const firstIdx = matches[0].index ?? 0
  const intro = firstIdx > 0 ? s.slice(0, firstIdx).trim() : ''
  const items: Array<{ num: string; title: string; body: string }> = []
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? s.length) : s.length
    items.push({ num: m[1], title: m[2].trim(), body: s.slice(start, end).trim() })
  }
  return { intro: intro || null, items }
}

type NarrativeBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'callout'; label: string; text: string }
  | { kind: 'principles'; items: Array<{ num: string; title: string; body: string }> }

function buildNarrativeBlocks(raw: string): NarrativeBlock[] {
  const chunks = raw
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean)

  const blocks: NarrativeBlock[] = []
  let paragraph = ''
  let listBuffer: string[] = []

  const flushParagraph = () => {
    if (!paragraph) return
    blocks.push({ kind: 'paragraph', text: paragraph.trim() })
    paragraph = ''
  }

  const flushList = () => {
    if (!listBuffer.length) return
    blocks.push({ kind: 'list', items: listBuffer })
    listBuffer = []
  }

  const headingLike = (s: string): { level: 2 | 3 | 4; text: string } | null => {
    const t = s.trim()
    if (!t) return null
    if (/^(Introduction|Objectif|En Conclusion|Cadre et limites)$/i.test(t)) return { level: 2, text: t }
    if (/^(Intention|Mise en place|Lecture|Matériel nécessaire|Déroulé.*|Pourquoi .*|Rôle du facilitateur|Écueils classiques.*)$/i.test(t)) {
      return { level: 3, text: t }
    }
    if (/^(Phase\s+\d+|Étape\s+\d+|Niveau\s+\d+)/i.test(t)) return { level: 4, text: t }
    return null
  }

  for (const c of chunks) {
    const principles = parseNumberedPrinciples(c)
    if (principles && principles.items.length >= 2) {
      flushParagraph()
      flushList()
      if (principles.intro) pushParagraphChunks(principles.intro, blocks)
      blocks.push({ kind: 'principles', items: principles.items })
      continue
    }

    const heading = headingLike(c)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({ kind: 'heading', level: heading.level, text: heading.text })
      continue
    }

    const idx = c.indexOf(':')
    if (idx > 0 && idx < 28) {
      const label = c.slice(0, idx).trim()
      const value = c.slice(idx + 1).trim()
      if (label && value && /^(Exemple|Exemples|Principe|Usage|Astuce|Note|Règles? d'or|Toujours 8 cartes en main)$/i.test(label)) {
        flushParagraph()
        flushList()
        blocks.push({ kind: 'callout', label, text: value })
        continue
      }
    }

    const isBullet = /^[-•]\s+/.test(c)
    if (isBullet) {
      flushParagraph()
      listBuffer.push(c.replace(/^[-•]\s+/, '').trim())
      continue
    }
    flushList()
    // Si le bloc est très long, on le découpe en paragraphes lisibles par phrases.
    if (c.length > 420) {
      const sentences = c.split(/(?<=[.!?…»”])\s+(?=[A-ZÀ-ÖØ-Ý«])/g).filter(Boolean)
      let acc = ''
      for (const s of sentences) {
        acc = acc ? `${acc} ${s}` : s
        const shouldFlush = acc.length > 240
        if (shouldFlush) {
          blocks.push({ kind: 'paragraph', text: acc.trim() })
          acc = ''
        }
      }
      if (acc) blocks.push({ kind: 'paragraph', text: acc.trim() })
      continue
    }

    paragraph = paragraph ? `${paragraph} ${c}` : c
    const longEnough = paragraph.length > 240
    const endSentence = /[.!?…»”]$/.test(c)
    if (longEnough && endSentence) flushParagraph()
  }

  flushList()
  flushParagraph()
  return blocks
}

/** Rendu commun : paragraphes, listes, intertitres, encadrés, charte numérotée — texte source inchangé. */
function ManualNarrativeBlocks({
  blocks,
  isCycleIntro,
  keyBase,
}: {
  blocks: NarrativeBlock[]
  isCycleIntro: boolean
  keyBase: string
}) {
  return (
    <>
      {blocks.map((b, i) =>
        b.kind === 'principles' ? (
          <div key={`${keyBase}-pr-${i}`} className="space-y-3 not-italic">
            <ul className="m-0 list-none space-y-3 p-0">
              {b.items.map((it, j) => (
                <li
                  key={`${keyBase}-pri-${i}-${j}`}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/50 p-4 sm:p-5 shadow-sm"
                >
                  <div className="flex gap-3 sm:gap-4">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-violet-700 text-sm font-bold text-white shadow-md ring-2 ring-white/25 dark:ring-violet-950/50"
                      aria-hidden
                    >
                      {it.num}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <h4 className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-50 sm:text-lg">
                        {it.title}
                      </h4>
                      <div className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-[15px]">
                        {renderManualInline(it.body, `${keyBase}-prb-${i}-${j}`)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : b.kind === 'heading' ? (
          b.level === 2 ? (
            <h2
              key={`${keyBase}-h-${i}`}
              className="not-italic pt-2 text-xl font-bold text-slate-900 dark:text-slate-50 sm:text-2xl"
            >
              {b.text}
            </h2>
          ) : b.level === 3 ? (
            <h3
              key={`${keyBase}-h-${i}`}
              className="not-italic pt-1 text-lg font-semibold text-slate-900 dark:text-slate-50 sm:text-xl"
            >
              {b.text}
            </h3>
          ) : (
            <h4
              key={`${keyBase}-h-${i}`}
              className="not-italic pt-1 text-base font-semibold text-violet-700 dark:text-violet-300 sm:text-lg"
            >
              {b.text}
            </h4>
          )
        ) : b.kind === 'callout' ? (
          <div
            key={`${keyBase}-co-${i}`}
            className="rounded-xl border border-sky-200/70 bg-sky-50/60 p-3 dark:border-sky-900/60 dark:bg-sky-950/20"
          >
            <span className="inline-flex items-center rounded-full border border-sky-200 bg-white/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300">
              {b.label}
            </span>
            <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-base">
              {renderManualInline(b.text, `${keyBase}-cot-${i}`)}
            </p>
          </div>
        ) : b.kind === 'list' ? (
          <ul
            key={`${keyBase}-ul-${i}`}
            className="list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-base"
          >
            {b.items.map((item, li) => (
              <li key={`${keyBase}-li-${i}-${li}`}>{renderManualInline(item, `${keyBase}-lit-${i}-${li}`)}</li>
            ))}
          </ul>
        ) : (
          <p
            key={`${keyBase}-p-${i}`}
            className={
              isCycleIntro
                ? 'mx-auto max-w-2xl text-base leading-8 text-slate-700 dark:text-slate-200 sm:text-lg'
                : 'text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-base'
            }
          >
            {renderManualInline(b.text, `${keyBase}-pt-${i}`)}
          </p>
        ),
      )}
    </>
  )
}

function ChapterBody({ text, title }: { text: string; title?: string }) {
  if (!text) return null
  const displayText = stripPageAnnotations(text)
  const sections = findSections(displayText)
  if (!sections.length) {
    const narrativeText = prepareNarrativeText(displayText)
    const blocks = buildNarrativeBlocks(narrativeText)
    const isCycleIntro = isCycleIntroTitle(title) && blocks.length <= 2
    return (
      <div className="mt-6 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/35 p-4 sm:p-6 shadow-sm">
        <div className={isCycleIntro ? 'space-y-3 text-center' : 'space-y-4'}>
          <ManualNarrativeBlocks blocks={blocks} isCycleIntro={isCycleIntro} keyBase="flow" />
        </div>
      </div>
    )
  }

  const intro = displayText.slice(0, sections[0].start).trim()
  const blocks = sections.map((s, i) => {
    const next = sections[i + 1]
    const content = displayText
      .slice(s.end, next ? next.start : displayText.length)
      .trim()
    return { ...s, content }
  })

  return (
      <div className="mt-7 space-y-6 sm:space-y-7">
      {intro ? (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/35 p-4 sm:p-6 shadow-sm">
          <div className="space-y-4">
            <ManualNarrativeBlocks
              blocks={buildNarrativeBlocks(prepareNarrativeText(intro))}
              isCycleIntro={false}
              keyBase="intro"
            />
          </div>
        </div>
      ) : null}

      {blocks.map((b, idx) => {
        if (b.key === 'light' || b.key === 'shadow') {
          const items = splitKeywords(b.content)
          return (
            <section key={`${b.key}-${idx}`} className="rounded-2xl border border-violet-200/70 dark:border-violet-800/60 bg-violet-50/70 dark:bg-violet-950/25 p-4 sm:p-5 shadow-sm">
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">
                {b.label}
              </h3>
              <div className="mt-3.5 flex flex-wrap gap-2.5">
                {items.map((item) => (
                  <span
                    key={`${b.key}-${item}`}
                    className="px-3 py-1 rounded-full text-xs sm:text-sm bg-white dark:bg-slate-900/90 border border-violet-200/80 dark:border-violet-800 text-slate-700 dark:text-slate-100"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>
          )
        }

        if (b.key === 'question') {
          return (
            <section key={`${b.key}-${idx}`} className="rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/25 p-4 sm:p-5 shadow-sm">
              <h3 className="text-sm sm:text-base font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {b.label}
              </h3>
              <div className="mt-2.5 space-y-4 italic text-slate-800 dark:text-slate-100">
                <ManualNarrativeBlocks
                  blocks={buildNarrativeBlocks(prepareNarrativeText(b.content))}
                  isCycleIntro={false}
                  keyBase={`q-${idx}`}
                />
              </div>
            </section>
          )
        }

        if (b.key === 'energy') {
          const fields = parseEnergyFields(b.content)
          return (
            <section key={`${b.key}-${idx}`} className="space-y-3.5">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">{b.label}</h3>
              {fields.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {fields.map((f) => (
                    <div
                      key={`${f.label}-${f.value}`}
                      className="rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/65 p-3.5"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300">{f.label}</p>
                      <div className="mt-1.5 text-sm leading-7 text-slate-800 dark:text-slate-100 sm:text-[15px]">
                        {renderManualInline(f.value, `en-${idx}-${f.label}`)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <ManualNarrativeBlocks
                    blocks={buildNarrativeBlocks(prepareNarrativeText(b.content))}
                    isCycleIntro={false}
                    keyBase={`en-fallback-${idx}`}
                  />
                </div>
              )}
            </section>
          )
        }

        return (
          <section key={`${b.key}-${idx}`} className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 sm:text-xl">{b.label}</h2>
            <div className="space-y-4">
              <ManualNarrativeBlocks
                blocks={buildNarrativeBlocks(prepareNarrativeText(b.content))}
                isCycleIntro={false}
                keyBase={`sec-${b.key}-${idx}`}
              />
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default function ManuelOnlinePage({ chapterSlug }: { chapterSlug?: string }) {
  const [manifest, setManifest] = useState<ManuelManifest | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [chapterRaw, setChapterRaw] = useState<string | null>(null)
  const [chapterErr, setChapterErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const base = chapterSlug?.replace(/\.md$/i, '') || ''

  useEffect(() => {
    let cancelled = false
    setLoadErr(null)
    fetch(getManuelAssetUrl('/manifest.json'))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then((data: ManuelManifest) => {
        if (!cancelled) setManifest(data)
      })
      .catch(() => {
        if (!cancelled) setLoadErr('manifest')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!base) {
      setChapterRaw(null)
      setChapterErr(null)
      return
    }
    let cancelled = false
    setChapterErr(null)
    fetch(getManuelAssetUrl(`/${encodeURIComponent(base)}.md`))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.text()
      })
      .then((text) => {
        if (!cancelled) setChapterRaw(text)
      })
      .catch(() => {
        if (!cancelled) {
          setChapterRaw(null)
          setChapterErr('notfound')
        }
      })
    return () => {
      cancelled = true
    }
  }, [base])

  const sectionIndex = useMemo(() => {
    if (!manifest?.sections?.length) return -1
    return manifest.sections.findIndex((s) => manuelChapterBaseName(s.file) === base)
  }, [manifest, base])

  const current: ManuelManifestSection | undefined =
    sectionIndex >= 0 ? manifest?.sections[sectionIndex] : undefined
  const prevS = sectionIndex > 0 ? manifest?.sections[sectionIndex - 1] : undefined
  const nextS =
    sectionIndex >= 0 && manifest && sectionIndex < manifest.sections.length - 1
      ? manifest.sections[sectionIndex + 1]
      : undefined

  const filteredSections = useMemo(() => {
    const list = manifest?.sections ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((s) => s.title.toLowerCase().includes(q))
  }, [manifest, query])

  const hrefFor = useCallback((file: string) => {
    const slug = manuelChapterBaseName(file)
    return `/cartes/${encodeURIComponent(slug)}`
  }, [])

  const cardsByNormName = useMemo(() => {
    const m = new Map<string, (typeof ALL_CARDS)[number]>()
    for (const c of ALL_CARDS) {
      m.set(normCardKey(c.name), c)
    }
    return m
  }, [])

  if (loadErr === 'manifest') {
    return (
      <div className="max-w-xl mx-auto text-center py-16 text-slate-500 dark:text-slate-400">
        <p className="text-lg mb-2">{t('manuel.manifestMissing')}</p>
        <p className="text-sm opacity-80">{t('manuel.manifestMissingHint')}</p>
      </div>
    )
  }

  if (!manifest?.sections?.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-slate-400">
        <span className="text-4xl">📖</span>
        <p>{t('common.loading')}</p>
      </div>
    )
  }

  if (!base) {
    return (
      <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-10 min-h-0">
        <div className="lg:w-72 shrink-0 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-6rem)] flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {t('manuel.title')}
            </h1>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('manuel.search')}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            aria-label={t('manuel.search')}
          />
          <nav
            className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 p-2"
            aria-label={t('manuel.toc')}
          >
            <ol className="space-y-0.5 text-sm">
              {filteredSections.map((s) => {
                const num =
                  (manifest?.sections.findIndex((x) => x.file === s.file) ?? -1) + 1
                return (
                  <li key={s.file}>
                    <Link
                      href={hrefFor(s.file)}
                      className="block px-2 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                    >
                      <span className="text-slate-400 dark:text-slate-500 text-xs mr-1 tabular-nums">
                        {num}.
                      </span>
                      <span translate="no">{canonicalManualTitle(s.title)}</span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>
        <div className="flex-1 min-w-0 prose prose-slate dark:prose-invert max-w-none">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('manuel.intro')}
          </p>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t('manuel.introHint')}</p>
        </div>
      </div>
    )
  }

  if (chapterErr === 'notfound' || !chapterRaw) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-4">{t('manuel.empty')}</p>
        <Link
          href="/cartes"
          className="text-violet-600 dark:text-violet-400 font-medium hover:underline"
        >
          {t('manuel.backToc')}
        </Link>
      </div>
    )
  }

  const parsed = parseChapterMarkdown(chapterRaw)
  const displayTitle = canonicalManualTitle(parsed.title || current?.title || base)
  const matchedCard = cardsByNormName.get(normCardKey(displayTitle))
  const cardImageUrl = matchedCard?.img
  const chapterPos =
    current && manifest?.sections?.length
      ? `${(sectionIndex + 1).toString().padStart(2, '0')}/${manifest.sections.length}`
      : null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
        <Link
          href="/cartes"
          className="text-violet-600 dark:text-violet-400 font-medium hover:underline shrink-0"
        >
          ← {t('manuel.toc')}
        </Link>
      </div>

      <nav className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 pb-4 sm:pb-5 border-b border-slate-200 dark:border-slate-800">
        {prevS ? (
          <Link
            href={hrefFor(prevS.file)}
            className="flex flex-col px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/30 hover:border-violet-400/50 hover:bg-violet-500/5 transition-colors sm:max-w-[48%]"
          >
            <span className="text-xs uppercase tracking-wide text-slate-400">{t('manuel.prev')}</span>
            <span className="font-medium text-slate-800 dark:text-slate-100" translate="no">
              {canonicalManualTitle(prevS.title)}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {nextS ? (
          <Link
            href={hrefFor(nextS.file)}
            className="flex flex-col items-end text-right px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/30 hover:border-violet-400/50 hover:bg-violet-500/5 transition-colors sm:max-w-[48%] sm:ml-auto"
          >
            <span className="text-xs uppercase tracking-wide text-slate-400">{t('manuel.next')}</span>
            <span className="font-medium text-slate-800 dark:text-slate-100" translate="no">
              {canonicalManualTitle(nextS.title)}
            </span>
          </Link>
        ) : null}
      </nav>

      <article className="rounded-3xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900/45 p-4 sm:p-8 md:p-10 shadow-md">
        <div className="mb-5 sm:mb-6 flex flex-wrap items-center gap-2.5">
          {chapterPos ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200/90 dark:bg-violet-950/35 dark:text-violet-300 dark:border-violet-800/70">
              {chapterPos}
            </span>
          ) : null}
          {current?.bookPage ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700/80">
              p. {current.bookPage}
            </span>
          ) : null}
        </div>
        {cardImageUrl ? (
          <div className="mb-6 sm:mb-7 flex justify-center">
            <img
              src={cardImageUrl}
              alt={displayTitle}
              loading="lazy"
              className="w-full max-w-[320px] rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-lg object-contain bg-white/50 dark:bg-slate-900/60"
            />
          </div>
        ) : null}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-3.5 sm:mb-4" translate="no">
          {displayTitle}
        </h1>
        {parsed.meta ? (
          <p className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-slate-500 dark:text-slate-300 border-l-4 border-violet-400/70 pl-3 py-1 italic">
            {parsed.meta}
          </p>
        ) : null}
        <ChapterBody text={parsed.body} title={displayTitle} />
      </article>

      <nav className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 mt-8 sm:mt-10 pt-6 sm:pt-7 border-t border-slate-200 dark:border-slate-800">
        {prevS ? (
          <Link
            href={hrefFor(prevS.file)}
            className="flex flex-col px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/30 hover:border-violet-400/50 hover:bg-violet-500/5 transition-colors sm:max-w-[48%]"
          >
            <span className="text-xs uppercase tracking-wide text-slate-400">{t('manuel.prev')}</span>
            <span className="font-medium text-slate-800 dark:text-slate-100" translate="no">
              {canonicalManualTitle(prevS.title)}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {nextS ? (
          <Link
            href={hrefFor(nextS.file)}
            className="flex flex-col items-end text-right px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/30 hover:border-violet-400/50 hover:bg-violet-500/5 transition-colors sm:max-w-[48%] sm:ml-auto"
          >
            <span className="text-xs uppercase tracking-wide text-slate-400">{t('manuel.next')}</span>
            <span className="font-medium text-slate-800 dark:text-slate-100" translate="no">
              {canonicalManualTitle(nextS.title)}
            </span>
          </Link>
        ) : null}
      </nav>
    </div>
  )
}
