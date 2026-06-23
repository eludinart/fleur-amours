'use client'

import { useState, useMemo, useEffect, type ElementType } from 'react'
import { useStore } from '@/store/useStore'
import { translateText } from '@/lib/api-client'
import { t } from '@/i18n'

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
  it: new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'che', 'e', 'è',
    'in', 'per', 'con', 'su', 'da', 'del', 'della', 'dei', 'non', 'si', 'ma',
    'come', 'più', 'anche', 'tutto', 'bene', 'questo', 'questa', 'sono', 'ho',
    'hai', 'ha', 'noi', 'voi', 'loro', 'io', 'tu', 'lui', 'lei', 'essere',
  ]),
  de: new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem',
    'und', 'ist', 'in', 'zu', 'mit', 'auf', 'für', 'von', 'nicht', 'sich',
    'auch', 'als', 'an', 'er', 'sie', 'es', 'wir', 'ihr', 'ich', 'du', 'aber',
    'oder', 'wenn', 'wie', 'noch', 'nur', 'schon', 'sein', 'haben', 'wird',
  ]),
}

function detectLang(text: string): string | null {
  if (!text) return null
  const words =
    text
      .toLowerCase()
      .slice(0, 600)
      .match(/\b[a-zàâäéèêëîïôùûüÿæœç]{2,}\b/g) || []
  const scores: Record<string, number> = { fr: 0, es: 0, en: 0, it: 0, de: 0 }
  for (const w of words) {
    for (const lang of Object.keys(STOP_WORDS)) {
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

  const detectedLang = useMemo(() => detectLang(text), [text])
  const sourceLang = detectedLang || locale
  const needsTranslation = Boolean(text?.trim()) && locale !== sourceLang

  useEffect(() => {
    if (!needsTranslation) {
      setTranslated(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setTranslated(null)

    translateText(text, locale, sourceLang)
      .then((result) => {
        if (!cancelled) setTranslated(result?.trim() || null)
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error)?.message || t('common.translateError'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [text, locale, sourceLang, needsTranslation])

  const displayText = needsTranslation && translated ? translated : text

  return (
    <span className={`block ${className}`}>
      {loading && needsTranslation && !translated && (
        <span className="text-xs text-slate-500 italic mb-1 block">{t('common.translating')}</span>
      )}
      <As {...rest}>{displayText}</As>
      {error && <span className="text-xs text-red-500 mt-1 block">{error}</span>}
    </span>
  )
}
