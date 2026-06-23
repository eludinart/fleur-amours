'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import {
  getManuelAssetUrl,
  manuelChapterBaseName,
  type ManuelManifest,
  type ManuelManifestSection,
} from '@/lib/manuel'
import { t, getLocale } from '@/i18n'
import { useStore } from '@/store/useStore'
import { ALL_CARDS } from '@/data/tarotCards'
import ManuelCartography from '@/components/manuel/ManuelCartography'
import {
  findManuelScrollContainer,
  getPendingTocReturn,
  rememberManuelTocReturn,
  restoreManuelTocScroll,
  scrollManuelMainToTop,
  syncManuelTocScrollTop,
  manuelTocAnchorFromFile,
} from '@/lib/manuel-toc-scroll'
import { getManuelCardSectionDefs, getManuelEnergyFieldDefs } from '@/lib/manuel-card-sections'
import { manuelSectionTitle, normalizeManuelLocale } from '@/lib/manuel-i18n'

function isPaperFormatMeta(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return (
    /^pages\s+livre/i.test(t) ||
    /\bpdf\s+p\./i.test(t) ||
    /estimé depuis le texte extrait/i.test(t) ||
    /\(sommaire\)/i.test(t)
  )
}

function isStandalonePageNumber(text: string): boolean {
  return /^\d{1,3}$/.test(text.trim())
}

/** Étiquettes structurelles imprimées en pied de fiche carte (à neutraliser dans le flux). */
const CYCLE_LABELS = [
  'Cycle du Végétal',
  'Cycle de la Vie',
  'Cycle de la Terre',
  'Cycle de l\u2019Eau',
  "Cycle de l'Eau",
  'Cycle de l\u2019Air',
  "Cycle de l'Air",
  'Cycle du Feu',
  'Cycle de l\u2019Éther',
  "Cycle de l'Éther",
  'Cycle de l\u2019Ether',
  "Cycle de l'Ether",
  'Les Éléments',
  'Les Quatre Portes',
  'La Fleur d\u2019ÅmÔurs',
  "La Fleur d'ÅmÔurs",
  'La Fleur d\u2019ÅmÔurs déployée',
  "La Fleur d'ÅmÔurs déployée",
  'Tarot Fleur d\u2019ÅmÔurs',
  "Tarot Fleur d'ÅmÔurs",
]

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
    const candidate = lines[i].replace(/^>\s?/, '').trim()
    if (!isPaperFormatMeta(candidate)) meta = candidate
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

type SectionMatch = {
  key: string
  label: string
  start: number
  end: number
}

/** Ordre éditorial canonique des sections d'une fiche carte (référence : AGAPÈ). */
const CARD_SECTION_ORDER: Record<string, number> = {
  description: 1,
  light: 2,
  ombre: 3,
  shadow: 4,
  integration: 5,
  exercise: 6,
  resonance: 7,
  energy: 8,
  question: 9,
}

/** Capture un sous-titre court juste après le label (« Description étendue : Le don sans condition Agapè est… »). */
function splitLeadSubheading(
  content: string,
  key?: string,
): { sub: string | null; rest: string } {
  const c = content.trimStart()
  // 1) Cas idéal : saut de ligne explicite après une 1ʳᵉ ligne courte.
  const nlIdx = c.indexOf('\n')
  if (nlIdx > 0 && nlIdx <= 90) {
    const first = c.slice(0, nlIdx).trim()
    if (
      first.length >= 6 &&
      first.length <= 90 &&
      !/[.!?…»”]$/.test(first) &&
      !/^[-•]/.test(first) &&
      !/^[0-9]+[.)]/.test(first)
    ) {
      return { sub: first, rest: c.slice(nlIdx + 1).trimStart() }
    }
  }

  // 2) Pour Description étendue et Ombre : sous-titre nominal inline (sans verbe d'état).
  if (key === 'description' || key === 'ombre') {
    const m = c.match(/^([^\n.!?…»”]{8,90})\s+(?=[A-ZÀ-ÖØ-Ý][\p{L}’'-]*(?:\s|[.,;:]))/u)
    if (m) {
      const cand = m[1].trim()
      const wc = cand.split(/\s+/).length
      const hasVerb =
        /\b(?:est|sont|était|étaient|fut|furent|sera|seront|représente|représentent|incarne|incarnent|symbolise|symbolisent|évoque|évoquent|appelle|appellent|invite|invitent|signifie|met|porte|portent|devient|deviennent|reste|restent|donne|donnent|peut|peuvent|doit|doivent|veut|veulent|fait|font|nourrit|exprime|nous\s+enseigne)\b/i.test(
          cand,
        )
      if (wc >= 3 && wc <= 12 && !hasVerb) {
        return { sub: cand, rest: c.slice(m[0].length).trimStart() }
      }
    }
  }
  return { sub: null, rest: c }
}

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

function findSections(raw: string, locale = 'fr'): SectionMatch[] {
  const out: SectionMatch[] = []
  const sectionDefs = getManuelCardSectionDefs(normalizeManuelLocale(locale))
  for (const def of sectionDefs) {
    if (def.key === 'ombre') {
      const re = def.pattern
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

function parseEnergyFields(raw: string, locale = 'fr'): Array<{ label: string; value: string }> {
  const defs = getManuelEnergyFieldDefs(normalizeManuelLocale(locale))
  const points: Array<{ label: string; start: number; end: number }> = []
  for (const d of defs) {
    d.pattern.lastIndex = 0
    const m = d.pattern.exec(raw)
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

/** Normalisations typographiques globales (guillemets, espaces, ponctuation française). */
function normalizeTypography(raw: string): string {
  const NBSP = '\u00A0' // espace insécable fine
  let t = raw
  // Guillemets droits doubles « ascii » -> «  ... »  (FR)
  t = t.replace(/"([^"\n]{1,300}?)"/g, '«$1»')
  // Guillemets droits courbes “ ” -> «  ... » (variante typographique)
  t = t.replace(/[\u201C\u201D]([^\u201C\u201D\n]{1,300}?)[\u201C\u201D]/g, '«$1»')
  // Espace double -> simple
  t = t.replace(/[\t ]{2,}/g, ' ')
  // Espaces insécables FR : avant : ; ! ? » et après «
  // (n'insère pas si déjà NBSP ; ignore les `:` collés type « 18:30 »)
  t = t.replace(/ +([;!?»])/g, NBSP + '$1')
  t = t.replace(/ +:(?=\s)/g, NBSP + ':')
  t = t.replace(/«\s+/g, '«' + NBSP)
  return t
}

/** Supprime, en tête du corps, la répétition du titre du chapitre (avec petites variantes). */
function stripDuplicatedTitle(body: string, title: string | undefined): string {
  if (!title) return body
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’'`´]/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  const targetNorm = norm(title)
  if (!targetNorm) return body
  const trimmed = body.trimStart()
  const head = trimmed.slice(0, Math.max(80, targetNorm.length + 30))
  const headNorm = norm(head)
  if (headNorm.startsWith(targetNorm)) {
    return trimmed.slice(head.length - (headNorm.length - targetNorm.length)).trimStart()
  }
  // Variante : titre suivi d'un paragraphe « Charte … », « (…) » entre parenthèses.
  const reTitle = new RegExp(
    `^\\s*${title.replace(/[.*+?^${}()|[\\\\]\\\\]/g, '\\\\$&').replace(/['’]/g, "['’]")}` +
      `(?:\\s*\\([^)]{1,120}\\))?\\s*`,
    'i',
  )
  return body.replace(reTitle, '').trimStart()
}

/** Repère et retire le « verso » de carte (NOM EN MAJUSCULES + description courte). */
function extractCardVerso(
  text: string,
  title: string | undefined,
): { body: string; verso: string | null } {
  if (!title) return { body: text, verso: null }
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]")
  const reUpper = new RegExp(
    `\\s+(${escapedTitle.toUpperCase()})\\s+(Représente|Représentent|Incarne|Incarnent|Symbolise|Symbolisent|Évoque|Évoquent|Le\\s|La\\s|Les\\s|Cette\\s+carte|C[’']est)`,
    'u',
  )
  const m = text.match(reUpper)
  if (!m || m.index == null) return { body: text, verso: null }
  const start = m.index
  // Cherche la fin du verso : numéro de page suivant ou label de section connu (Mots-clés ombre, Chemins d'intégration, etc.)
  const rest = text.slice(start + m[0].length)
  const endPatterns = [
    /\s+\d{1,3}\s+Mots-clés\s+ombre/i,
    /\s+Mots-clés\s+ombre\s*:/i,
    /\s+Chemins?\s+d[’']intégration\s*:/i,
    /\s+Correspondances\s+énergétiques\s*:/i,
    /\s+Résonance\s+de\s+l[’']Âme\s*:/i,
    /\s+\d{1,3}\s+(?:Mots-clés|Chemins?|Exercice|Correspondances|Résonance|Question)/i,
  ]
  let endRelative = -1
  for (const re of endPatterns) {
    const mm = rest.match(re)
    if (mm && mm.index != null) {
      if (endRelative < 0 || mm.index < endRelative) endRelative = mm.index
    }
  }
  if (endRelative < 0) return { body: text, verso: null }
  const end = start + m[0].length + endRelative
  const verso = text.slice(start + 1, end).trim()
  // Garde-fou : verso doit rester compact (≤ 600 chars).
  if (verso.length > 600) return { body: text, verso: null }
  const body = (text.slice(0, start) + ' ' + text.slice(end)).replace(/[ \t]{2,}/g, ' ').trim()
  return { body, verso }
}

function stripPageAnnotations(raw: string): string {
  let text = raw

  // Pieds de page issus de l'extraction PDF (milieu de ligne ou fin de phrase).
  text = text.replace(/\bLa Fleur d[’'´`]ÅmÔurs\s+\d{1,3}\b/gi, ' ')
  // « La Fleur d'ÅmÔurs » isolée entre deux phrases (label de pied de page).
  text = text.replace(/([.!?…»”])\s+La Fleur d[’'´`]ÅmÔurs\s+(?=[A-ZÀ-ÖØ-Ý«])/g, '$1\n\n')
  text = text.replace(/\s+La Fleur d[’'´`]ÅmÔurs\s*$/gi, '')
  // « Cycle du Végétal », « Cycle de la Vie », etc. en pied/début d'un nouveau paragraphe.
  for (const label of CYCLE_LABELS) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]")
    // « Les Éléments 87 Chemins… » — label + numéro de page issu du PDF.
    text = text.replace(new RegExp(`\\s+${esc}\\s+\\d{1,3}\\s+`, 'gi'), ' ')
    const reEnd = new RegExp(`\\s+${esc}\\s*(?=\\d{1,3}\\b|$)`, 'gi')
    text = text.replace(reEnd, ' ')
  }

  // Tronquer toute pollution après la Question Racine (fiche carte suivante).
  const qTrunc = text.match(/Question\s+Racine\s*:[\s\S]*?«[^»]+»/iu)
  if (qTrunc) text = text.slice(0, qTrunc.index! + qTrunc[0].length)

  // Numéro de page en tête du corps (ex. « 50  Description étendue » ou « 46 Description… »).
  text = text.replace(/^\s*\d{1,3}\s{2,}/, '')
  text = text.replace(/^\s*\d{2,3}\s+(?=[A-ZÀ-ÖØ-Ýa-zà-öø-ý«(])/, '')

  // Suites de numéros de page en fin (« 43 44 45 », « 11 », etc.).
  text = text.replace(/(?:\s+\d{1,3}){1,5}\s*$/g, '')

  // Sépare les fiches cartes fusionnées lors de l'extraction.
  text = text.replace(
    /([.!?…»"”])\s+\d{1,3}\s+(?=(?:Description\s+étendue|Mots-clés\s+(?:lumière|ombre)|PHILIA|STORGÈ|AGAPÈ|ÉROS|LUDUS|MANIA|PRAGMA|PHILAUTIA)\b)/gi,
    '$1\n\n',
  )
  text = text.replace(/\s+\d{1,3}\s+(?=Mots-clés\s+(?:lumière|ombre)\s*:)/gi, '\n\n')

  const lines = text.split(/\r?\n/)
  const cleaned = lines
    .map((line) =>
      line
        .replace(/^\s*\d{1,3}\s{2,}/, '')
        .replace(/^\s*\d{1,3}\s*$/, '')
        .replace(/\s+\d{1,3}\s*$/, ''),
    )
    .filter((line) => {
      const t = line.trim()
      return t !== '' && !isStandalonePageNumber(t)
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleaned
}

function prepareNarrativeText(raw: string): string {
  return raw
    // Coupe les marqueurs de page inline: "... ressentis. 19 Proposition..."
    .replace(/([.!?…»”])\s+\d{1,3}\s+(?=[A-ZÀ-ÖØ-Ý])/g, '$1\n\n')
    // Intertitres de tirages / protocoles (y compris « Mise en place (Filtrée) »).
    .replace(
      /\s+(Cartes utilisées(?:\s*\([^)]+\))?|Usage|Liberté de Pratique|Tirage à \d+ carte[s]?|Mise en place(?:\s*\([^)]+\))?)\s*:/gi,
      '\n\n$1:',
    )
    // Introduit des coupures avant des intertitres fréquents dans le manuel.
    .replace(
      /(?:^|\s+)(Introduction|Objectif|Intention|Lecture|Matériel nécessaire|Déroulé|Pourquoi [^:.!?]{2,80}|Synthèse|Cadre et limites|Rôle du facilitateur|Écueils classiques|Jeu ouvert ou jeu fermé|Le Tirage|Phrase de Synthèse)\s*(?=[A-ZÀ-ÖØ-Ý«(:])/g,
      '\n\n$1\n\n',
    )
    // Sous-titres « Étape N : Titre » / « Phase N : … » / « Niveau N : … (…) ».
    .replace(
      /\s+((?:Phase|Étape|Niveau)\s+\d+\s*[:：][^(\n.]{1,90}?\([^)\n]{1,80}\))\s+(?=[A-ZÀ-ÖØ-Ý«])/g,
      '\n\n$1\n\n',
    )
    .replace(
      /\s+((?:Phase|Étape|Niveau)\s+\d+\s*[:：][^.\n]{2,100}?)(?=\s+[A-ZÀ-ÖØ-Ý«])/g,
      '\n\n$1\n\n',
    )
    // Sous-titres numérotés sans deux-points : « 1) Intention », « 1. Le Point de Départ (…) »
    .replace(/\s+(?=\d+\)\s+[A-ZÀ-ÖØ-Ý])/g, '\n\n')
    .replace(
      /(\d+\)\s+[^.\n]{1,90}?\([^)\n]{1,80}\))\s+(?=[A-ZÀ-ÖØ-Ý«])/g,
      '$1\n\n',
    )
    .replace(/(\d+\)\s+[^.\n(]{2,80})\s+(?=[A-ZÀ-ÖØ-Ý«])/g, '$1\n\n')
    // Restaure la lisibilité des listes comprimées.
    .replace(/\s+[-•]\s+/g, '\n- ')
    // " ... 10 2. Distinction ..." -> nouveau bloc numéroté.
    .replace(/\s+\d{1,3}\s+(?=\d+\.\s+)/g, '\n\n')
    // Crée des paragraphes à partir des listes numérotées compactées.
    .replace(/\s+(?=\d+\.\s+[A-ZÀ-ÖØ-Ý])/g, '\n\n')
    // Titre suivi d'un " :" collé après une phrase.
    .replace(/([.!?…»”])\s+(?=[A-ZÀ-ÖØ-Ý][^.!?\n]{2,42}\s*:)/g, '$1\n\n')
    // Exemples « (Ex : … ) » -> bloc à part.
    .replace(/\s+(\(Ex(?:emple)?\s*:[\s\S]{1,500}?\))\s*(?=\s|$)/g, '\n\n$1\n\n')
    // Liste de définitions densifiée : « ... détails : Espace : pas d'obstacles … Ambiance : musique … »
    // On découpe avant chaque « Label : » court (≤ 14 chars, lettre capitale au début) répété.
    .replace(
      /([.!?…»”])\s+(?=[A-ZÀ-ÖØ-Ý][\p{L}'’-]{2,14}\s*:\s+\S)/gu,
      '$1\n\n',
    )
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

/** Surlignage discret + citations « » inline (gras) ou encadré selon le contexte. */
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
          className="text-violet-800/90 dark:text-violet-200/90"
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
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.startsWith('«') && part.endsWith('»') && part.length > 2) {
      const inner = part.slice(1, -1)
      const asInlineBold = shouldQuoteBeInlineBold(inner)
      if (asInlineBold) {
        out.push(
          <strong
            key={`${keyPrefix}-q-${qi}`}
            className="font-semibold text-slate-900 dark:text-slate-50"
          >
            «{applyGlossary(inner, `${keyPrefix}-qin-${qi}`)}»
          </strong>,
        )
      } else {
        out.push(
          <span key={`${keyPrefix}-q-${qi}`}>
            «{applyGlossary(inner, `${keyPrefix}-qin-${qi}`)}»
          </span>
        )
      }
      qi += 1
    } else if (part) {
      out.push(...applyGlossary(part, `${keyPrefix}-p-${qi++}`))
    }
  }
  if (out.length === 0) return null
  if (out.length === 1) return out[0]
  return <>{out}</>
}

const INLINE_BOLD_MAX_LEN = 28
const INLINE_BOLD_MAX_WORDS = 3

/** Gras inline uniquement pour un mot ou une très courte expression (ex. « tester »). */
function shouldQuoteBeInlineBold(inner: string): boolean {
  const t = inner.trim()
  if (!t || t.length > INLINE_BOLD_MAX_LEN) return false
  if (/[.!?…]/.test(t)) return false
  if (t.split(/\s+/).filter(Boolean).length > INLINE_BOLD_MAX_WORDS) return false
  return true
}

const MANUAL_SECTION_RE =
  /^(Cartes utilisées(?:\s*\([^)]+\))?|Usage|Liberté de Pratique|Mise en place(?:\s*\([^)]+\))?|Intention|Lecture|Matériel nécessaire|Déroulé(?:\s*\([^)]+\))?|Pourquoi [^:]{2,60}|Synthèse|Cadre et limites|Rôle du facilitateur|Écueils classiques[^:]{0,30}|Phrase de Synthèse)\s*:?\s*([\s\S]*)$/i

function parseManualSection(chunk: string): { label: string; body: string } | null {
  const m = chunk.trim().match(MANUAL_SECTION_RE)
  if (!m) return null
  return { label: m[1].trim(), body: (m[2] || '').trim() }
}

/** Reconnait des intertitres seuls : « Objectif », « Intention », « Mise en place », etc. */
const STANDALONE_HEADING_LV2 = /^(Introduction|Objectif|En Conclusion|Cadre et limites)$/i
const STANDALONE_HEADING_LV3 =
  /^(Intention|Mise en place(?:\s*\([^)]+\))?|Lecture|Matériel nécessaire|Déroulé(?:\s*\([^)]+\))?|Pourquoi [^:]{2,80}|Rôle du facilitateur|Écueils classiques(?:\s*\([^)]+\))?|Jeu ouvert ou jeu fermé|Le Tirage(?:\s*\([^)]+\))?|Phrase de Synthèse(?:\s*\([^)]+\))?|Synthèse(?:\s*\([^)]+\))?|Usage|Liberté de Pratique)$/i

/** Détecte une ligne « Label : valeur » courte (< 18 chars de label). */
function detectShortLabel(line: string): { label: string; value: string } | null {
  const idx = line.indexOf(':')
  if (idx < 2 || idx > 32) return null
  const label = line.slice(0, idx).trim()
  const value = line.slice(idx + 1).trim()
  if (!label || !value) return null
  if (label.split(/\s+/).length > 4) return null
  if (/[.!?…»”]/.test(label)) return null
  return { label, value }
}

/** Extrait le titre « Niveau / Phase / Étape N : … » sans avaler tout le paragraphe. */
function splitNiveauPhaseHeading(s: string): { title: string; rest: string } | null {
  const t = s.trim()
  if (!/^(?:Phase|Étape|Niveau)\s+\d+\s*[:：]/i.test(t)) return null

  const withParen = t.match(
    /^((?:Phase|Étape|Niveau)\s+\d+\s*[:：][^(]{1,120}?\([^)]{1,80}\))\s+([\s\S]+)$/i,
  )
  if (withParen) return { title: withParen[1].trim(), rest: withParen[2].trim() }

  const toDot = t.match(/^((?:Phase|Étape|Niveau)\s+\d+\s*[:：][^.]{2,120}\.)\s+([\s\S]+)$/i)
  if (toDot) return { title: toDot[1].trim(), rest: toDot[2].trim() }

  if (t.length <= 96) return { title: t, rest: '' }

  return null
}
const MANUAL_BODY_CLASS =
  'text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-base'

function pushParagraphChunks(text: string, blocks: NarrativeBlock[]) {
  const t = text.trim()
  if (!t || isStandalonePageNumber(t)) return
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
  | { kind: 'definitions'; items: Array<{ label: string; value: string }> }
  | { kind: 'example'; text: string }

/** Détecte si un chunk est entièrement constitué de lignes « Label : valeur » courtes (3+). */
function parseDefinitionList(chunk: string): Array<{ label: string; value: string }> | null {
  const lines = chunk.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 3) return null
  const items: Array<{ label: string; value: string }> = []
  for (const line of lines) {
    const d = detectShortLabel(line)
    if (!d) return null
    if (d.value.length < 3 || d.value.length > 220) return null
    items.push(d)
  }
  return items
}

function buildNarrativeBlocks(raw: string): NarrativeBlock[] {
  const chunks = raw
    .split(/\n{2,}/)
    .map((c) => c.trim())
    .filter(Boolean)

  const blocks: NarrativeBlock[] = []
  let listBuffer: string[] = []

  const flushList = () => {
    if (!listBuffer.length) return
    blocks.push({ kind: 'list', items: listBuffer })
    listBuffer = []
  }

  for (const c of chunks) {
    if (isStandalonePageNumber(c)) continue

    // Exemple inline « (Ex : ... ) » -> encadré dédié.
    if (/^\(Ex(?:emple)?\s*:/i.test(c)) {
      flushList()
      const text = c.replace(/^\(Ex(?:emple)?\s*:\s*/i, '').replace(/\)\s*$/, '').trim()
      blocks.push({ kind: 'example', text })
      continue
    }

    const principles = parseNumberedPrinciples(c)
    if (principles && principles.items.length >= 2) {
      flushList()
      if (principles.intro) pushParagraphChunks(principles.intro, blocks)
      blocks.push({ kind: 'principles', items: principles.items })
      continue
    }

    const niveauSplit = splitNiveauPhaseHeading(c)
    if (niveauSplit) {
      flushList()
      blocks.push({ kind: 'heading', level: 4, text: niveauSplit.title })
      if (niveauSplit.rest) pushParagraphChunks(niveauSplit.rest, blocks)
      continue
    }

    if (/^Tirage à \d+ carte[s]?$/i.test(c.trim())) {
      flushList()
      blocks.push({ kind: 'heading', level: 4, text: c.trim() })
      continue
    }

    // Sous-titres « 1) Intention », « 2) Tirage des cartes (...) ».
    const numHead = c.match(/^(\d+)\)\s+([^\n.]{2,90})\s*$/)
    if (numHead) {
      flushList()
      blocks.push({ kind: 'heading', level: 4, text: `${numHead[1]}. ${numHead[2].trim()}` })
      continue
    }

    // Sous-titres « 1. Le Point de Départ (Cœur & Climat) » sans :
    const numHead2 = c.match(/^(\d+)\.\s+([^\n.:]{2,90}\([^)]{1,80}\))\s*$/)
    if (numHead2) {
      flushList()
      blocks.push({ kind: 'heading', level: 4, text: `${numHead2[1]}. ${numHead2[2].trim()}` })
      continue
    }

    const section = parseManualSection(c)
    if (section) {
      flushList()
      blocks.push({ kind: 'heading', level: 3, text: section.label })
      if (section.body) pushParagraphChunks(section.body, blocks)
      continue
    }

    const tTrim = c.trim()
    if (STANDALONE_HEADING_LV2.test(tTrim)) {
      flushList()
      blocks.push({ kind: 'heading', level: 2, text: tTrim })
      continue
    }
    if (STANDALONE_HEADING_LV3.test(tTrim)) {
      flushList()
      blocks.push({ kind: 'heading', level: 3, text: tTrim })
      continue
    }

    // Liste de définitions « Label : valeur \n Label : valeur ... »
    const defs = parseDefinitionList(c)
    if (defs) {
      flushList()
      blocks.push({ kind: 'definitions', items: defs })
      continue
    }

    const idx = c.indexOf(':')
    if (idx > 0 && idx < 28) {
      const label = c.slice(0, idx).trim()
      const value = c.slice(idx + 1).trim()
      if (label && value && /^(Exemple|Exemples|Principe|Usage|Astuce|Note|Règles? d'or|Toujours 8 cartes en main)$/i.test(label)) {
        flushList()
        blocks.push({ kind: 'callout', label, text: value })
        continue
      }
    }

    const isBullet = /^[-•]\s+/.test(c)
    if (isBullet) {
      listBuffer.push(c.replace(/^[-•]\s+/, '').trim())
      continue
    }
    flushList()
    pushParagraphChunks(c, blocks)
  }

  flushList()
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
        ) : b.kind === 'definitions' ? (
          <dl
            key={`${keyBase}-df-${i}`}
            className="not-italic grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-5 gap-y-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-900/40 p-4 sm:p-5"
          >
            {b.items.map((d, j) => (
              <div key={`${keyBase}-df-${i}-${j}`} className="contents">
                <dt className="font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-[15px] leading-7">
                  {d.label}
                </dt>
                <dd className="text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-200">
                  {renderManualInline(d.value, `${keyBase}-dfv-${i}-${j}`)}
                </dd>
              </div>
            ))}
          </dl>
        ) : b.kind === 'example' ? (
          <div
            key={`${keyBase}-ex-${i}`}
            className="not-italic rounded-xl border-l-[3px] border-amber-400/70 bg-amber-50/60 dark:border-amber-500/60 dark:bg-amber-950/20 pl-4 pr-4 py-3"
          >
            <span className="inline-flex items-center rounded-full border border-amber-300/80 bg-white/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-700/70 dark:bg-slate-900 dark:text-amber-300">
              Exemple
            </span>
            <p className={`mt-2 ${MANUAL_BODY_CLASS}`}>
              {renderManualInline(b.text, `${keyBase}-ext-${i}`)}
            </p>
          </div>
        ) : b.kind === 'heading' ? (
          b.level === 2 ? (
            <h2
              key={`${keyBase}-h-${i}`}
              className="not-italic pt-3 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl"
            >
              {b.text}
            </h2>
          ) : b.level === 3 ? (
            <h3
              key={`${keyBase}-h-${i}`}
              className="not-italic pt-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-xl"
            >
              {b.text}
            </h3>
          ) : (
            <h4
              key={`${keyBase}-h-${i}`}
              className="not-italic pt-1 text-[15px] font-semibold uppercase tracking-[0.08em] text-violet-700 dark:text-violet-300 sm:text-base"
            >
              {b.text}
            </h4>
          )
        ) : b.kind === 'callout' ? (
          <div
            key={`${keyBase}-co-${i}`}
            className="not-italic rounded-xl border border-sky-200/70 bg-sky-50/60 p-3 dark:border-sky-900/60 dark:bg-sky-950/20"
          >
            <span className="inline-flex items-center rounded-full border border-sky-200 bg-white/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300">
              {b.label}
            </span>
            {b.text ? (
              <p className={`mt-2 ${MANUAL_BODY_CLASS}`}>
                {renderManualInline(b.text, `${keyBase}-cot-${i}`)}
              </p>
            ) : null}
          </div>
        ) : b.kind === 'list' ? (
          <ul
            key={`${keyBase}-ul-${i}`}
            className="list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-base marker:text-violet-500/70"
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
                : MANUAL_BODY_CLASS
            }
          >
            {renderManualInline(b.text, `${keyBase}-pt-${i}`)}
          </p>
        ),
      )}
    </>
  )
}

function narrativeTextFrom(raw: string): string {
  return stripPageAnnotations(prepareNarrativeText(raw))
}

/** Extrait, le cas échéant, une question entre guillemets en fin de section « Question Racine ». */
function extractQuotedQuestion(raw: string): { quote: string | null; rest: string } {
  const m = raw.match(/«\s*([^»]{4,300}\?)\s*»/u)
  if (!m) return { quote: null, rest: raw.trim() }
  return {
    quote: m[1].trim(),
    rest: (raw.slice(0, m.index!) + raw.slice(m.index! + m[0].length)).trim(),
  }
}

/** Encadré « Au verso de la carte » : présentation de la signification courte imprimée au dos. */
function CardVerso({ text }: { text: string }) {
  return (
    <aside className="not-italic rounded-2xl border border-amber-200/70 dark:border-amber-700/40 bg-gradient-to-br from-amber-50/70 to-rose-50/40 dark:from-amber-950/20 dark:to-rose-950/15 p-4 sm:p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
        Au verso de la carte
      </p>
      <p className="mt-2 text-sm sm:text-[15px] leading-7 text-slate-700 dark:text-slate-200 italic">
        {text}
      </p>
    </aside>
  )
}

/** Détecte un sous-titre entre parenthèses en tête du corps (ex. « (Charte d'Utilisation Éthique) »). */
function splitLeadingParenSubtitle(body: string): { sub: string | null; rest: string } {
  const m = body.match(/^\s*\(([^)\n]{4,90})\)\s*/)
  if (!m) return { sub: null, rest: body }
  return { sub: m[1].trim(), rest: body.slice(m[0].length).trimStart() }
}

/** Reformate l'Herbier des Mots-Clés (chapitre 94) : extraction des entrées par carte. */
function buildHerbierEntries(
  raw: string,
): Array<{ name: string; family?: string; light: string; shadow: string; question: string }> {
  const cards = ALL_CARDS.map((c) => c.name).sort((a, b) => b.length - a.length)
  type Hit = { name: string; start: number; end: number }
  const hits: Hit[] = []
  for (const name of cards) {
    const upper = name.toUpperCase()
    const escaped = upper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]")
    const re = new RegExp(`(?:^|\\s|\\)\\s)(${escaped})(?=[A-ZÀ-ÖØ-Ýa-zà-öø-ý])`, 'gu')
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) {
      const start = (m.index ?? 0) + m[0].length - m[1].length
      hits.push({ name, start, end: start + m[1].length })
    }
  }
  hits.sort((a, b) => a.start - b.start)
  // Filtre les chevauchements (préfère le plus long match qui inclut un plus court).
  const filtered: Hit[] = []
  for (const h of hits) {
    const last = filtered[filtered.length - 1]
    if (!last || h.start >= last.end) filtered.push(h)
  }
  const entries: Array<{ name: string; family?: string; light: string; shadow: string; question: string }> = []
  for (let i = 0; i < filtered.length; i++) {
    const h = filtered[i]
    const next = filtered[i + 1]
    const segmentEnd = next ? next.start : raw.length
    let segment = raw.slice(h.end, segmentEnd).trim()
    // Récupère un éventuel préfixe famille (Terre), (Eau), etc. avant le nom.
    const before = raw.slice(Math.max(0, h.start - 12), h.start)
    const famMatch = before.match(/\(([^)]{2,30})\)\s*$/)
    const family = famMatch ? famMatch[1].trim() : undefined
    // Retire pieds de page « 19X » et libellés de cycle en fin de segment.
    segment = segment
      .replace(/\s+\d{1,3}(?=\s+CarteLumière|\s*$)/g, ' ')
      .replace(/\s+Carte\s*Lumière[^?]*$/i, ' ')
      .replace(/\s+(?:Le\s+)?Cycle\s+(?:du|de\s+(?:la|l[’'])?)\s*[^()]{2,40}\s*\([^)]+\)\s*\d{0,4}\s*$/i, ' ')
      .replace(/\s+La Fleur d[’'´`]ÅmÔurs[^?]*$/i, ' ')
      .replace(/\s+Les Éléments\s*\d{0,4}\s*$/i, ' ')
      .replace(/\s+Rejoindre les jardiniers[\s\S]*$/i, ' ')
      .trim()
    // Découpe en (Lumière, Ombre, Question).
    const qm = segment.match(/[^?]+\?\s*$/)
    if (!qm) continue
    const question = qm[0].trim()
    const lightShadow = segment.slice(0, segment.length - question.length).trim()
    // Cherche une frontière probable entre lumière (mots-clés positifs) et ombre.
    // Heuristique : on coupe à la dernière virgule avant le mot capitalisé qui démarre l'ombre.
    const parts = lightShadow.split(/,\s+/)
    if (parts.length < 3) continue
    // On suppose que la moitié = lumière, l'autre = ombre.
    const mid = Math.floor(parts.length / 2)
    const light = parts.slice(0, mid).join(', ').trim()
    const shadow = parts.slice(mid).join(', ').trim()
    if (!light || !shadow) continue
    entries.push({ name: h.name, family, light, shadow, question })
  }
  return entries
}

function HerbierTable({ entries }: { entries: ReturnType<typeof buildHerbierEntries> }) {
  if (!entries.length) return null
  return (
    <div className="mt-6 space-y-3">
      {entries.map((e, i) => (
        <article
          key={`${e.name}-${i}`}
          className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/45 p-4 sm:p-5 shadow-sm"
        >
          <header className="flex flex-wrap items-baseline gap-2 mb-3">
            <h3 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {e.name}
            </h3>
            {e.family ? (
              <span className="text-[11px] uppercase tracking-wide text-violet-700 dark:text-violet-300">
                {e.family}
              </span>
            ) : null}
          </header>
          <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-5 gap-y-2 text-sm leading-7">
            <dt className="font-semibold text-emerald-700 dark:text-emerald-300">Lumière</dt>
            <dd className="text-slate-700 dark:text-slate-200">{e.light}</dd>
            <dt className="font-semibold text-slate-600 dark:text-slate-400">Ombre</dt>
            <dd className="text-slate-700 dark:text-slate-200">{e.shadow}</dd>
            <dt className="font-semibold text-amber-700 dark:text-amber-300">Question Racine</dt>
            <dd className="italic text-slate-800 dark:text-slate-100">{e.question}</dd>
          </dl>
        </article>
      ))}
    </div>
  )
}

function isHerbierTitle(title?: string): boolean {
  if (!title) return false
  return /Herbier\s+des\s+Mots-?Cl[éeè]s/i.test(title)
}

function ChapterBody({ text, title, locale = 'fr' }: { text: string; title?: string; locale?: string }) {
  if (!text) return null

  // 1) Normalisations typographiques, suppression doublon de titre, extraction verso.
  let working = normalizeTypography(text)
  working = stripDuplicatedTitle(working, title)

  // 2) Cas spécial : Herbier des Mots-Clés (tableau extrait du PDF).
  if (isHerbierTitle(title)) {
    const entries = buildHerbierEntries(working)
    if (entries.length >= 5) {
      return <HerbierTable entries={entries} />
    }
  }

  const { body: bodyAfterVerso, verso } = extractCardVerso(working, title)
  const { sub: leadSub, rest: bodyAfterLead } = splitLeadingParenSubtitle(bodyAfterVerso)
  const displayText = stripPageAnnotations(bodyAfterLead)

  const sections = findSections(displayText, locale)

  const Subtitle = leadSub ? (
    <p className="mt-2 text-base sm:text-lg italic text-slate-600 dark:text-slate-300">
      {leadSub}
    </p>
  ) : null

  // Cas spécial : chapitre court (1 à 2 phrases) -> épigraphe centrée, pas d'encadré gris.
  if (!sections.length && displayText.length < 280) {
    const narrativeText = narrativeTextFrom(displayText)
    const blocks = buildNarrativeBlocks(narrativeText)
    return (
      <div className="mt-8 sm:mt-10 space-y-6">
        {Subtitle}
        {verso ? <CardVerso text={verso} /> : null}
        <div className="mx-auto max-w-2xl text-center space-y-3">
          <ManualNarrativeBlocks blocks={blocks} isCycleIntro keyBase="short" />
        </div>
      </div>
    )
  }

  if (!sections.length) {
    const narrativeText = narrativeTextFrom(displayText)
    const blocks = buildNarrativeBlocks(narrativeText)
    const isCycleIntro = isCycleIntroTitle(title) && blocks.length <= 2
    return (
      <div className="mt-6 space-y-6">
        {Subtitle}
        {verso ? <CardVerso text={verso} /> : null}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/35 p-4 sm:p-6 shadow-sm">
          <div className={isCycleIntro ? 'space-y-3 text-center' : 'space-y-4'}>
            <ManualNarrativeBlocks blocks={blocks} isCycleIntro={isCycleIntro} keyBase="flow" />
          </div>
        </div>
      </div>
    )
  }

  const intro = displayText.slice(0, sections[0].start).trim()
  const rawBlocks = sections.map((s, i) => {
    const next = sections[i + 1]
    const content = displayText
      .slice(s.end, next ? next.start : displayText.length)
      .trim()
    return { ...s, content }
  })

  // Force l'ordre éditorial canonique (description → … → question) lorsque la fiche correspond
  // au modèle des cartes (au moins 4 sections reconnues parmi l'ordre).
  const recognized = rawBlocks.filter((b) => CARD_SECTION_ORDER[b.key] != null).length
  const blocks =
    recognized >= 4
      ? [...rawBlocks].sort((a, b) => {
          const oa = CARD_SECTION_ORDER[a.key] ?? 99
          const ob = CARD_SECTION_ORDER[b.key] ?? 99
          if (oa !== ob) return oa - ob
          return a.start - b.start
        })
      : rawBlocks

  return (
    <div className="mt-7 space-y-6 sm:space-y-7">
      {Subtitle}
      {verso ? <CardVerso text={verso} /> : null}

      {intro ? (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/35 p-4 sm:p-6 shadow-sm">
          <div className="space-y-4">
            <ManualNarrativeBlocks
              blocks={buildNarrativeBlocks(narrativeTextFrom(intro))}
              isCycleIntro={false}
              keyBase="intro"
            />
          </div>
        </div>
      ) : null}

      {blocks.map((b, idx) => {
        if (b.key === 'light' || b.key === 'shadow') {
          const items = splitKeywords(b.content)
          const isShadow = b.key === 'shadow'
          return (
            <section
              key={`${b.key}-${idx}`}
              className={
                isShadow
                  ? 'rounded-2xl border border-slate-300/70 dark:border-slate-700/70 bg-slate-100/70 dark:bg-slate-900/45 p-4 sm:p-5 shadow-sm'
                  : 'rounded-2xl border border-violet-200/70 dark:border-violet-800/60 bg-violet-50/70 dark:bg-violet-950/25 p-4 sm:p-5 shadow-sm'
              }
            >
              <h3
                className={
                  isShadow
                    ? 'text-[11px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300'
                    : 'text-[11px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300'
                }
              >
                {b.label}
              </h3>
              <div className="mt-3.5 flex flex-wrap gap-2.5">
                {items.map((item) => (
                  <span
                    key={`${b.key}-${item}`}
                    className={
                      isShadow
                        ? 'px-3 py-1 rounded-full text-xs sm:text-sm bg-white dark:bg-slate-900/90 border border-slate-300/80 dark:border-slate-700 text-slate-700 dark:text-slate-100'
                        : 'px-3 py-1 rounded-full text-xs sm:text-sm bg-white dark:bg-slate-900/90 border border-violet-200/80 dark:border-violet-800 text-slate-700 dark:text-slate-100'
                    }
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>
          )
        }

        if (b.key === 'question') {
          // Règle éditoriale : la Question Racine ne contient QUE la question entre guillemets.
          // Tout texte additionnel (souvent un doublon de pied de page) est ignoré.
          const { quote } = extractQuotedQuestion(b.content)
          const fallback = !quote ? b.content.trim().replace(/^[«"”\s]+|[»"”\s]+$/g, '') : ''
          return (
            <section
              key={`${b.key}-${idx}`}
              className="rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/25 p-4 sm:p-6 shadow-sm"
            >
              <h3 className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                {b.label}
              </h3>
              {quote ? (
                <blockquote className="mt-3 border-l-[3px] border-amber-400/70 pl-4 py-1 text-base sm:text-lg leading-relaxed italic text-slate-800 dark:text-amber-50">
                  «&nbsp;{quote}&nbsp;»
                </blockquote>
              ) : fallback ? (
                <blockquote className="mt-3 border-l-[3px] border-amber-400/70 pl-4 py-1 text-base sm:text-lg leading-relaxed italic text-slate-800 dark:text-amber-50">
                  «&nbsp;{fallback}&nbsp;»
                </blockquote>
              ) : null}
            </section>
          )
        }

        if (b.key === 'energy') {
          const fields = parseEnergyFields(b.content, locale)
          return (
            <section key={`${b.key}-${idx}`} className="space-y-3.5">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {b.label}
              </h2>
              {fields.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {fields.map((f) => (
                    <div
                      key={`${f.label}-${f.value}`}
                      className="rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/65 p-3.5"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {f.label}
                      </p>
                      <div className="mt-1.5 text-sm leading-7 text-slate-800 dark:text-slate-100 sm:text-[15px]">
                        {renderManualInline(f.value, `en-${idx}-${f.label}`)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <ManualNarrativeBlocks
                    blocks={buildNarrativeBlocks(narrativeTextFrom(b.content))}
                    isCycleIntro={false}
                    keyBase={`en-fallback-${idx}`}
                  />
                </div>
              )}
            </section>
          )
        }

        // « Description étendue », « Ombre », « Chemins d'intégration », « Résonance de l'Âme »,
        // « Exercice / Méditation » : isole un éventuel sous-titre court (1ʳᵉ ligne) du corps.
        const lead = splitLeadSubheading(b.content, b.key)
        const accent =
          b.key === 'description'
            ? 'text-violet-700 dark:text-violet-300'
            : b.key === 'ombre'
              ? 'text-slate-600 dark:text-slate-300'
              : b.key === 'integration'
                ? 'text-emerald-700 dark:text-emerald-300'
                : b.key === 'resonance'
                  ? 'text-indigo-700 dark:text-indigo-300'
                  : b.key === 'exercise'
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-slate-700 dark:text-slate-200'
        return (
          <section key={`${b.key}-${idx}`} className="space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {b.label}
            </h2>
            {lead.sub ? (
              <p className={`text-base sm:text-lg italic font-medium ${accent}`}>{lead.sub}</p>
            ) : null}
            {lead.rest ? (
              <div className="space-y-4">
                <ManualNarrativeBlocks
                  blocks={buildNarrativeBlocks(narrativeTextFrom(lead.rest))}
                  isCycleIntro={false}
                  keyBase={`sec-${b.key}-${idx}`}
                />
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

export default function ManuelOnlinePage({ chapterSlug }: { chapterSlug?: string }) {
  const router = useRouter()
  const storeLocale = useStore((s) => s.locale)
  const contentLocale = normalizeManuelLocale(storeLocale || getLocale())
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
    const localesToTry = contentLocale === 'fr' ? ['fr'] : [contentLocale, 'fr']

    async function loadChapter() {
      for (const loc of localesToTry) {
        const url = getManuelAssetUrl(`/${encodeURIComponent(base)}.md`, loc)
        try {
          const r = await fetch(url)
          if (!r.ok) continue
          const text = await r.text()
          if (!cancelled) {
            setChapterRaw(text)
            setChapterErr(null)
          }
          return
        } catch {
          /* essai locale suivante */
        }
      }
      if (!cancelled) {
        setChapterRaw(null)
        setChapterErr('notfound')
      }
    }

    void loadChapter()
    return () => {
      cancelled = true
    }
  }, [base, contentLocale])

  useLayoutEffect(() => {
    if (base) {
      scrollManuelMainToTop()
      return
    }
    if (!manifest?.sections?.length) return
    restoreManuelTocScroll()
  }, [base, manifest])

  useEffect(() => {
    if (base) return undefined
    if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual'
    }
    const main = findManuelScrollContainer()
    if (!main) return undefined
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => syncManuelTocScrollTop())
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      main.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [base])

  const openChapter = useCallback(
    (file: string, fromEl: HTMLElement) => {
      rememberManuelTocReturn(manuelTocAnchorFromFile(file), fromEl)
      const slug = manuelChapterBaseName(file)
      router.push(`/cartes/${encodeURIComponent(slug)}`, { scroll: false })
    },
    [router],
  )

  const goToToc = useCallback(() => {
    const pending = getPendingTocReturn()
    const href = pending?.anchor ? `/cartes#${pending.anchor}` : '/cartes'
    router.push(href, { scroll: false })
  }, [router])

  useEffect(() => {
    if (base || !manifest?.sections?.length) return undefined
    const id = window.setTimeout(() => restoreManuelTocScroll(), 300)
    return () => window.clearTimeout(id)
  }, [base, manifest])

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

  const hrefFor = useCallback((file: string) => {
    const slug = manuelChapterBaseName(file)
    return `/cartes/${encodeURIComponent(slug)}`
  }, [])

  const resolveSectionTitle = useCallback(
    (section: ManuelManifestSection) => canonicalManualTitle(manuelSectionTitle(section)),
    [],
  )

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
      <div className="max-w-6xl mx-auto flex flex-col gap-5 sm:gap-6 min-h-0 min-w-0 w-full">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {t('manuel.title')}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {t('manuel.carto.lead')}
            </p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('manuel.search')}
            className="w-full sm:w-72 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm shadow-sm"
            aria-label={t('manuel.search')}
          />
        </header>

        <ManuelCartography
          sections={manifest.sections}
          hrefFor={hrefFor}
          openChapter={openChapter}
          query={query}
          canonicalTitle={(raw) => canonicalManualTitle(raw)}
          sectionTitle={resolveSectionTitle}
          cardImageFor={(title) => cardsByNormName.get(normCardKey(title))?.img}
        />
      </div>
    )
  }

  if (chapterErr === 'notfound' || !chapterRaw) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-4">{t('manuel.empty')}</p>
        <button
          type="button"
          onClick={goToToc}
          className="text-violet-600 dark:text-violet-400 font-medium hover:underline"
        >
          {t('manuel.backToc')}
        </button>
      </div>
    )
  }

  const parsed = parseChapterMarkdown(chapterRaw)
  const displayTitle = canonicalManualTitle(
    parsed.title || (current ? manuelSectionTitle(current) : base),
  )
  const matchedCard = cardsByNormName.get(normCardKey(displayTitle))
  const cardImageUrl = matchedCard?.img

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
        <button
          type="button"
          onClick={goToToc}
          className="text-violet-600 dark:text-violet-400 font-medium hover:underline shrink-0"
        >
          ← {t('manuel.toc')}
        </button>
      </div>

      <nav className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 pb-4 sm:pb-5 border-b border-slate-200 dark:border-slate-800">
        {prevS ? (
          <Link
            href={hrefFor(prevS.file)}
            className="flex flex-col px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/30 hover:border-violet-400/50 hover:bg-violet-500/5 transition-colors sm:max-w-[48%]"
          >
            <span className="text-xs uppercase tracking-wide text-slate-400">{t('manuel.prev')}</span>
            <span className="font-medium text-slate-800 dark:text-slate-100" translate="no">
              {prevS ? resolveSectionTitle(prevS) : ''}
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
              {nextS ? resolveSectionTitle(nextS) : ''}
            </span>
          </Link>
        ) : null}
      </nav>

      <article className="rounded-3xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-900/45 p-4 sm:p-8 md:p-10 shadow-md">
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
        <ChapterBody text={parsed.body} title={displayTitle} locale={contentLocale} />
      </article>

      <nav className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 mt-8 sm:mt-10 pt-6 sm:pt-7 border-t border-slate-200 dark:border-slate-800">
        {prevS ? (
          <Link
            href={hrefFor(prevS.file)}
            className="flex flex-col px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/30 hover:border-violet-400/50 hover:bg-violet-500/5 transition-colors sm:max-w-[48%]"
          >
            <span className="text-xs uppercase tracking-wide text-slate-400">{t('manuel.prev')}</span>
            <span className="font-medium text-slate-800 dark:text-slate-100" translate="no">
              {prevS ? resolveSectionTitle(prevS) : ''}
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
              {nextS ? resolveSectionTitle(nextS) : ''}
            </span>
          </Link>
        ) : null}
      </nav>
    </div>
  )
}
