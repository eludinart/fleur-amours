// @ts-nocheck
'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { fleurBetaApi } from '@/api/fleur-beta'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { FOUR_DOORS } from '@/data/tarotCards'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'
import { FleurInterpretation } from '@/components/FleurInterpretation'
import {
  FLEUR_BETA_CHOICE_VALUES,
  isFleurBetaDoorKey,
  type FleurBetaDoorKey,
} from '@/lib/fleur-beta-data'

const CHOICE_LABEL_KEYS = ['fleurBeta.choice0', 'fleurBeta.choice1', 'fleurBeta.choice2', 'fleurBeta.choice3']

function ProgressBar({ answered, total }) {
  const pct = Math.round((answered / total) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>
          {answered} / {total} {t('fleurBeta.questionsShort')}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all duration-300 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ResultBetaView({ result, answersForInterpretation, onReset }) {
  const locale = useStore((s) => s.locale)
  const [storedInterpretation, setStoredInterpretation] = useState(() => result.interpretation ?? null)
  const [interpretationMountKey, setInterpretationMountKey] = useState(0)
  const [regenBusy, setRegenBusy] = useState(false)
  const [regenError, setRegenError] = useState('')
  const prevResultIdRef = useRef(undefined)

  useEffect(() => {
    const id = Number(result.id)
    setStoredInterpretation(result.interpretation ?? null)
    if (prevResultIdRef.current !== undefined && prevResultIdRef.current !== id) {
      setInterpretationMountKey((k) => k + 1)
    }
    prevResultIdRef.current = id
  }, [result.id, result.interpretation])

  async function regenerateInterpretation() {
    setRegenError('')
    setRegenBusy(true)
    try {
      const data = await fleurBetaApi.interpretation({
        result_id: Number(result.id),
        locale: locale || 'fr',
        force: true,
      })
      setStoredInterpretation({
        summary: data.summary ?? '',
        insights: data.insights ?? '',
        reflection: data.reflection ?? '',
      })
      setInterpretationMountKey((k) => k + 1)
    } catch {
      setRegenError(t('fleur.interpretation.error'))
    } finally {
      setRegenBusy(false)
    }
  }

  const scores = result.scores || {}
  const dominant = Object.entries(scores).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0]
  const petalLabels = {
    agape: 'Agapè',
    philautia: 'Philautia',
    mania: 'Mania',
    storge: 'Storgè',
    pragma: 'Pragma',
    philia: 'Philia',
    ludus: 'Ludus',
    eros: 'Éros',
  }
  const scoresPercent = Object.fromEntries(
    Object.entries(scores).map(([k, v]) => [k, Math.round(Math.min(1, Math.max(0, Number(v))) * 100)])
  )

  return (
    <div className="space-y-6" style={{ animation: 'fadeIn .5s ease' }}>
      <div className="text-center space-y-1">
        <h3 className="text-2xl font-bold text-accent">
          {t('fleurBeta.resultTitle')} 🧪
        </h3>
        {dominant && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('fleur.dominant')}: <strong>{petalLabels[dominant] ?? dominant}</strong>
          </p>
        )}
        <p className="text-xs text-slate-500">{t('fleurBeta.versionLabel')}</p>
      </div>

      <div className="flex justify-center">
        <FlowerSVG petals={scoresToPetals(scores)} size={280} animate showLabels />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(scores).map(([p, v]) => (
          <div
            key={p}
            className="rounded-xl border border-slate-200 dark:border-slate-600 px-2 py-2 text-center text-xs bg-white dark:bg-slate-900"
          >
            <div className="text-lg font-bold text-accent">{Math.round(Number(v) * 100)}%</div>
            <div>{petalLabels[p] ?? p}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-slate-500">{t('fleurBeta.regenerateHint')}</p>
        <button
          type="button"
          onClick={regenerateInterpretation}
          disabled={regenBusy}
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium border border-violet-300 dark:border-violet-600 text-violet-800 dark:text-violet-200 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {regenBusy ? t('fleurBeta.regenerating') : t('fleurBeta.regenerateAi')}
        </button>
      </div>
      {regenError && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{regenError}</p>
      )}

      <FleurInterpretation
        key={`${result.id}-${interpretationMountKey}`}
        scores={scoresPercent}
        answers={answersForInterpretation}
        resultId={result.id}
        interpretation={storedInterpretation}
        interpretationApi="fleur-beta"
        collapseReferenceSection
        showOuterHeading={false}
        compact={false}
      />

      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={onReset}
          className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          {t('fleurBeta.newRun')}
        </button>
        <Link
          href="/fleur"
          className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          {t('fleurBeta.classicFleur')}
        </Link>
      </div>

      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  )
}

export default function FleurBetaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resultIdParam = searchParams?.get?.('result') ?? null

  const [step, setStep] = useState<'porte' | 'quiz' | 'result'>(() => (resultIdParam ? 'result' : 'porte'))
  const [porte, setPorte] = useState<FleurBetaDoorKey | null>(null)

  const [questions, setQuestions] = useState([])
  const [loadingQ, setLoadingQ] = useState(false)
  const [errorQ, setErrorQ] = useState('')

  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [loadingResult, setLoadingResult] = useState(!!resultIdParam)
  const fetchedResultParamRef = useRef<string | null>(null)

  useEffect(() => {
    if (!resultIdParam) {
      setLoadingResult(false)
      fetchedResultParamRef.current = null
      return
    }
    const id = parseInt(resultIdParam, 10)
    if (!id) {
      setLoadingResult(false)
      return
    }
    if (fetchedResultParamRef.current === resultIdParam) {
      setLoadingResult(false)
      setStep('result')
      return
    }
    setLoadingResult(true)
    fleurBetaApi
      .getResult(String(id))
      .then((data) => {
        fetchedResultParamRef.current = resultIdParam
        setResult(data)
        setStep('result')
      })
      .catch(() => setError(t('fleur.resultNotFound')))
      .finally(() => setLoadingResult(false))
  }, [resultIdParam])

  function loadQuestionsForPorte(p: FleurBetaDoorKey) {
    setErrorQ('')
    setLoadingQ(true)
    fleurBetaApi
      .getQuestions(p)
      .then((data) => {
        setQuestions(data.questions || [])
        setPorte(p)
        setStep('quiz')
        setAnswers({})
        setCurrentIndex(0)
        setErrorQ('')
      })
      .catch(() => setErrorQ(t('fleur.loadQuestionsError')))
      .finally(() => setLoadingQ(false))
  }

  const answered = Object.keys(answers).length
  const allDone = questions.length > 0 && answered === questions.length

  function choose(questionId, value, choiceIndex) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { value, choiceIndex, questionId },
    }))
    setCurrentIndex((i) => Math.min(i + 1, questions.length))
  }

  async function submit() {
    if (!porte || !allDone) {
      setError(t('fleur.answerAll', { total: questions.length, answered }))
      return
    }
    setError('')
    setLoading(true)
    try {
      const answersPayload = questions.map((q) => ({
        questionId: q.id,
        value: answers[q.id]?.value ?? 0,
      }))
      const res = await fleurBetaApi.submit({
        porte,
        answers: answersPayload,
        questionnaire_version: '2-beta',
      })
      fetchedResultParamRef.current = String(res.id)
      setResult(res)
      setStep('result')
      router.replace('/fleur-beta?result=' + res.id)
    } catch (e) {
      const detail = e?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : t('errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    fetchedResultParamRef.current = null
    setResult(null)
    setAnswers({})
    setCurrentIndex(0)
    setError('')
    setQuestions([])
    setPorte(null)
    setStep('porte')
    if (resultIdParam) router.replace('/fleur-beta')
  }

  const answersForInterpretation = Object.entries(answers).map(([, a]) => ({
    dimension: '',
    label: t(CHOICE_LABEL_KEYS[a.choiceIndex] ?? 'fleurBeta.choice0'),
  }))

  if (resultIdParam && loadingResult) {
    return (
      <div className="max-w-lg mx-auto py-16 flex flex-col items-center justify-center">
        <span className="w-10 h-10 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
        <p className="mt-4 text-slate-500">{t('fleur.loadingResult')}</p>
      </div>
    )
  }

  if (result && step === 'result') {
    return (
      <div className="max-w-lg mx-auto py-4">
        <ResultBetaView result={result} answersForInterpretation={answersForInterpretation} onReset={reset} />
      </div>
    )
  }

  if (step === 'porte') {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">{t('fleurBeta.doorTitle')}</h2>
          <p className="text-sm text-slate-500">{t('fleurBeta.doorSubtitle')}</p>
        </div>
        <div className="grid gap-3">
          {FOUR_DOORS.map((d) => (
            <button
              key={d.key}
              type="button"
              disabled={loadingQ}
              onClick={() => {
                if (!isFleurBetaDoorKey(d.key)) return
                loadQuestionsForPorte(d.key)
              }}
              className={`rounded-2xl border-2 p-4 text-left transition-all hover:scale-[1.01] ${d.border} bg-white dark:bg-slate-900`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{d.aspect}</span>
              <p className="font-bold text-lg mt-1">{d.subtitle}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{d.title}</p>
            </button>
          ))}
        </div>
        {loadingQ && (
          <p className="text-center text-sm text-slate-500">{t('fleur.loadingQuestions')}</p>
        )}
        {errorQ && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-red-600 text-sm">
            {errorQ}
          </div>
        )}
      </div>
    )
  }

  if (loadingQ && questions.length === 0) {
    return (
      <div className="max-w-lg mx-auto py-10 text-center text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full mx-auto mb-4" />
        {t('fleur.loadingQuestions')}
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 py-2">
      <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3">
        <p className="text-sm text-violet-800 dark:text-violet-200">
          🧪 {t('fleurBeta.banner')}
        </p>
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">{t('fleurBeta.quizTitle')}</h2>
        <p className="text-sm text-slate-500">{t('fleurBeta.quizDesc', { count: questions.length })}</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-snug">{t('fleurBeta.quizScaleExplain')}</p>
      </div>

      <ProgressBar answered={answered} total={questions.length} />

      <div className="space-y-3">
        {currentIndex < questions.length &&
          (() => {
            const q = questions[currentIndex]
            const chosen = answers[q.id]
            return (
              <div
                key={q.id}
                className="rounded-2xl border p-4 transition-all duration-300 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                style={{ animation: 'fadeIn 0.3s ease' }}
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
                  <span className="text-accent font-mono mr-2">{currentIndex + 1}.</span>
                  {q.text}
                </p>
                <div className="space-y-2">
                  {FLEUR_BETA_CHOICE_VALUES.map((val, idx) => {
                    const isChosen = chosen?.choiceIndex === idx
                    return (
                      <label
                        key={idx}
                        className={`flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border
                        ${isChosen
                          ? 'border-accent bg-accent text-white'
                          : 'border-slate-100 dark:border-slate-800 hover:border-accent/40 hover:bg-accent/5 dark:hover:bg-accent/10 text-slate-700 dark:text-slate-200'}`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={isChosen}
                          onChange={() => choose(q.id, val, idx)}
                          className="sr-only"
                        />
                        <span
                          className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                        ${isChosen ? 'border-white bg-white' : 'border-slate-300 dark:border-slate-600'}`}
                        >
                          {isChosen && <span className="w-2 h-2 rounded-full bg-accent block" />}
                        </span>
                        <span className="text-sm leading-snug">{t(CHOICE_LABEL_KEYS[idx])}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })()}
      </div>

      {allDone && (
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-accent text-white font-semibold hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? t('fleur.calculating') : t('fleurBeta.drawFlower')}
        </button>
      )}

      {error && <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 p-4 text-red-600 text-sm">{error}</div>}

      <button
        type="button"
        className="text-sm text-slate-500 underline"
        onClick={() => {
          setStep('porte')
          setQuestions([])
          setAnswers({})
          setCurrentIndex(0)
          setPorte(null)
        }}
      >
        {t('fleurBeta.changeDoor')}
      </button>

      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  )
}
