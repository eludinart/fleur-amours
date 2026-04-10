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

export function getManuelAssetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${MANUEL_PUBLIC_PREFIX}${p}`
}
