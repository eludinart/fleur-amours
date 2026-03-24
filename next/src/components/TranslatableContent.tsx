'use client'

import { useState, useMemo, type ElementType } from 'react'
import { useStore } from '@/store/useStore'
import { translateText } from '@/lib/api-client'
import { t } from '@/i18n'
import { SUPPORTED_LOCALES } from '@/i18n'

const STOP_WORDS: Record<string, Set<string>> = {
  fr: new Set([
    'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'est', 'en', 'que',
    'qui', 'il', 'elle', 'je', 'tu', 'nous', 'vous', 'ils', 'elles', 'se', 'sa',
    'son', 'sur', 'par', 'pour', 'avec', 'dans', 'au', 'aux', 'ce', 'cette',
    'mais', 'ou', 'donc', 'ni', 'car', 'ne', 'pas', 'plus', 'aussi', 'comme',
    'tout', 'bien', 'si', 'même', 'très', 'leur', 'leurs', 'mon', 'ma', 'mes',
    'ton', 'ta', 'tes', 'votre', 'vos', 'notre', 'nos', 'y', 'dont', 'où',
  ]),
  es: new Set([
    'el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'unos', 'unas', 'y',
    'es', 'en', 'que', 'quien', 'él', 'ella', 'yo', 'tú', 'nosotros', 'ellos',
    'ellas', 'se', 'su', 'sus', 'sobre', 'por', 'para', 'con', 'al', 'este',
    'esta', 'pero', 'o', 'porque', 'ni', 'como', 'todo', 'bien', 'si', 'mismo',
    'muy', 'más', 'también', 'mi', 'mis', 'tu', 'tus', 'hay', 'era', 'fue',
    'han', 'son', 'ser', 'estar', 'tiene', 'esto', 'eso',
  ]),
  en: new Set([
    'the', 'a', 'an', 'of', 'in', 'is', 'it', 'and', 'to', 'that', 'for', 'on',
    'are', 'with', 'as', 'at', 'be', 'this', 'from', 'or', 'by', 'not', 'but',
    'have', 'had', 'has', 'he', 'she', 'we', 'they', 'his', 'her', 'its',
    'their', 'my', 'your', 'our', 'i', 'you', 'was', 'were', 'been', 'will',
    'would', 'could', 'should', 'do', 'did', 'does', 'so', 'if', 'all', 'can',
    'which', 'when', 'there',
  ]),
}

function detectLang(text: string): string | null {
  if (!text) return null
  const words =
    text
      .toLowerCase()
      .slice(0, 600)
      .match(/\b[a-zàâäéèêëîïôùûüÿæœç]{2,}\b/g) || []
  const scores: Record<string, number> = { fr: 0, es: 0, en: 0 }
  for (const w of words) {
    for (const lang of ['fr', 'es', 'en']) {
      if (STOP_WORDS[lang]?.has(w)) scores[lang]++
    }
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return best && best[1] > 0 ? best[0] : null
}

type TranslatableContentProps = {
  text: string
  className?: string
  as?: ElementType
  [key: string]: unknown
}

export function TranslatableContent({
  text,
  className = '',
  as: As = 'p',
  ...rest
}: TranslatableContentProps) {
  const locale = (useStore((s) => s.locale) || 'fr') as string
  const [translated, setTranslated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayText = translated ?? text
  const detectedLang = useMemo(() => detectLang(text), [text])
  const sourceLang = detectedLang || locale
  const otherLocales = SUPPORTED_LOCALES.filter((l) => l.code !== sourceLang)

  const handleTranslate = async (target: string) => {
    if (!text?.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await translateText(text, target, sourceLang)
      setTranslated(result)
    } catch (e) {
      setError((e as Error)?.message || t('common.translateError'))
    } finally {
      setLoading(false)
    }
  }

  const showOriginal = () => {
    setTranslated(null)
    setError(null)
  }

  return (
    <span className={`block ${className}`}>
      <As {...rest}>{displayText}</As>
      {text?.trim() && (
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {translated ? (
            <button
              type="button"
              onClick={showOriginal}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline"
            >
              {locale === 'fr'
                ? 'Voir original'
                : locale === 'es'
                  ? 'Ver original'
                  : 'Show original'}
            </button>
          ) : (
            otherLocales.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => handleTranslate(code)}
                disabled={loading}
                className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 underline disabled:opacity-50"
              >
                {loading ? t('common.translating') : t('common.translateTo', { lang: label })}
              </button>
            ))
          )}
          {error && <span className="text-xs text-red-500">{error}</span>}
        </span>
      )}
    </span>
  )
}
