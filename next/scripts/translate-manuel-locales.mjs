#!/usr/bin/env node
/**
 * Traduit le manuel (titres i18n + chapitres .md) vers en, es, it, de.
 * Usage : node next/scripts/translate-manuel-locales.mjs [--locale en] [--skip-md] [--only-sections]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const MANUEL_DIR = path.join(ROOT, 'next/public/manuel')
const LOCALES_DIR = path.join(ROOT, 'next/src/i18n/locales')
const MANIFEST = JSON.parse(fs.readFileSync(path.join(MANUEL_DIR, 'manifest.json'), 'utf8'))

const TARGET_LOCALES = ['en', 'es', 'it', 'de']
const LANG_NAMES = {
  en: 'English',
  es: 'Spanish',
  it: 'Italian',
  de: 'German',
}

const SECTION_GLOSSARY = {
  en: [
    'Extended description:',
    'Light keywords:',
    'Shadow keywords:',
    'Shadow:',
    'Integration paths:',
    'Soul resonance:',
    'Energy correspondences:',
    'Root question:',
    'Exercise / Meditation:',
    'Element:',
    'Polarity:',
    'Symbolic correspondences:',
    'In resonance:',
  ],
  es: [
    'Descripción ampliada:',
    'Palabras clave de luz:',
    'Palabras clave de sombra:',
    'Sombra:',
    'Caminos de integración:',
    'Resonancia del alma:',
    'Correspondencias energéticas:',
    'Pregunta raíz:',
    'Ejercicio / Meditación:',
    'Elemento:',
    'Polaridad:',
    'Correspondencias simbólicas:',
    'En resonancia:',
  ],
  it: [
    'Descrizione estesa:',
    'Parole chiave di luce:',
    'Parole chiave d’ombra:',
    'Ombra:',
    'Percorsi di integrazione:',
    "Risonanza dell'anima:",
    'Corrispondenze energetiche:',
    'Domanda radice:',
    'Esercizio / Meditazione:',
    'Elemento:',
    'Polarità:',
    'Corrispondenze simboliche:',
    'In risonanza:',
  ],
  de: [
    'Erweiterte Beschreibung:',
    'Licht-Schlüsselwörter:',
    'Schatten-Schlüsselwörter:',
    'Schatten:',
    'Integrationswege:',
    'Seelenresonanz:',
    'Energetische Entsprechungen:',
    'Wurzelfrage:',
    'Übung / Meditation:',
    'Element:',
    'Polarität:',
    'Symbolische Entsprechungen:',
    'In Resonanz:',
  ],
}

const CARTO_I18N = {
  en: {
    lead: 'The tarot booklet online: browse the introductory texts, then the 65 cards grouped by door — Heart, Time, Climate and History.',
    noResults: 'No chapter matches your search.',
    annex: 'Annexes',
    intro: {
      badge: 'Part I — The manual garden',
      title: 'Understand before drawing',
      desc: 'Genesis, ethics, spreads and tarot architecture: everything to read before opening the first card.',
      origins: 'Origins & vision',
      originsHint: 'Genesis, prism of consciousness',
      ethics: "Gardener's ethics",
      ethicsHint: 'Oath, intention, tutor rule',
      draws: 'Spreads & games',
      drawsHint: 'From the daily petal to systemic games',
      architecture: 'Tarot architecture',
      architectureHint: 'Deployed flower, triple flower, four doors',
    },
    doors: {
      badge: 'Part II — The 65 cards',
      title: 'The four garden doors',
      desc: 'Each door unfolds its cards in a dedicated layout: rosette, stem, cycles or life arc.',
    },
    door: {
      heart: 'The 8 petals of ÅmÔurs',
      heartSub: 'Door of the Heart',
      heartAspect: 'Affective essence',
      time: 'The vegetal cycle',
      timeSub: 'Door of Time',
      timeAspect: 'The growth process',
      climate: 'The elements & their cycles',
      climateSub: 'Door of Climate',
      climateAspect: 'The energetic environment',
      history: 'The life cycle',
      historySub: 'Door of History',
      historyAspect: 'Experience & transmission',
    },
    climate: {
      raw: 'The 5 raw elements',
      earth: 'Earth cycle',
      water: 'Water cycle',
      air: 'Air cycle',
      fire: 'Fire cycle',
      ether: 'Ether cycle',
    },
    vegetal: { crown: 'Crown · pollen', seed: 'Seed · root' },
  },
  es: {
    lead: 'El libreto del tarot en línea: recorre los textos de introducción y las 65 cartas agrupadas por puerta — Corazón, Tiempo, Clima e Historia.',
    noResults: 'Ningún capítulo coincide con tu búsqueda.',
    annex: 'Anexos',
    intro: {
      badge: 'Parte I — El jardín del manual',
      title: 'Comprender antes de tirar',
      desc: 'Génesis, ética, tiradas y arquitectura del tarot: todo lo que hay que leer antes de abrir la primera carta.',
      origins: 'Orígenes y visión',
      originsHint: 'Génesis, prisma de conciencia',
      ethics: 'Ética del jardinero',
      ethicsHint: 'Juramento, intención, regla del tutor',
      draws: 'Tiradas y juegos',
      drawsHint: 'Del pétalo del día a los juegos sistémicos',
      architecture: 'Arquitectura del tarot',
      architectureHint: 'Flor desplegada, triple flor, cuatro puertas',
    },
    doors: {
      badge: 'Parte II — Las 65 cartas',
      title: 'Las cuatro puertas del jardín',
      desc: 'Cada puerta despliega sus cartas en un diseño dedicado: rosetón, tallo, ciclos o arco de vida.',
    },
    door: {
      heart: 'Los 8 pétalos de ÅmÔurs',
      heartSub: 'Puerta del Corazón',
      heartAspect: 'La esencia afectiva',
      time: 'El ciclo vegetal',
      timeSub: 'Puerta del Tiempo',
      timeAspect: 'El proceso de crecimiento',
      climate: 'Los elementos y sus ciclos',
      climateSub: 'Puerta del Clima',
      climateAspect: 'El entorno energético',
      history: 'El ciclo de la vida',
      historySub: 'Puerta de la Historia',
      historyAspect: 'La experiencia y la transmisión',
    },
    climate: {
      raw: 'Los 5 elementos brutos',
      earth: 'Ciclo de la Tierra',
      water: 'Ciclo del Agua',
      air: 'Ciclo del Aire',
      fire: 'Ciclo del Fuego',
      ether: 'Ciclo del Éter',
    },
    vegetal: { crown: 'Cima · polen', seed: 'Semilla · raíz' },
  },
  it: {
    lead: 'Il libretto del tarocco online: scorri i testi introduttivi, poi le 65 carte raggruppate per porta — Cuore, Tempo, Clima e Storia.',
    noResults: 'Nessun capitolo corrisponde alla tua ricerca.',
    annex: 'Annessi',
    intro: {
      badge: 'Parte I — Il giardino del manuale',
      title: 'Comprendere prima di tirare',
      desc: 'Genesi, etica, tiraggi e architettura del tarocco: tutto ciò che serve prima di aprire la prima carta.',
      origins: 'Origini e visione',
      originsHint: 'Genesi, prisma di coscienza',
      ethics: 'Etica del giardiniere',
      ethicsHint: 'Giuramento, intenzione, regola del tutore',
      draws: 'Tiraggi e giochi',
      drawsHint: 'Dal petalo del giorno ai giochi sistemici',
      architecture: 'Architettura del tarocco',
      architectureHint: 'Fiore dispiegato, triplo fiore, quattro porte',
    },
    doors: {
      badge: 'Parte II — Le 65 carte',
      title: 'Le quattro porte del giardino',
      desc: 'Ogni porta dispiega le sue carte in un layout dedicato: rosetta, stelo, cicli o arco di vita.',
    },
    door: {
      heart: 'I 8 petali di ÅmÔurs',
      heartSub: 'Porta del Cuore',
      heartAspect: "L'essenza affettiva",
      time: 'Il ciclo vegetale',
      timeSub: 'Porta del Tempo',
      timeAspect: 'Il processo di crescita',
      climate: 'Gli elementi e i loro cicli',
      climateSub: 'Porta del Clima',
      climateAspect: "L'ambiente energetico",
      history: 'Il ciclo della vita',
      historySub: 'Porta della Storia',
      historyAspect: 'Esperienza e trasmissione',
    },
    climate: {
      raw: 'I 5 elementi grezzi',
      earth: 'Ciclo della Terra',
      water: "Ciclo dell'Acqua",
      air: "Ciclo dell'Aria",
      fire: 'Ciclo del Fuoco',
      ether: "Ciclo dell'Etere",
    },
    vegetal: { crown: 'Cima · polline', seed: 'Seme · radice' },
  },
  de: {
    lead: 'Das Tarot-Heft online: durchstöbere die Einführungstexte, dann die 65 Karten nach Pforte — Herz, Zeit, Klima und Geschichte.',
    noResults: 'Kein Kapitel entspricht deiner Suche.',
    annex: 'Anhänge',
    intro: {
      badge: 'Teil I — Der Garten des Handbuchs',
      title: 'Verstehen vor dem Legen',
      desc: 'Genese, Ethik, Legesysteme und Architektur des Tarots: alles, was man lesen sollte, bevor man die erste Karte öffnet.',
      origins: 'Ursprünge & Vision',
      originsHint: 'Genese, Prisma des Bewusstseins',
      ethics: 'Ethik des Gärtners',
      ethicsHint: 'Eid, Absicht, Regel des Tutors',
      draws: 'Legesysteme & Spiele',
      drawsHint: 'Vom Tagesblütenblatt zu den systemischen Spielen',
      architecture: 'Architektur des Tarots',
      architectureHint: 'Entfaltete Blume, Dreifachblume, vier Pforten',
    },
    doors: {
      badge: 'Teil II — Die 65 Karten',
      title: 'Die vier Gartenpforten',
      desc: 'Jede Pforte entfaltet ihre Karten in einer eigenen Anordnung: Rosette, Stängel, Zyklen oder Lebensbogen.',
    },
    door: {
      heart: 'Die 8 Blütenblätter der ÅmÔurs',
      heartSub: 'Pforte des Herzens',
      heartAspect: 'Die affektive Essenz',
      time: 'Der vegetative Zyklus',
      timeSub: 'Pforte der Zeit',
      timeAspect: 'Der Wachstumsprozess',
      climate: 'Die Elemente & ihre Zyklen',
      climateSub: 'Pforte des Klimas',
      climateAspect: 'Das energetische Umfeld',
      history: 'Der Lebenszyklus',
      historySub: 'Pforte der Geschichte',
      historyAspect: 'Erfahrung & Weitergabe',
    },
    climate: {
      raw: 'Die 5 rohen Elemente',
      earth: 'Erdzyklus',
      water: 'Wasserzyklus',
      air: 'Luftzyklus',
      fire: 'Feuerzyklus',
      ether: 'Ätherzyklus',
    },
    vegetal: { crown: 'Krone · Pollen', seed: 'Samen · Wurzel' },
  },
}

function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!m) continue
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[m[1]] = val
  }
}

async function openrouterChat(system, user, maxTokens = 8000) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENROUTER_API_KEY manquant')
  const model =
    process.env.FLEUR_OPENROUTER_MODEL ||
    process.env.OPENROUTER_MODEL ||
    'google/gemini-2.5-flash-lite'
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://eludein.art/jardin',
      'X-Title': 'Fleur d AmOurs manuel translate',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {}
      deepMerge(target[k], v)
    } else {
      target[k] = v
    }
  }
  return target
}

function updateLocaleFile(locale, patch) {
  const fp = path.join(LOCALES_DIR, `${locale}.json`)
  const json = JSON.parse(fs.readFileSync(fp, 'utf8'))
  if (!json.manuel) json.manuel = {}
  deepMerge(json.manuel, patch)
  fs.writeFileSync(fp, `${JSON.stringify(json, null, 2)}\n`, 'utf8')
  console.log(`i18n mis à jour : ${locale}.json`)
}

async function translateSectionTitles(locale) {
  const lang = LANG_NAMES[locale]
  const items = MANIFEST.sections.map((s) => ({ id: s.id, title: s.title }))
  const system = `You translate tarot manual chapter titles from French to ${lang}. Return ONLY valid JSON object: keys = section ids, values = translated titles. Keep ÅmÔurs, AGAPÈ, ÉROS, proper card names. Preserve numbering like "1. Level 1:".`
  const user = JSON.stringify(items)
  const raw = await openrouterChat(system, user, 12000)
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
  const map = JSON.parse(cleaned)
  updateLocaleFile(locale, { sections: map })
  return map
}

function frenchSectionTitles() {
  const map = {}
  for (const s of MANIFEST.sections) map[s.id] = s.title
  return map
}

async function translateMarkdownFile(file, locale) {
  const srcPath = path.join(MANUEL_DIR, file)
  if (!fs.existsSync(srcPath)) return false
  const outDir = path.join(MANUEL_DIR, locale)
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, file)
  if (fs.existsSync(outPath)) {
    console.log(`  skip (existe) ${locale}/${file}`)
    return true
  }

  const raw = fs.readFileSync(srcPath, 'utf8')
  const lang = LANG_NAMES[locale]
  const glossary = SECTION_GLOSSARY[locale].join('\n- ')
  const system = `You are a literary translator for the Fleur d'ÅmÔurs relational tarot manual (French → ${lang}).

Rules:
- Output ONLY the translated markdown, no commentary.
- Keep the first lines structure: # title, optional > metadata line (translate metadata text), then body.
- Use EXACTLY these section labels (copy verbatim, with colon):
- ${glossary}
- Keep brand names: Fleur d'ÅmÔurs, Tarot Fleur d'ÅmÔurs, ÅmÔurs.
- Card archetype names (AGAPÈ, ÉROS, etc.) may stay or use standard ${lang} transliteration.
- Preserve markdown if any; translate prose faithfully with warm, clear tone.
- For Root question / Wurzelfrage sections: keep the question in « guillemets » or "quotes".`

  const user = raw.length > 14000 ? raw.slice(0, 14000) : raw
  const translated = await openrouterChat(system, user, 12000)
  if (!translated || translated.length < 40) {
    console.warn(`  échec ${locale}/${file} — réponse vide`)
    return false
  }
  fs.writeFileSync(outPath, `${translated.trim()}\n`, 'utf8')
  console.log(`  ok ${locale}/${file}`)
  return true
}

async function main() {
  loadEnv()
  const args = process.argv.slice(2)
  const onlySections = args.includes('--only-sections')
  const skipMd = args.includes('--skip-md')
  const localeArg = args.find((a) => a.startsWith('--locale='))?.split('=')[1]
  const locales = localeArg ? [localeArg] : TARGET_LOCALES

  // Sections FR dans fr.json
  updateLocaleFile('fr', {
    sections: frenchSectionTitles(),
    carto: JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'fr.json'), 'utf8')).manuel?.carto ?? {},
  })

  for (const locale of locales) {
    if (!TARGET_LOCALES.includes(locale)) {
      console.warn(`Locale ignorée : ${locale}`)
      continue
    }
    console.log(`\n=== ${locale.toUpperCase()} ===`)
    if (CARTO_I18N[locale]) updateLocaleFile(locale, { carto: CARTO_I18N[locale] })
    await translateSectionTitles(locale)
    if (onlySections || skipMd) continue

    const files = MANIFEST.sections.map((s) => s.file)
    for (const file of files) {
      await translateMarkdownFile(file, locale)
      await new Promise((r) => setTimeout(r, 400))
    }
  }
  console.log('\nTerminé.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
