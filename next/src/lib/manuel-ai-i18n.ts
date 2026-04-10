/**
 * Libellés du corpus manuel injecté dans les prompts IA (alignés sur les locales de l’app).
 */
export type ManuelAiLocale = 'fr' | 'en' | 'es' | 'it' | 'de'

export function normalizeManuelAiLocale(input: string | undefined | null): ManuelAiLocale {
  const base = String(input ?? '')
    .toLowerCase()
    .replace('_', '-')
    .split('-')[0]
  if (base === 'en' || base === 'es' || base === 'it' || base === 'de') return base
  return 'fr'
}

type ManuelAiStrings = {
  refHeader: string
  tocHeading: string
  excerptsMissing: string
  scienceReferenceLabel: string
}

const STRINGS: Record<ManuelAiLocale, ManuelAiStrings> = {
  fr: {
    refHeader:
      '\n\n=== Référence — Manuel du Tarot Fleur d’ÅmÔurs (texte canon ; aligner le vocabulaire et le cadre du jeu sur ce texte ; ne pas contredire ces extraits) ===\n',
    tocHeading: 'Chapitres du manuel (sommaire) :',
    excerptsMissing:
      '(Extraits : aucun chapitre chargé — vérifiez que public/manuel/ contient manifest.json et les fichiers .md.)',
    scienceReferenceLabel: 'Référence manuel (extraits) :',
  },
  en: {
    refHeader:
      '\n\n=== Reference — Fleur d’ÅmÔurs Tarot manual (canonical text; align vocabulary and game framing with this material; do not contradict these excerpts) ===\n',
    tocHeading: 'Manual chapters (table of contents):',
    excerptsMissing:
      '(Excerpts: no chapter could be loaded — ensure public/manuel/ contains manifest.json and the .md files.)',
    scienceReferenceLabel: 'Manual reference (excerpts):',
  },
  es: {
    refHeader:
      '\n\n=== Referencia — Manual del Tarot Fleur d’ÅmÔurs (texto canónico; alinear vocabulario y marco del juego con este material; no contradecir estos extractos) ===\n',
    tocHeading: 'Capítulos del manual (índice):',
    excerptsMissing:
      '(Extractos: no se pudo cargar ningún capítulo — compruebe que public/manuel/ contiene manifest.json y los .md.)',
    scienceReferenceLabel: 'Referencia al manual (extractos):',
  },
  it: {
    refHeader:
      '\n\n=== Riferimento — Manuale del Tarocco Fleur d’ÅmÔurs (testo canonico; allineare lessico e cornice di gioco a questo materiale; non contraddire questi estratti) ===\n',
    tocHeading: 'Capitoli del manuale (indice):',
    excerptsMissing:
      '(Estratti: nessun capitolo caricato — verificare che public/manuel/ contenga manifest.json e i file .md.)',
    scienceReferenceLabel: 'Riferimento al manuale (estratti):',
  },
  de: {
    refHeader:
      '\n\n=== Referenz — Handbuch Tarot Fleur d’ÅmÔurs (kanonischer Text; Vokabular und Spielrahmen an diesem Material ausrichten; diese Auszüge nicht widersprechen) ===\n',
    tocHeading: 'Kapitel des Handbuchs (Inhaltsverzeichnis):',
    excerptsMissing:
      '(Auszüge: kein Kapitel geladen — prüfen Sie, ob public/manuel/ manifest.json und die .md-Dateien enthält.)',
    scienceReferenceLabel: 'Handbuchreferenz (Auszüge):',
  },
}

export function getManuelAiStrings(locale: string | undefined | null): ManuelAiStrings {
  return STRINGS[normalizeManuelAiLocale(locale)]
}

/** Note de fin de sommaire quand la liste est tronquée (maxChars). */
export function formatMoreChaptersLine(locale: string | undefined | null, remainingCount: number): string {
  if (remainingCount <= 0) return ''
  switch (normalizeManuelAiLocale(locale)) {
    case 'en':
      return `… and ${remainingCount} more chapters.`
    case 'es':
      return `… y ${remainingCount} capítulos más.`
    case 'it':
      return `… e altri ${remainingCount} capitoli.`
    case 'de':
      return `… und ${remainingCount} weitere Kapitel.`
    default:
      return `… et ${remainingCount} autres chapitres.`
  }
}
