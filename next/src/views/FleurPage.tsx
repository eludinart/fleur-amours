// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { fleurApi } from '@/api/fleur'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'
import { VoiceTextInput } from '@/components/VoiceTextInput'
import { FleurInterpretation } from '@/components/FleurInterpretation'
import { BuyTarotCTA } from '@/components/BuyTarotCTA'
import { ShareFleurButton } from '@/components/ShareFleurButton'
import { ExportPlan14j } from '@/components/ExportPlan14j'
import { FleurPrintable } from '@/components/FleurPrintable'

const DEFINITION_SLUG = 'fleur-amour-individuel'

const PETAL_LABELS = {
  agape: 'Agapè', philautia: 'Philautia', mania: 'Mania', storge: 'Storgè',
  pragma: 'Pragma', philia: 'Philia', ludus: 'Ludus', eros: 'Éros',
}
const ZONE_COLOR = {
  active:  'bg-accent/10 text-accent border-accent/20',
  retrait: 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700',
  neutre:  'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800',
}

function ProgressBar({ answered, total }) {
  const pct = Math.round((answered / total) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{t('fleur.questionsCount', { answered, total })}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all duration-300 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ResultView({ result, answers: answersProp, onReset }) {
  useStore((s) => s.locale)
  const hasCompletedFirstFleur = useStore((s) => s.hasCompletedFirstFleur)
  const setHasCompletedFirstFleur = useStore((s) => s.setHasCompletedFirstFleur)
  const [showCelebration, setShowCelebration] = useState(!hasCompletedFirstFleur)
  const flowerRef = useRef(null)
  const fleurPdfRef = useRef(null)
  const { scores, analysis, composite } = result

  const dismissCelebration = () => {
    setShowCelebration(false)
    setHasCompletedFirstFleur(true)
  }
  const answersForAi = Array.isArray(answersProp)
    ? answersProp.map(a => ({ dimension: a.dimension ?? a.dimension_chosen, label: a.label ?? a.choice_label }))
    : Object.values(answersProp || {}).map(a => ({ dimension: a.dimension, label: a.label }))
  const ITEMS = [
    { key: 'coherence_index', labelKey: 'coherence', color: 'text-indigo-500' },
    { key: 'vitality_index',  labelKey: 'vitality',  color: 'text-emerald-500' },
    { key: 'stability_index', labelKey: 'stability', color: 'text-amber-500' },
  ]
  return (
    <div className="space-y-6" style={{ animation: 'fadeIn .5s ease' }}>
      {showCelebration && (
        <div className="rounded-2xl border-2 border-accent/40 bg-accent/10 dark:bg-accent/5 p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-bold text-accent text-lg">{t('onboarding.fleurCompleteTitle')} ✨</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {t('onboarding.fleurCompleteDesc')}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissCelebration}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg"
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>
          <div className="flex gap-2">
            <Link
              href="/tirage"
              onClick={dismissCelebration}
              className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {t('onboarding.fleurCompleteCta')}
            </Link>
            <button
              type="button"
              onClick={dismissCelebration}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
      <div className="text-center space-y-1">
        <h3 className="text-2xl font-bold text-accent">{t('fleur.title')} 🌸</h3>
        {analysis?.dominant && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('fleur.dominant')}: <strong>{PETAL_LABELS[analysis.dominant]}</strong>
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div ref={flowerRef} className="flex justify-center">
          <FlowerSVG petals={scoresToPetals(scores)} size={280} animate showLabels />
        </div>
      </div>

      {/* Printable PDF layout (offscreen) */}
      <div style={{ position: 'fixed', left: -100000, top: 0, opacity: 0, pointerEvents: 'none' }}>
        <div ref={fleurPdfRef}>
          <FleurPrintable result={result} answers={answersForAi} />
        </div>
      </div>

      <FleurInterpretation scores={scores} answers={answersForAi} resultId={result.id || result.result_id} interpretation={result.interpretation} />

      <div className="flex justify-center gap-2 flex-wrap">
        <ExportPlan14j pdfRef={fleurPdfRef} imageRef={flowerRef} />
        <ShareFleurButton
          targetRef={flowerRef}
          shareUrl={result.id ? `/fleur?result=${result.id}` : result.result_id ? `/fleur?result=${result.result_id}` : '/fleur'}
          filename="ma-fleur.png"
          label={t('fleur.shareFleur')}
        />
      </div>

      {composite && (
        <div className="flex gap-4 justify-center flex-wrap">
          {ITEMS.map(({ key, labelKey, color }) => (
            <div key={key} className="text-center">
              <div className={`text-2xl font-bold ${color}`}>{Math.round((composite[key] ?? 0) * 100)}%</div>
              <div className="text-xs text-slate-500">{t(`fleur.${labelKey}`)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(scores).map(([p, v]) => (
          <div key={p} className={`rounded-xl border px-2 py-2 text-center text-xs ${ZONE_COLOR[analysis?.zones?.[p] ?? 'neutre']}`}>
            <div className="text-lg font-bold">{v}</div>
            <div>{PETAL_LABELS[p]}</div>
          </div>
        ))}
      </div>

      {analysis?.global && (
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
          <p className="text-sm italic text-slate-700 dark:text-slate-200 leading-relaxed">{analysis.global}</p>
        </div>
      )}

      {result.token && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 space-y-1">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{t('fleur.tokenLabel')}</p>
          <code className="text-xs font-mono text-accent break-all">{result.token}</code>
          <p className="text-xs text-slate-400">{t('fleur.tokenDesc')}</p>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button onClick={onReset}
          className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          {t('fleur.newQuestionnaire')}
        </button>
        <Link href="/duo"
          className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors">
          {t('fleur.invitePartner')}
        </Link>
      </div>

      <div className="flex justify-center pt-4">
        <BuyTarotCTA variant="compact" />
      </div>

      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  )
}

export default function FleurPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resultIdParam = searchParams?.get?.('result') ?? null

  const [questions, setQuestions] = useState([])
  const [loadingQ, setLoadingQ]   = useState(true)
  const [errorQ, setErrorQ]       = useState('')

  // answers: { [questionId]: { choiceId, dimension, label } }
  const [answers, setAnswers]     = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)  // index de la question affichée
  const [comment, setComment]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState(null)

  const [loadingResult, setLoadingResult] = useState(!!resultIdParam)

  const [loadedAnswers, setLoadedAnswers] = useState([])

  // Charger un résultat existant (depuis Mes Fleurs)
  useEffect(() => {
    if (!resultIdParam) { setLoadingResult(false); return }
    const id = parseInt(resultIdParam, 10)
    if (!id) { setLoadingResult(false); return }
    setLoadingResult(true)
    Promise.all([
      fleurApi.getResult(String(id)),
      fleurApi.getAnswers(String(id)).catch(() => []),
    ])
      .then(([data, ans]) => {
        setResult(data)
        setLoadedAnswers(Array.isArray(ans) ? ans : (ans?.answers ?? []))
      })
      .catch(() => setError(t('fleur.resultNotFound')))
      .finally(() => setLoadingResult(false))
  }, [resultIdParam])

  // Charger les questions depuis l'API au montage
  function loadQuestions() {
    setErrorQ('')
    setLoadingQ(true)
    fleurApi.getQuestions(DEFINITION_SLUG, locale)
      .then(data => { setQuestions(data); setErrorQ('') })
      .catch(() => setErrorQ(t('fleur.loadQuestionsError')))
      .finally(() => setLoadingQ(false))
  }
  const locale = useStore((s) => s.locale)
  const hasCompletedFirstFleur = useStore((s) => s.hasCompletedFirstFleur)
  useEffect(() => { loadQuestions() }, [locale])

  const answered = Object.keys(answers).length
  const allDone  = questions.length > 0 && answered === questions.length

  function choose(questionId, choice) {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { choiceId: choice.id, dimension: choice.dimension, label: choice.label }
    }))
    setCurrentIndex(i => Math.min(i + 1, questions.length))
  }

  async function submit() {
    if (!allDone) {
      setError(t('fleur.answerAll', { total: questions.length, answered }))
      return
    }
    setError('')
    setLoading(true)
    try {
      const answersPayload = Object.entries(answers).map(([qid, a]) => ({
        question_id:      parseInt(qid, 10),
        dimension_chosen: a.dimension,
        choice_label:     a.label,
      }))
      const res = await fleurApi.submit({
        definition_slug: DEFINITION_SLUG,
        consent: true,
        answers: answersPayload,
      })
      setResult(res)
    } catch (e) {
      const detail = e?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null); setAnswers({}); setCurrentIndex(0); setError('')
    if (resultIdParam) router.replace('/fleur')
  }

  if (resultIdParam && loadingResult) {
    return (
      <div className="max-w-lg mx-auto py-16 flex flex-col items-center justify-center">
        <span className="w-10 h-10 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        <p className="mt-4 text-slate-500">{t('fleur.loadingResult')}</p>
      </div>
    )
  }

  if (result) return (
    <div className="max-w-lg mx-auto py-4">
      <ResultView result={result} answers={Object.keys(answers).length > 0 ? answers : loadedAnswers} onReset={reset} />
    </div>
  )

  if (loadingQ) return (
    <div className="max-w-lg mx-auto py-10 text-center text-slate-500">
      <div className="animate-spin w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full mx-auto mb-4" />
      {t('fleur.loadingQuestions')}
    </div>
  )

  if (errorQ) return (
    <div className="max-w-lg mx-auto py-10 text-center space-y-4">
      <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-6 text-red-600 dark:text-red-400">
        {errorQ}
        <p className="text-xs text-red-500 dark:text-red-400/80 mt-2">{t('fleur.serverHint')}</p>
      </div>
      <button
        onClick={loadQuestions}
        className="px-5 py-2.5 bg-accent text-white rounded-xl font-semibold hover:bg-accent-hover transition-colors">
        {t('common.retry')}
      </button>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto space-y-4 py-2">
      {!hasCompletedFirstFleur && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4">
          <p className="text-sm text-violet-700 dark:text-violet-300">
            💡 {t('onboarding.fleurIntro')}
          </p>
        </div>
      )}
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">{t('fleur.introTitle')}</h2>
        <p className="text-sm text-slate-500 italic">
          {t('fleur.introDesc', { count: questions.length })}
        </p>
      </div>

      <ProgressBar answered={answered} total={questions.length} />

      <div className="space-y-3">
        {currentIndex < questions.length && (() => {
          const q = questions[currentIndex]
          const chosen = answers[q.id]
          return (
            <div key={q.id}
              className="rounded-2xl border p-4 transition-all duration-300 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              style={{ animation: 'fadeIn 0.3s ease' }}
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
                <span className="text-accent font-mono mr-2">{currentIndex + 1}.</span>
                {q.label}
              </p>
              <div className="space-y-2">
                {q.choices.map((c) => {
                  const isChosen = chosen?.choiceId === c.id
                  return (
                    <label key={c.id}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border
                        ${isChosen
                          ? 'border-accent bg-accent text-white'
                          : 'border-slate-100 dark:border-slate-800 hover:border-accent/40 hover:bg-accent/5 dark:hover:bg-accent/10 text-slate-700 dark:text-slate-200'}`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={isChosen}
                        onChange={() => choose(q.id, c)}
                        className="sr-only"
                      />
                      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                        ${isChosen ? 'border-white bg-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {isChosen && <span className="w-2 h-2 rounded-full bg-accent block" />}
                      </span>
                      <span className="text-sm leading-snug">{c.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>


      {/* Commentaire libre — oral ou écrit */}
      {allDone && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-2"
          style={{ animation: 'fadeIn 0.5s ease' }}>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('fleur.feelingsLabel')}</p>
          <p className="text-xs text-slate-400">{t('fleur.feelingsHint')}</p>
          <VoiceTextInput
            value={comment}
            onChange={setComment}
            placeholder={t('fleur.feelingsPlaceholder')}
            rows={3}
          />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {allDone && (
        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[.98] shadow bg-accent hover:bg-accent-hover text-white"
          style={{ animation: 'fadeIn 0.4s ease' }}
        >
          {loading ? t('fleur.calculating') : t('fleur.drawFlower')}
        </button>
      )}
      <div className="flex justify-center pt-4">
        <BuyTarotCTA variant="compact" />
      </div>
      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  )
}
