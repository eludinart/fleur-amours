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
import { fleurBetaApi } from '@/api/fleur-beta'
import { TranslatableContent } from '@/components/TranslatableContent'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type DuoProfileScores = {
  label: string
  scores: Record<string, number>
  toneClass?: string
}

type FleurInterpretationProps = {
  scores?: Record<string, number>
  /** En duo : un bloc score par personne (remplace « Votre score »). */
  duoProfiles?: DuoProfileScores[]
  answers?: Array<{ dimension: string; label: string }>
  resultId?: string | number | null
  interpretation?: { summary?: string; insights?: string; reflection?: string } | null
  compact?: boolean
  /** Utilise POST /api/fleur-beta/interpretation (cache serveur). */
  interpretationApi?: 'standard' | 'fleur-beta'
  /** Replie intro, grille pétales et textes de référence dans un bloc dépliable. */
  collapseReferenceSection?: boolean
  /** Affiche le titre « Comment interpréter… » au-dessus du bloc (défaut true). */
  showOuterHeading?: boolean
}

function formatPetalScore(v: unknown): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return String(v ?? '—')
  return String(Math.round(v * 10) / 10)
}

export function FleurInterpretation({
  scores = {},
  duoProfiles,
  answers = [],
  resultId = null,
  interpretation: storedInterpretation = null,
  compact = false,
  interpretationApi = 'standard',
  collapseReferenceSection = false,
  showOuterHeading = true,
}: FleurInterpretationProps) {
  const locale = useStore((s) => s.locale)
  const localeData = getFleurInterpretationLocale(locale)
  const fleurIntro = localeData?.intro ?? FLEUR_INTRO
  const fleurCommentLire = localeData?.howToRead ?? FLEUR_COMMENT_LIRE
  const petalInterpretations = localeData?.petalInterpretations ?? PETAL_INTERPRETATIONS
  const fleurConseil = localeData?.conseil ?? FLEUR_CONSEIL
  /** Ouvert par défaut pour que l'interprétation IA (Duo compact inclus) soit visible sans clic. */
  const [expanded, setExpanded] = useState(true)
  const [aiData, setAiData] = useState<{ summary?: string; insights?: string; reflection?: string } | null>(
    storedInterpretation || null
  )
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const hasScores =
    duoProfiles?.some((p) => Object.values(p.scores).some((v) => (v ?? 0) > 0)) ||
    (scores && Object.values(scores).some((v) => (v ?? 0) > 0))
  const scoresKey = hasScores
    ? duoProfiles?.length
      ? JSON.stringify(duoProfiles)
      : JSON.stringify(scores)
    : ''
  const betaAiTitle =
    interpretationApi === 'fleur-beta' ? t('fleurBeta.aiReading') : t('fleur.interpretation.sectionTitle')

  useEffect(() => {
    if (interpretationApi === 'fleur-beta') {
      if (
        storedInterpretation &&
        (storedInterpretation.summary || storedInterpretation.insights || storedInterpretation.reflection)
      ) {
        setAiData(storedInterpretation)
        return
      }
      const rid = resultId != null && resultId !== '' ? Number(resultId) : NaN
      if (!Number.isFinite(rid) || rid <= 0) return
      setAiLoading(true)
      setAiError('')
      fleurBetaApi
        .interpretation({ result_id: rid, locale: locale || 'fr' })
        .then((data) => setAiData(data as { summary?: string; insights?: string; reflection?: string }))
        .catch(() => setAiError(t('fleur.interpretation.error')))
        .finally(() => setAiLoading(false))
      return
    }

    if (!scoresKey) return
    if (duoProfiles?.length) return
    if (
      storedInterpretation &&
      (storedInterpretation.summary || storedInterpretation.insights || storedInterpretation.reflection)
    ) {
      setAiData(storedInterpretation)
      return
    }
    setAiLoading(true)
    setAiError('')
    const payload = {
      scores,
      answers: Array.isArray(answers) ? answers : [],
      locale: locale || 'fr',
    } as Record<string, unknown>
    if (resultId) (payload as Record<string, unknown>).result_id = resultId
    aiApi
      .fleurInterpretation(payload)
      .then((data) => setAiData(data as { summary?: string; insights?: string; reflection?: string }))
      .catch(() => setAiError(t('fleur.interpretation.error')))
      .finally(() => setAiLoading(false))
  }, [scoresKey, resultId, storedInterpretation, interpretationApi, locale])

  const referenceBlock = (
    <>
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
          const duoVals = duoProfiles?.map((p) => ({ label: p.label, val: p.scores[key] }))
          const hasPetal =
            val !== undefined ||
            duoVals?.some((d) => d.val !== undefined && d.val !== null)
          if (!def || !hasPetal) return null
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
              {duoProfiles?.length ? (
                <ul className="mt-2 space-y-1">
                  {duoProfiles.map((profile) => {
                    const profileVal = profile.scores[key]
                    if (profileVal === undefined || profileVal === null) return null
                    return (
                      <li
                        key={profile.label}
                        className={`text-xs font-medium ${profile.toneClass ?? 'text-accent'}`}
                      >
                        {t('fleur.interpretation.personScore', {
                          name: profile.label,
                          val: formatPetalScore(profileVal),
                        })}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                val !== undefined && (
                  <p className="mt-2 text-xs text-accent font-medium">
                    {t('fleur.interpretation.yourScore', { val: formatPetalScore(val) })}
                  </p>
                )
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

  const showAiBlock =
    !duoProfiles?.length && (interpretationApi === 'fleur-beta' ? hasScores || !!resultId : hasScores)

  const content = (
    <>
      {showAiBlock && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 p-4 space-y-3">
          <h5 className="font-semibold text-sm text-violet-800 dark:text-violet-200 flex items-center gap-2">
            <span>✨</span> {betaAiTitle}
          </h5>
          {aiLoading && <p className="text-xs text-slate-500 italic">{t('fleur.interpretation.generating')}</p>}
          {aiError && <p className="text-xs text-amber-600 dark:text-amber-400">{aiError}</p>}
          {aiData && !aiLoading && (
            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
              {aiData.summary && (
                <div>
                  {interpretationApi === 'fleur-beta' && (
                    <p className="text-sm font-semibold uppercase tracking-wide text-violet-600/90 dark:text-violet-300/90 mb-1">
                      {t('fleurBeta.aiBlockSynthesis')}
                    </p>
                  )}
                  <TranslatableContent text={aiData.summary} className="leading-relaxed" />
                </div>
              )}
              {aiData.insights && (
                <div>
                  {interpretationApi === 'fleur-beta' && (
                    <p className="text-sm font-semibold uppercase tracking-wide text-violet-600/90 dark:text-violet-300/90 mb-1">
                      {t('fleurBeta.aiBlockTensions')}
                    </p>
                  )}
                  <TranslatableContent text={aiData.insights} className="leading-relaxed italic" />
                </div>
              )}
              {aiData.reflection && (
                <div>
                  {interpretationApi === 'fleur-beta' && (
                    <p className="text-sm font-semibold uppercase tracking-wide text-violet-600/90 dark:text-violet-300/90 mb-1">
                      {t('fleurBeta.aiBlockOpening')}
                    </p>
                  )}
                  <TranslatableContent
                    text={aiData.reflection}
                    className="leading-relaxed text-violet-800 dark:text-violet-200 font-medium"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {collapseReferenceSection ? (
        <details className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 overflow-hidden group">
          <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 [&::-webkit-details-marker]:hidden">
            <span>{t('fleurBeta.referenceDetails')}</span>
            <span className="text-slate-400 transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-4 border-t border-slate-200 dark:border-slate-600">{referenceBlock}</div>
        </details>
      ) : (
        referenceBlock
      )}
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
      {showOuterHeading && (
        <h4 className="font-semibold text-slate-800 dark:text-slate-100">
          {interpretationApi === 'fleur-beta'
            ? t('fleurBeta.interpretationHeading')
            : t('fleur.interpretation.howToReadFull')}
        </h4>
      )}
      {content}
    </div>
  )
}
