/**
 * Helpers i18n pour le manuel en ligne (titres de chapitres, locale contenu).
 */
import { t } from '@/i18n'
import type { ManuelManifestSection } from './manuel'
import { normalizeManuelAiLocale, type ManuelAiLocale } from './manuel-ai-i18n'

export type { ManuelAiLocale }

export function normalizeManuelLocale(input: string | undefined | null): ManuelAiLocale {
  return normalizeManuelAiLocale(input)
}

/** Titre localisé d'une section du sommaire (fallback : titre du manifest). */
export function manuelSectionTitle(section: ManuelManifestSection): string {
  const key = `manuel.sections.${section.id}`
  const val = t(key)
  return val === key ? section.title : val
}

/** Chemin relatif du fichier chapitre selon la locale (fr = racine historique). */
export function manuelChapterRelativePath(file: string, locale: string): string {
  const loc = normalizeManuelLocale(locale)
  const name = file.startsWith('/') ? file.slice(1) : file
  if (loc === 'fr') return `/${name}`
  return `/${loc}/${name}`
}
