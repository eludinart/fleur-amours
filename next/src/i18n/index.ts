import fr from './locales/fr.json'
import en from './locales/en.json'
import es from './locales/es.json'

const locales: Record<string, Record<string, unknown>> = { fr, en, es }

let currentLocale = 'fr'

export function setLocale(locale: string) {
  if (locales[locale]) currentLocale = locale
}

export const SUPPORTED_LOCALES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
]

export function getLocale() {
  return currentLocale
}

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const keys = key.split('.')
  let value: unknown = locales[currentLocale]
  for (const k of keys) {
    value = (value as Record<string, unknown>)?.[k]
  }
  if (value == null) return key
  let str = String(value)
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`{${k}}`, 'g'), String(v))
  }
  return str
}
