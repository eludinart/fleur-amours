/**
 * Traductions côté serveur (notifications, e-mails) — 5 langues.
 */
import fr from '@/i18n/locales/fr.json'
import en from '@/i18n/locales/en.json'
import es from '@/i18n/locales/es.json'
import it from '@/i18n/locales/it.json'
import de from '@/i18n/locales/de.json'

const LOCALES: Record<string, Record<string, unknown>> = { fr, en, es, it, de }

export const SUPPORTED_SERVER_LOCALES = ['fr', 'en', 'es', 'it', 'de'] as const
export type ServerLocale = (typeof SUPPORTED_SERVER_LOCALES)[number]

export function normalizeServerLocale(locale: string | undefined | null): ServerLocale {
  const l = String(locale ?? 'fr').slice(0, 2).toLowerCase()
  return (SUPPORTED_SERVER_LOCALES as readonly string[]).includes(l) ? (l as ServerLocale) : 'fr'
}

export function tServer(
  locale: string | undefined | null,
  key: string,
  vars: Record<string, string | number> = {}
): string {
  const loc = normalizeServerLocale(locale)
  const keys = key.split('.')
  let value: unknown = LOCALES[loc]
  for (const k of keys) {
    value = (value as Record<string, unknown>)?.[k]
    if (value == null) break
  }
  if (value == null && loc !== 'fr') {
    let fallback: unknown = LOCALES.fr
    for (const k of keys) {
      fallback = (fallback as Record<string, unknown>)?.[k]
      if (fallback == null) break
    }
    value = fallback
  }
  if (value == null) return key
  let str = String(value)
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{\\{?${k}\\}?\\}`, 'g'), String(v))
  }
  return str
}
