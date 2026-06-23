// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { fleurBetaApi } from '@/api/fleur-beta'
import { fleurApi } from '@/api/fleur'
import { aDeuxApi } from '@/api/a-deux'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { FOUR_DOORS } from '@/data/tarotCards'
import {
  FLEUR_BETA_CHOICE_VALUES,
  isFleurBetaDoorKey,
} from '@/lib/fleur-beta-data'

const DEFINITION_SLUG = 'fleur-amour-individuel'
const CHOICE_LABEL_KEYS = ['fleurBeta.choice0', 'fleurBeta.choice1', 'fleurBeta.choice2', 'fleurBeta.choice3']

export default function ADeuxInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') || ''
  const locale = useStore((s) => s.locale)

  const [pairing, setPairing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError(t('duo.tokenNotFound'))
      setLoading(false)
      return
    }
    aDeuxApi
      .getPairing(token)
      .then(async (data) => {
        setPairing(data)
        if (data.pairing?.status === 'complete') {
          router.replace(`/a-deux/result?token=${encodeURIComponent(token)}`)
          return
        }
        const qType = data.anchor?.questionnaire_type
        if (qType === 'complet') {
          const qs = await fleurApi.getQuestions(DEFINITION_SLUG, locale)
          setQuestions(qs)
        } else {
          const porte = data.anchor?.porte
          if (porte && isFleurBetaDoorKey(porte)) {
            const res = await fleurBetaApi.getQuestions(porte)
            setQuestions(res.questions || [])
          }
        }
      })
      .catch(() => setError(t('duo.tokenNotFound')))
      .finally(() => setLoading(false))
  }, [token, locale, router])

  const answered = Object.keys(answers).length
  const allDone = questions.length > 0 && answered === questions.length
  const isComplet = pairing?.anchor?.questionnaire_type === 'complet'
  const lockedPorte = pairing?.anchor?.porte

  async function submit() {
    if (!allDone || !token) return
    setSubmitting(true)
    setError('')
    try {
      if (isComplet) {
        const answersPayload = Object.entries(answers).map(([qid, a]) => ({
          question_id: parseInt(qid, 10),
          dimension_chosen: a.dimension,
          choice_label: a.label,
        }))
        await aDeuxApi.submitPartnerComplet(token, { answers: answersPayload })
      } else {
        const answersPayload = questions.map((q) => ({
          questionId: q.id,
          value: answers[q.id]?.value ?? 0,
        }))
        await aDeuxApi.submitPartnerPorte(token, {
          porte: lockedPorte,
          answers: answersPayload,
        })
      }
      router.replace(`/a-deux/result?token=${encodeURIComponent(token)}`)
    } catch (e) {
      setError((e as { message?: string })?.message || t('duo.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  function choosePorte(questionId, value, choiceIndex) {
    setAnswers((prev) => ({ ...prev, [questionId]: { value, choiceIndex } }))
    setCurrentIndex((i) => Math.min(i + 1, questions.length))
  }

  function chooseComplet(questionId, choice) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { dimension: choice.dimension, label: choice.label },
    }))
    setCurrentIndex((i) => Math.min(i + 1, questions.length))
  }

  if (loading) {
    return <div className="max-w-lg mx-auto py-16 text-center text-slate-500">{t('common.loading')}</div>
  }

  if (error && !pairing) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <p className="text-red-500">{error}</p>
        <Link href="/a-deux" className="text-accent underline">{t('aDeux.hubTitle')}</Link>
      </div>
    )
  }

  const doorInfo = !isComplet && lockedPorte ? FOUR_DOORS.find((d) => d.key === lockedPorte) : null

  return (
    <div className="max-w-lg mx-auto space-y-4 py-4">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold">{t('aDeux.partnerTitle')}</h1>
        <p className="text-sm text-slate-500">{t('aDeux.partnerDesc')}</p>
        {doorInfo && (
          <p className="text-xs text-accent font-medium">
            {t('aDeux.lockedPorte', { door: doorInfo.subtitle })}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {currentIndex < questions.length && (() => {
          const q = questions[currentIndex]
          const chosen = answers[q.id]
          return (
            <div key={q.id} className="rounded-2xl border p-4 bg-white dark:bg-slate-900">
              <p className="text-sm font-semibold mb-3">
                <span className="text-accent font-mono mr-2">{currentIndex + 1}.</span>
                {isComplet ? q.label : q.text}
              </p>
              <div className="space-y-2">
                {isComplet
                  ? q.choices.map((c) => (
                      <label key={c.id} className={`block px-3 py-2 rounded-xl border cursor-pointer ${chosen?.label === c.label ? 'border-accent bg-accent text-white' : ''}`}>
                        <input type="radio" className="sr-only" onChange={() => chooseComplet(q.id, c)} />
                        {c.label}
                      </label>
                    ))
                  : FLEUR_BETA_CHOICE_VALUES.map((val, idx) => (
                      <label key={idx} className={`block px-3 py-2 rounded-xl border cursor-pointer ${chosen?.choiceIndex === idx ? 'border-accent bg-accent text-white' : ''}`}>
                        <input type="radio" className="sr-only" onChange={() => choosePorte(q.id, val, idx)} />
                        {t(CHOICE_LABEL_KEYS[idx])}
                      </label>
                    ))}
              </div>
            </div>
          )
        })()}
      </div>

      {allDone && (
        <button type="button" onClick={submit} disabled={submitting} className="w-full py-3 rounded-xl bg-accent text-white font-semibold">
          {submitting ? t('fleur.calculating') : t('aDeux.submitPartner')}
        </button>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
