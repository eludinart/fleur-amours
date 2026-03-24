'use client'

import { useState, useEffect } from 'react'
import {
  FLEUR_INTRO,
  FLEUR_COMMENT_LIRE,
  PETAL_INTERPRETATIONS,
  FLEUR_CONSEIL,
  getFleurInterpretationLocale,
} from '@/data/fleurInterpretation'
import { aiApi } from '@/api/ai'
import { TranslatableContent } from '@/components/TranslatableContent'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type FleurInterpretationProps = {
  scores?: Record<string, number>
  answers?: Array<{ dimension: string; label: string }>
  resultId?: string | number | null
  interpretation?: { summary?: string; insights?: string; reflection?: string } | null
  compact?: boolean
}

export function FleurInterpretation({
  scores = {},
  answers = [],
  resultId = null,
  interpretation: storedInterpretation = null,
  compact = false,
}: FleurInterpretationProps) {
  const locale = useStore((s) => s.locale)
  const localeData = getFleurInterpretationLocale(locale)
  const fleurIntro = localeData?.intro ?? FLEUR_INTRO
  const fleurCommentLire = localeData?.howToRead ?? FLEUR_COMMENT_LIRE
  const petalInterpretations = localeData?.petalInterpretations ?? PETAL_INTERPRETATIONS
  const fleurConseil = localeData?.conseil ?? FLEUR_CONSEIL
  const [expanded, setExpanded] = useState(!compact)
  const [aiData, setAiData] = useState<{ summary?: string; insights?: string; reflection?: string } | null>(
    storedInterpretation || null
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const hasScores = scores && Object.values(scores).some((v) => (v ?? 0) > 0)
  const scoresKey = hasScores ? JSON.stringify(scores) : ''
  useEffect(() => {
    if (!scoresKey) return
    if (
      storedInterpretation &&
      (storedInterpretation.summary || storedInterpretation.insights || storedInterpretation.reflection)
    ) {
      setAiData(storedInterpretation)
      return
    }
    setAiLoading(true)
    setAiError('')
    const payload = { scores, answers: Array.isArray(answers) ? answers : [] } as Record<string, unknown>
    if (resultId) (payload as Record<string, unknown>).result_id = resultId
    aiApi
      .fleurInterpretation(payload)
      .then((data) => setAiData(data as { summary?: string; insights?: string; reflection?: string }))
      .catch(() => setAiError(t('fleur.interpretation.error')))
      .finally(() => setAiLoading(false))
  }, [scoresKey, resultId, storedInterpretation])

  const content = (
    <>
      {hasScores && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 p-4 space-y-3">
          <h5 className="font-semibold text-sm text-violet-800 dark:text-violet-200 flex items-center gap-2">
            <span>✨</span> {t('fleur.interpretation.sectionTitle')}
          </h5>
          {aiLoading && <p className="text-xs text-slate-500 italic">{t('fleur.interpretation.generating')}</p>}
          {aiError && <p className="text-xs text-amber-600 dark:text-amber-400">{aiError}</p>}
          {aiData && !aiLoading && (
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {aiData.summary && <TranslatableContent text={aiData.summary} className="leading-relaxed" />}
              {aiData.insights && <TranslatableContent text={aiData.insights} className="leading-relaxed italic" />}
              {aiData.reflection && (
                <TranslatableContent
                  text={aiData.reflection}
                  className="leading-relaxed text-violet-700 dark:text-violet-300 font-medium"
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-accent/20 bg-accent/5 dark:bg-accent/10 p-4 space-y-2">
        <h5 className="font-semibold text-sm text-slate-800 dark:text-slate-100">{fleurCommentLire.title}</h5>
        <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1">
          {(fleurCommentLire.points ?? []).map((p: string, i: number) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{fleurIntro}</p>
      <div className="space-y-3">
        {['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros'].map((key) => {
          const def = petalInterpretations[key]
          const val = scores[key]
          if (!def) return null
          return (
            <div
              key={key}
              className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-3"
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{def.label}</span>
                <span className="text-xs text-slate-500">{def.subtitle}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{def.description}</p>
              {val !== undefined && (
                <p className="mt-2 text-xs text-accent font-medium">
                  {t('fleur.interpretation.yourScore').replace('{val}', String(val))}
                </p>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line border-t border-slate-200 dark:border-slate-600 pt-4">
        {fleurConseil}
      </p>
    </>
  )

  if (compact) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full px-5 py-4 text-left flex items-center justify-between gap-2 hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors"
        >
          <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t('fleur.interpretation.howToRead')}</h4>
          <span
            className="text-slate-400 transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
          >
            ▼
          </span>
        </button>
        {expanded && (
          <div className="px-5 pb-5 space-y-4 border-t border-slate-200 dark:border-slate-600">{content}</div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-5 space-y-4">
      <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t('fleur.interpretation.howToReadFull')}</h4>
      {content}
    </div>
  )
}
