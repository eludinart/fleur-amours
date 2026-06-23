/** Fichiers statiques sous `public/manuel/` (manifest + chapitres .md). */

export const MANUEL_PUBLIC_PREFIX = '/manuel'

export type ManuelManifestSection = {
  id: string
  title: string
  bookPage: number
  pdfStart1?: number
  pdfEnd1?: number
  file: string
}

export type ManuelManifest = {
  source?: string
  generatedAt?: string
  pdfPages?: number
  bookToPdfOffset?: number | null
  splitMode?: string
  sections: ManuelManifestSection[]
}

export function manuelChapterBaseName(file: string): string {
  return file.replace(/\.md$/i, '')
}

export function getManuelAssetUrl(path: string, locale = 'fr'): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
  const p = path.startsWith('/') ? path : `/${path}`
  const loc = locale === 'fr' ? '' : `/${locale}`
  // Évite /manuel/en/en/… si path inclut déjà la locale.
  if (loc && p.startsWith(`${loc}/`)) {
    return `${base}${MANUEL_PUBLIC_PREFIX}${p}`
  }
  return `${base}${MANUEL_PUBLIC_PREFIX}${loc}${p}`
}
