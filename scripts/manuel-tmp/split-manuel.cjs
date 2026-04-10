/**
 * Sommaire (TOC) + texte linéaire pdf-parse (_source_extracted.txt) → docs/MANUEL/*.md
 *
 * Les numéros du sommaire ne coïncident pas avec les indices de pages du fichier PDF :
 * le découpage par plage pdfjs mélangeait des chapitres (ex. Tirages / Jeux / Dessiner).
 * On repère chaque titre du TOC dans l’ordre du flux extrait (pdf-parse), puis on coupe
 * au titre suivant. pdfjs sert uniquement à estimer les pages PDF réelles pour le manifeste.
 */
const fs = require('fs')
const path = require('path')

const pdfjs = require('pdfjs-dist/legacy/build/pdf.js')
pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
  'pdfjs-dist/legacy/build/pdf.worker.js',
)

function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'section'
}

function normalizeApo(s) {
  return s.replace(/[\u2019']/g, "'")
}

function normSpace(s) {
  return normalizeApo(s).replace(/\s+/g, ' ').trim()
}

/** Pour repérer les titres dans le PDF : tiret coupé par un saut de ligne → tiret serré. */
function normForMatch(s) {
  return normalizeApo(s).replace(/-\s+/g, '-').replace(/\s+/g, ' ').trim()
}

function parseTocFromExtracted(txt) {
  const lines = txt.split(/\r?\n/)
  let start = lines.findIndex((l) => /^Le Sol Fertile du Jardin/.test(l.trim()))
  let end = lines.findIndex((l) => /^Crédits\s+\d+/.test(l.trim()))
  if (start < 0) start = 0
  if (end < 0) end = lines.length
  const slice = lines.slice(start, end + 1)
  const entries = []
  const re = /^(.+?)\s+(\d{1,3})\s*$/
  for (const line of slice) {
    const t = line.trim()
    if (!t || t === 'Sommaire') continue
    const m = t.match(re)
    if (!m) continue
    const title = m[1].trim()
    const pn = parseInt(m[2], 10)
    if (title.length < 3) continue
    if (/^\d+$/.test(title)) continue
    entries.push({ title, bookPage: pn })
  }
  const seen = new Set()
  const unique = []
  for (const e of entries) {
    const k = e.title + '|' + e.bookPage
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(e)
  }
  unique.sort((a, b) => a.bookPage - b.bookPage)
  return unique
}

function findOffset(pageTexts, firstTocTitle) {
  const needle = normSpace(firstTocTitle).slice(0, 36)
  for (let i = 0; i < pageTexts.length; i++) {
    const t = normSpace(pageTexts[i])
    if (!t.includes(needle)) continue
    // Ignorer les pages sommaire (plusieurs entrées collées sur une même page).
    if (t.length > 400) continue
    return i + 1
  }
  return 1
}

function bookPageToPdfIndex(bookPage, offset, numPages) {
  const pdf1 = bookPage - offset
  const i = pdf1 - 1
  if (i < 0) return 0
  if (i >= numPages) return numPages - 1
  return i
}

function looksLikeUpperCardSlug(t) {
  const words = normSpace(t).split(/\s+/).filter(Boolean)
  if (!words.length) return false
  return words.every((w) => {
    if (/^\d/.test(w)) return false
    const letters = w.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '')
    return letters.length === 0 || letters === letters.toUpperCase()
  })
}

function titleSearchPattern(title) {
  const t = normForMatch(title).slice(0, 48)
  if (t.length < 4) return null
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (t.length < 22 && looksLikeUpperCardSlug(t)) {
    return new RegExp(esc(t))
  }
  if (t.length < 14) {
    return new RegExp(esc(t), 'i')
  }
  const parts = t.split(/\s+/).map((w) => esc(w))
  // Sans flag i : évite qu’un titre « La Fleur d’ÅmÔurs » accroche « la Fleur » dans un paragraphe.
  return new RegExp(parts.join('\\s+'))
}

function titleSearchPatternLoose(title) {
  const strict = titleSearchPattern(title)
  if (!strict) return null
  const t = normForMatch(title).slice(0, 48)
  if (t.length < 14 || (t.length < 22 && looksLikeUpperCardSlug(t))) return strict
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = t.split(/\s+/).map((w) => esc(w))
  return new RegExp(parts.join('\\s+'), 'i')
}

/** Sommaire ≠ libellé sur la page (pluriel / singulier, etc.). */
const TOC_BODY_ALIASES = {
  'LES BRAISES': ['LA BRAISE'],
}

/** Le corps commence avant le titre affiché (sous-titre / accroche). */
const TOC_START_PREFIXES = [
  {
    when: (t) => /^Dessiner\s+Sa\s+Fleur/i.test(t),
    first: ["Proposition d'expression inspirée de l'art-thérapie"],
  },
]

/** Le sommaire ajoute parfois « 1. », « 2. » devant un titre absent du corps du livre. */
function tocTitleVariants(title) {
  const t = normForMatch(title)
  const out = []
  for (const rule of TOC_START_PREFIXES) {
    if (rule.when(t)) for (const f of rule.first) out.push(normForMatch(f))
  }
  out.push(t)
  const stripped = t.replace(/^\d+\.\s+/, '').trim()
  if (stripped && stripped !== t) out.push(stripped)
  const aliases = TOC_BODY_ALIASES[t]
  if (aliases) for (const a of aliases) out.push(normForMatch(a))
  return out
}

function firstMatchFrom(cursor, work, title) {
  const sub = work.slice(cursor)
  for (const variant of tocTitleVariants(title)) {
    let re = titleSearchPattern(variant)
    if (!re) continue
    let m = re.exec(sub)
    if (m) return { index: cursor + m.index, len: m[0].length }
    if (normForMatch(variant).length >= 14 && !looksLikeUpperCardSlug(normForMatch(variant).slice(0, 22))) {
      re = titleSearchPatternLoose(variant)
      if (!re) continue
      m = re.exec(sub)
      if (m) return { index: cursor + m.index, len: m[0].length }
    }
  }
  return null
}

function findPageDescriptionMarker(work, cursor, bookPage) {
  if (!Number.isFinite(bookPage)) return null
  const sub = work.slice(cursor)
  const re = new RegExp(`(?:^|\\s)${bookPage}\\s+Description\\s+[eé]tendue\\s*:`, 'i')
  const m = re.exec(sub)
  if (!m) return null
  const rel = m.index + m[0].search(/\d/)
  return { index: cursor + rel, len: String(bookPage).length }
}

/** Découpe sur texte normalisé (apostrophes / espaces PDF). */
function clipBeforeNextTitle(body, nextTitle) {
  if (!nextTitle || !body) return body
  const re = titleSearchPattern(nextTitle)
  if (!re) return body
  const n = normSpace(body)
  const m = n.match(re)
  if (!m || m.index <= 0) return body
  return n.slice(0, m.index).trimEnd()
}

function trimFromTitle(body, title) {
  if (!title || !body) return body
  const re = titleSearchPattern(title)
  if (!re) return body
  const n = normSpace(body)
  const m = n.match(re)
  if (!m) return body
  return n.slice(m.index).trimStart()
}

function extractedBodyOnly(full) {
  const mark = full.search(/\n6\s*\nLa Genèse du Tarot/i)
  if (mark > 0) return full.slice(mark)
  return full
}

/** Début du corps du livre : 2e occurrence du titre (après le bloc sommaire). */
function sequentialBodyStart(full) {
  const needle = 'Le Sol Fertile du'
  let pos = 0
  let idx = -1
  for (let k = 0; k < 2; k++) {
    idx = full.indexOf(needle, pos)
    if (idx < 0) return 0
    pos = idx + needle.length
  }
  return idx
}

/**
 * Positions de chaque entrée TOC dans le flux normalisé, dans l’ordre du document.
 */
function sequentialTitlePositions(work, toc) {
  const positions = []
  let cursor = 0
  for (let i = 0; i < toc.length; i++) {
    const hit = firstMatchFrom(cursor, work, toc[i].title)
    if (!hit) {
      throw new Error(
        `Impossible de repérer le titre « ${toc[i].title} » (index ${i}) dans le flux extrait. ` +
          'Vérifiez _source_extracted.txt ou le sommaire.',
      )
    }
    let startIndex = hit.index
    if (looksLikeUpperCardSlug(normForMatch(toc[i].title))) {
      const marker = findPageDescriptionMarker(work, cursor, toc[i].bookPage)
      if (marker && marker.index <= hit.index && hit.index - marker.index < 2200) {
        startIndex = marker.index
      }
    }
    positions.push(startIndex)
    cursor = startIndex + hit.len
  }
  return positions
}

function sliceBodiesSequential(full, toc) {
  const start = sequentialBodyStart(full)
  const work = normForMatch(full.slice(start))
  const pos = sequentialTitlePositions(work, toc)
  const bodies = []
  for (let i = 0; i < toc.length; i++) {
    let end = i + 1 < toc.length ? pos[i + 1] : work.length
    if (i + 1 < toc.length && looksLikeUpperCardSlug(normForMatch(toc[i + 1].title))) {
      const marker = findPageDescriptionMarker(work, pos[i], toc[i + 1].bookPage)
      if (marker && marker.index > pos[i] && marker.index < end) end = marker.index
    }
    bodies.push(work.slice(pos[i], end).trim())
  }
  return bodies
}

/** Estime la page PDF (1-based) où commence le texte d’une section. */
function guessPdfPageForBody(body, pageTexts) {
  const n = normForMatch(body)
  if (n.length < 24) return null
  const needle = n.slice(0, Math.min(72, n.length))
  for (let i = 0; i < pageTexts.length; i++) {
    const p = normSpace(pageTexts[i])
    if (p.includes(needle.slice(0, 36))) return i + 1
  }
  for (let i = 0; i < pageTexts.length; i++) {
    const p = normSpace(pageTexts[i])
    if (p.includes(needle.slice(0, 24))) return i + 1
  }
  return null
}

async function main() {
  const pdfPath = process.argv[2]
  const outDir = process.argv[3]
  if (!pdfPath || !outDir) {
    console.error('Usage: node split-manuel.cjs <file.pdf> <outDir>')
    process.exit(1)
  }

  const extractPath = path.join(outDir, '_source_extracted.txt')
  if (!fs.existsSync(extractPath)) {
    console.error('Missing', extractPath, '— run extract.cjs first')
    process.exit(1)
  }

  const extractedFull = fs.readFileSync(extractPath, 'utf8')
  const toc = parseTocFromExtracted(extractedFull).filter(
    (e) => normForMatch(e.title).replace(/\s+/g, ' ').toLowerCase() !== 'crédits',
  )
  if (!toc.length) {
    console.error('No TOC entries parsed')
    process.exit(1)
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise
  const numPages = doc.numPages
  const pageTexts = []
  for (let p = 1; p <= numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    pageTexts.push(tc.items.map((it) => it.str || '').join(' '))
  }

  const bodies = sliceBodiesSequential(extractedFull, toc)

  const sections = []
  fs.mkdirSync(outDir, { recursive: true })

  for (let i = 0; i < toc.length; i++) {
    const { title, bookPage } = toc[i]
    let j = i + 1
    while (j < toc.length && toc[j].bookPage === bookPage) j++
    const nextDistinct = toc[j]
    const body = bodies[i] || ''
    const gStart = guessPdfPageForBody(body, pageTexts)
    const nextBody = bodies[i + 1]
    const gEndExclusive = nextBody ? guessPdfPageForBody(nextBody, pageTexts) : null
    let pdfStart1 = gStart ?? Math.min(Math.max(1, bookPage), numPages)
    let pdfEnd1 =
      gEndExclusive != null
        ? Math.max(pdfStart1, gEndExclusive - 1)
        : Math.min(numPages, pdfStart1 + 2)
    if (gEndExclusive != null && gEndExclusive <= pdfStart1) pdfEnd1 = Math.min(numPages, pdfStart1)

    const id = slugify(title)
    const ord = String(i + 1).padStart(2, '0')
    const file = `${ord}-${id}.md`
    sections.push({
      id,
      title,
      bookPage,
      pdfStart1,
      pdfEnd1,
      file,
    })
    const md =
      `# ${title}\n\n` +
      `> Pages livre (sommaire) : ${bookPage}` +
      (nextDistinct ? `–${nextDistinct.bookPage - 1}` : '') +
      ` · PDF p. ${pdfStart1}–${pdfEnd1} (estimé depuis le texte extrait)\n\n` +
      body +
      '\n'
    fs.writeFileSync(path.join(outDir, file), md, 'utf8')
  }

  const manifest = {
    source: path.basename(pdfPath),
    generatedAt: new Date().toISOString(),
    pdfPages: numPages,
    bookToPdfOffset: null,
    splitMode: 'sequential-toc-in-pdf-parse-text',
    sections,
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')

  const tocMd = [
    '# Manuel — Tarot Fleur d’ÅmÔurs',
    '',
    '> Fichiers générés à partir du PDF et du sommaire (`_source_extracted.txt`).',
    '',
    '## Table des matières',
    '',
    ...sections.map((s, idx) => `${idx + 1}. [${s.title}](${s.file})`),
    '',
  ].join('\n')
  fs.writeFileSync(path.join(outDir, 'README.md'), tocMd, 'utf8')

  console.log('sections', sections.length, 'mode sequential toc ->', outDir)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
