// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { fleurApi, getDuoInviteUrl } from '@/api/fleur'
import { useAuth } from '@/contexts/AuthContext'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'
import { FleurInterpretation } from '@/components/FleurInterpretation'
import { VoiceTextInput } from '@/components/VoiceTextInput'
import { BuyTarotCTA } from '@/components/BuyTarotCTA'

// Questionnaire individuel pour chaque participant du DUO
const DEFINITION_SLUG = 'fleur-amour-individuel'

const PETAL_LABELS = {
  agape: 'Agapè', philautia: 'Philautia', mania: 'Mania', storge: 'Storgè',
  pragma: 'Pragma', philia: 'Philia', ludus: 'Ludus', eros: 'Éros',
}
const ZONE_COLOR = {
  active:  'bg-accent/10 text-accent border-accent/20',
  retrait: 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200',
  neutre:  'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800',
}

/* ── Barre de progression ──────────────────────────────────── */
function ProgressBar({ answered, total }) {
  const pct = Math.round((answered / total) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{t('fleur.questionsCount', { answered, total })}</span><span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all duration-300 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/* ── Formulaire 24 questions — charge depuis l'API (email = compte connecté) ─────────── */
function Questionnaire({ onSubmit, loading, partnerToken = null }) {
  const locale = useStore((s) => s.locale)
  const [questions, setQuestions] = useState([])
  const [loadingQ, setLoadingQ]   = useState(true)
  const [errorQ, setErrorQ]       = useState('')
  const [answers, setAnswers]     = useState({})  // { [questionId]: { choiceId, dimension, label } }
  const [currentIndex, setCurrentIndex] = useState(0)
  const [comment, setComment]     = useState('')
  const [error, setError]         = useState('')

  function loadQuestions() {
    setErrorQ('')
    setLoadingQ(true)
    fleurApi.getQuestions(DEFINITION_SLUG, locale)
      .then(data => { setQuestions(data); setErrorQ('') })
      .catch(() => setErrorQ(t('fleur.loadQuestionsError')))
      .finally(() => setLoadingQ(false))
  }
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

  function handleSubmit() {
    if (!allDone) { setError(t('fleur.answerAll', { total: questions.length, answered })); return }
    setError('')
    const answersPayload = Object.entries(answers).map(([qid, a]) => ({
      question_id:      parseInt(qid, 10),
      dimension_chosen: a.dimension,
      choice_label:     a.label,
    }))
    onSubmit({
      definition_slug: DEFINITION_SLUG,
      consent: true,
      answers: answersPayload,
      ...(partnerToken ? { partner_token: partnerToken } : { intended_duo: true }),
    })
  }

  if (loadingQ) return (
    <div className="py-10 text-center text-slate-500">
      <div className="animate-spin w-8 h-8 border-4 border-accent/30 border-t-accent rounded-full mx-auto mb-4" />
      {t('duo.loadingQuestions')}
    </div>
  )
  if (errorQ) return (
    <div className="space-y-3 text-center">
      <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-red-600 dark:text-red-400 text-sm">
        {errorQ}
      </div>
      <button onClick={loadQuestions} className="px-5 py-2.5 bg-accent text-white rounded-xl font-semibold hover:opacity-90 transition-opacity">
        {t('common.retry')}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      <ProgressBar answered={answered} total={questions.length} />

      <div className="space-y-3">
        {currentIndex < questions.length && (() => {
          const q = questions[currentIndex]
          const chosen = answers[q.id]
          return (
            <div key={q.id} className="rounded-2xl border p-4 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" style={{ animation: 'fadeIn 0.3s ease' }}>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
                <span className="text-accent font-mono mr-2">{currentIndex + 1}.</span>{q.label}
              </p>
              <div className="space-y-2">
                {q.choices.map((c) => {
                  const isChosen = chosen?.choiceId === c.id
                  return (
                    <label key={c.id}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors border
                        ${isChosen ? 'border-accent bg-accent text-white' : 'border-slate-100 dark:border-slate-800 hover:border-accent/40 hover:bg-accent/5 text-slate-700 dark:text-slate-200'}`}
                    >
                      <input type="radio" name={`q-${q.id}`} checked={isChosen} onChange={() => choose(q.id, c)} className="sr-only" />
                      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isChosen ? 'border-white bg-white' : 'border-slate-300 dark:border-slate-600'}`}>
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
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-2">
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
        <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {allDone && (
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[.98] shadow bg-accent hover:bg-accent-hover text-white"
          style={{ animation: 'fadeIn 0.4s ease' }}>
          {loading ? t('fleur.calculating') : t('fleur.drawFlower')}
        </button>
      )}
      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  )
}

/* ── Résultat solo (mini) ─────────────────────────────────── */
function SoloResult({ result }) {
  useStore((s) => s.locale)
  const { scores, analysis, composite } = result
  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 dark:bg-accent/10 p-5 space-y-4">
      <h3 className="font-bold text-center text-lg text-accent">{t('duo.yourFlower')} 🌸</h3>
      <div className="flex justify-center">
        <FlowerSVG petals={scoresToPetals(scores)} size={240} animate showLabels />
      </div>
      <FleurInterpretation scores={scores} resultId={result?.id} interpretation={result?.interpretation} compact />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {Object.entries(scores).map(([p, v]) => (
          <div key={p} className={`rounded-xl border px-1.5 py-1.5 text-center text-xs ${ZONE_COLOR[analysis?.zones?.[p] ?? 'neutre']}`}>
            <div className="text-base font-bold">{v}</div>
            <div className="leading-tight">{PETAL_LABELS[p]}</div>
          </div>
        ))}
      </div>
      {analysis?.global && <p className="text-xs italic text-slate-600 dark:text-slate-400 leading-relaxed">{analysis.global}</p>}
      {composite && (
        <div className="flex gap-4 justify-center">
          {[['coherence_index','coherence','text-indigo-500'], ['vitality_index','vitality','text-emerald-500'], ['stability_index','stability','text-amber-500']].map(([k, key, cls]) => (
            <div key={k} className="text-center">
              <div className={`text-xl font-bold ${cls}`}>{Math.round((composite[k] ?? 0) * 100)}%</div>
              <div className="text-xs text-slate-500">{t(`fleur.${key}`)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Calcule scores DUO (moyenne) et zones (stable, adjust, desync, fragile) côté client si API ne fournit pas. */
function computeDuoAnalysis(person_a, person_b) {
  const scoresA = person_a?.scores ?? {}
  const scoresB = person_b?.scores ?? {}
  const keys = ['agape','philautia','mania','storge','pragma','philia','ludus','eros']
  const duo = {}
  keys.forEach(k => { duo[k] = ((scoresA[k] ?? 0) + (scoresB[k] ?? 0)) / 2 })
  const stable = {}, adjust = {}, desync = {}, fragile = {}
  keys.forEach(k => {
    const a = scoresA[k] ?? 0
    const b = scoresB[k] ?? 0
    const diff = Math.abs(a - b)
    const avg = duo[k]
    if (diff <= 0.5 && avg >= 2) stable[k] = avg
    else if (diff <= 1 && avg >= 1.5) adjust[k] = avg
    else if (diff > 1.5) desync[k] = avg
    else fragile[k] = avg
  })
  return { duo, stable, adjust, desync, fragile }
}

/** Affiche le nom d'une personne : display_name > pseudo > email > fallback */
function personLabel(person, fallback) {
  if (person?.display_name?.trim()) return person.display_name.trim()
  if (person?.pseudo?.trim()) return person.pseudo.trim()
  if (person?.email?.trim()) return person.email.trim()
  return fallback
}

/* ── Résultat DUO ─────────────────────────────────────────── */
function DuoResult({ duoData, onReset, currentUser }) {
  useStore((s) => s.locale)
  const { person_a, person_b, duo: apiDuo } = duoData
  const uid = currentUser?.id != null ? Number(currentUser.id) : null
  const isPersonA = uid && Number(person_a?.user_id) === uid
  const isPersonB = uid && Number(person_b?.user_id) === uid
  const duo = apiDuo ?? computeDuoAnalysis(person_a, person_b)
  const duoScores = duo?.duo ?? {}
  const [aiExplanation, setAiExplanation] = useState(null) // null=loading, string=text, false=error/fallback

  useEffect(() => {
    fleurApi.getDuoExplanation({ person_a, person_b, duo })
      .then(r => setAiExplanation(r.explanation || t('duo.staticExplanation')))
      .catch(() => setAiExplanation(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sections = [
    { key: 'stable',  labelKey: 'inPhase',     color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800' },
    { key: 'adjust',  labelKey: 'toAdjust',    color: 'text-amber-800 dark:text-amber-300',    bg: 'bg-amber-100 dark:bg-amber-950 border-amber-200 dark:border-amber-800' },
    { key: 'desync',  labelKey: 'desync',      color: 'text-red-700 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' },
    { key: 'fragile', labelKey: 'fragileZones', color: 'text-slate-600 dark:text-slate-400',   bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
  ]

  return (
    <div className="space-y-6" style={{ animation: 'fadeIn .5s ease' }}>
      <h2 className="text-2xl font-bold text-center">{t('duo.duoResultTitle')} 🌸💞🌸</h2>

      {/* Fleur superposée : les deux profils sur un même radar */}
      <div className="flex flex-col items-center">
        <p className="text-xs font-medium text-slate-500 mb-1">{t('duo.twoFlowersOverlay')}</p>
        <p className="text-[10px] text-slate-400 mb-2">{t('duo.legendAB')}</p>
        <div className="flex justify-center w-full">
        <FlowerSVG
          petalsA={scoresToPetals(person_a.scores)}
          petalsB={scoresToPetals(person_b.scores)}
          size={240}
          animate
          showLabels
          showScores
        />
        </div>
      </div>

      <FleurInterpretation compact scores={duoScores} />

      {/* Fleurs individuelles (différenciées par couleur) */}
      <div className="flex flex-wrap justify-center gap-6">
        <div className="text-center">
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">
            {t('duo.personA')} {isPersonA ? `(${t('duo.you')})` : isPersonB ? `(${t('duo.yourPartner')})` : ''} — {personLabel(person_a, t('duo.personALauncher'))}
          </p>
          <FlowerSVG petals={scoresToPetals(person_a.scores)} variant="personA" size={140} animate showLabels />
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
            {t('duo.personB')} {isPersonB ? `(${t('duo.you')})` : isPersonA ? `(${t('duo.yourPartner')})` : ''} — {personLabel(person_b, t('duo.personBInvited'))}
          </p>
          <FlowerSVG petals={scoresToPetals(person_b.scores)} variant="personB" size={140} animate showLabels />
        </div>
      </div>

      {/* Profils individuels */}
      <div className="grid sm:grid-cols-2 gap-4">
        {[[t('duo.personA'), person_a, 'border-accent/30 bg-accent/5', isPersonA], [t('duo.personB'), person_b, 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30', isPersonB]].map(([label, person, cls, isMe]) => (
          <div key={label} className={`rounded-2xl border p-4 space-y-3 ${cls}`}>
            <h4 className="font-semibold text-sm">{label} {isMe ? `(${t('duo.you')})` : (isPersonA || isPersonB) ? `(${t('duo.yourPartner')})` : ''} — {personLabel(person, t('duo.anonymous'))}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              {Object.entries(person.scores).map(([p, v]) => (
                <div key={p} className={`rounded-lg border px-1 py-1 text-center text-xs ${ZONE_COLOR[person.analysis?.zones?.[p] ?? 'neutre']}`}>
                  <div className="font-bold">{v}</div>
                  <div className="leading-none text-[10px]">{PETAL_LABELS[p]}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Explication des zones DUO — personnalisée par l'IA */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-5 space-y-4">
        <h4 className="font-semibold text-base text-slate-800 dark:text-slate-200">{t('duo.relationalState')}</h4>
        {aiExplanation === null ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            {t('duo.generatingExplanation')}
          </div>
        ) : (
          <div className="text-slate-600 dark:text-slate-300 text-base leading-relaxed text-left space-y-4 max-w-prose">
            {(aiExplanation || t('duo.staticExplanation'))
              .split(/\n\n+/)
              .filter(Boolean)
              .map((para, i) => (
                <p key={i} className="first:mt-0">{para.trim()}</p>
              ))}
          </div>
        )}
      </div>

      {/* Zones DUO */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span><span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" />A : {personLabel(person_a, t('duo.personALegend'))}{isPersonA ? ` (${t('duo.you')})` : ''}</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />B : {personLabel(person_b, t('duo.personBLegend'))}{isPersonB ? ` (${t('duo.you')})` : ''}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {sections.map(({ key, labelKey, color, bg }) => {
          const petals = Object.keys(duo?.[key] ?? {})
          if (!petals.length) return null
          return (
            <div key={key} className={`rounded-xl border p-3 ${bg}`}>
              <p className={`text-xs font-semibold mb-2 ${color}`}>{t(`duo.${labelKey}`)}</p>
              <div className="flex flex-wrap gap-1.5">
                {petals.map(p => {
                  const scoreA = (person_a.scores?.[p] ?? 0).toFixed(1)
                  const scoreB = (person_b.scores?.[p] ?? 0).toFixed(1)
                  return (
                    <div key={p} className="px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-slate-900/60 border border-white/50 dark:border-white/10 text-xs font-medium space-y-0.5 shadow-sm">
                      <div className="font-semibold text-center text-slate-800 dark:text-slate-100">{PETAL_LABELS[p]}</div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-rose-700 dark:text-rose-400 font-semibold">{scoreA}</span>
                        <span className="text-slate-500 dark:text-slate-400">vs</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{scoreB}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={onReset}
        className="w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
        {t('duo.newDuoReading')}
      </button>
      <div className="flex justify-center pt-4">
        <BuyTarotCTA variant="compact" />
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

/* ── Page principale DUO ──────────────────────────────────── */
const STEP = {
  INTRO:       'intro',
  FORM_A:      'form_a',
  SOLO_RESULT: 'solo_result',
  FORM_B:      'form_b',
  DUO_RESULT:  'duo_result',
}

export default function DuoPage() {
  const { user } = useAuth()
  useStore((s) => s.locale)
  const searchParams = useSearchParams()
  const [step, setStep] = useState(STEP.INTRO)
  const [token, setToken]           = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [soloResult, setSoloResult] = useState(null)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [inviteSent, setInviteSent]     = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [duoData, setDuoData]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [checkLoading, setCheckLoading] = useState(false)
  const [error, setError]       = useState('')

  const inviteUserId = searchParams.get('invite_user_id')
  const invitePseudo = decodeURIComponent(searchParams.get('invite_pseudo') || '')

  // Si URL contient ?token=xxx → charger le résultat ou afficher le questionnaire partenaire B
  useEffect(() => {
    const t = searchParams.get('token')
    if (!t) return
    setToken(t)
    setCheckLoading(true)
    fleurApi.getDuoResult(t)
      .then(r => {
        if (r.status === 'complete') {
          setDuoData(r)
          setStep(STEP.DUO_RESULT)
        } else if (r.status === 'waiting_partner') {
          setDuoData(r)  // pour afficher qui a invité (person_a)
          setStep(STEP.FORM_B)
        } else {
          setStep(STEP.FORM_B)
        }
      })
      .catch(() => { setStep(STEP.FORM_B); setError(t('duo.tokenNotFound')) })
      .finally(() => setCheckLoading(false))
  }, [searchParams])

  function reset() {
    setStep(STEP.INTRO); setToken(''); setTokenInput(''); setSoloResult(null)
    setPartnerEmail(''); setInviteSent(false); setDuoData(null); setError('')
  }

  async function submitA(payload) {
    setLoading(true); setError('')
    try {
      const res = await fleurApi.submit(payload)
      setSoloResult(res)
      setToken(res.token)
      setStep(STEP.SOLO_RESULT)
    } catch (e) {
      const detail = e?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : t('duo.submitError'))
    } finally { setLoading(false) }
  }

  async function submitB(payload) {
    setLoading(true); setError('')
    try {
      const res = await fleurApi.submit({ ...payload, partner_token: token })
      // Charger le résultat DUO complet via le token de A
      const duo = await fleurApi.getDuoResult(token)
      if (duo.status === 'complete') {
        setDuoData(duo)
        setStep(STEP.DUO_RESULT)
      } else {
        setSoloResult(res)
        setError(t('duo.duoNotYet'))
      }
    } catch (e) {
      const detail = e?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Erreur : token invalide ou expiré.')
    } finally { setLoading(false) }
  }

  async function sendInvite() {
    if (!partnerEmail.trim() || !token) return
    setInviteLoading(true); setError('')
    try {
      const res = await fleurApi.invitePartner(partnerEmail.trim(), token)
      if (res?.sent) {
        setInviteSent(true)
      } else {
        setError(t('duo.inviteFailed'))
      }
    } catch (e) {
      const detail = e?.response?.data?.detail ?? e?.message
      setError(typeof detail === 'string' ? detail : t('duo.inviteError'))
    } finally { setInviteLoading(false) }
  }

  async function sendInviteByUserId() {
    if (!inviteUserId || !token) return
    setInviteLoading(true); setError('')
    try {
      const res = await fleurApi.invitePartnerByUserId(token, parseInt(inviteUserId, 10))
      if (res?.sent) {
        setInviteSent(true)
      } else {
        setError(t('duo.inviteFailed'))
      }
    } catch (e) {
      const detail = e?.response?.data?.detail ?? e?.message
      setError(typeof detail === 'string' ? detail : t('duo.inviteError'))
    } finally { setInviteLoading(false) }
  }

  function copyToken() {
    if (!token) return
    navigator.clipboard?.writeText(token).then(() => setError(t('duo.tokenCopied')), () => setError(t('duo.copyTokenManual')))
  }
  function copyLink() {
    const url = getDuoInviteUrl(token)
    navigator.clipboard?.writeText(url).then(() => setError(t('duo.linkCopied')), () => setError(t('duo.copyLinkManual')))
  }

  async function checkDuo() {
    setCheckLoading(true); setError('')
    try {
      const r = await fleurApi.getDuoResult(token)
      if (r.status === 'waiting_partner') { setError(t('duo.partnerNotYet')) }
      else { setDuoData(r); setStep(STEP.DUO_RESULT) }
    } catch { setError(t('duo.tokenNotFound')) }
    finally { setCheckLoading(false) }
  }

  async function loadByToken() {
    if (!tokenInput.trim()) return
    setCheckLoading(true); setError('')
    try {
      const r = await fleurApi.getDuoResult(tokenInput.trim())
      setToken(tokenInput.trim())
      if (r.status === 'complete') { setDuoData(r); setStep(STEP.DUO_RESULT) }
      else { setSoloResult(r.person_a); setStep(STEP.SOLO_RESULT) }
    } catch { setError(t('duo.tokenNotFound')) }
    finally { setCheckLoading(false) }
  }

  // ── Rendu ──────────────────────────────────────────────────
  if (step === STEP.DUO_RESULT && duoData) {
    return <div className="max-w-lg mx-auto py-4"><DuoResult duoData={duoData} onReset={reset} currentUser={user} /></div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 py-2">

      {/* INTRO */}
      {step === STEP.INTRO && (
        <>
          {inviteUserId && (
            <div className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/40 p-4 text-center">
              <p className="text-sm text-violet-800 dark:text-violet-200">{t('duo.inviteFromPrairieBanner', { pseudo: invitePseudo || t('duo.personBInvited') })}</p>
            </div>
          )}
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold">{t('duo.title')}</h2>
            <p className="text-sm text-slate-500 italic">{t('duo.subtitle')}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold">{t('duo.howItWorks')}</h3>
              <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-decimal list-inside">
                <li>{t('duo.how1')}</li>
                <li>{t('duo.how2')}</li>
                <li>{t('duo.how3')}</li>
                <li>{t('duo.how4')}</li>
              </ol>
            </div>
            <button onClick={() => setStep(STEP.FORM_A)}
              className="w-full py-3 bg-accent text-white rounded-xl font-semibold text-sm hover:bg-accent-hover transition-colors">
              {t('duo.start')}
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="font-semibold text-sm">{t('duo.resumeExisting')}</h3>
            <div className="flex gap-2">
              <input className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder={t('duo.pasteToken')}
                value={tokenInput} onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadByToken()} />
              <button onClick={loadByToken} disabled={checkLoading}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors">
                {checkLoading ? '…' : t('duo.resume')}
              </button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </>
      )}

      {/* FORM A */}
      {step === STEP.FORM_A && (
        <>
          <div className="text-center space-y-0.5">
            <h2 className="text-xl font-bold">{t('duo.personATitle')}</h2>
            <p className="text-sm text-slate-500 italic">{t('duo.personADesc')}</p>
          </div>
          {error && <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}
          <Questionnaire onSubmit={submitA} loading={loading} />
        </>
      )}

      {/* RÉSULTAT SOLO + INVITATION */}
      {step === STEP.SOLO_RESULT && soloResult && (
        <>
          <div className="text-center"><h2 className="text-xl font-bold">{t('duo.soloTitle')}</h2></div>
          <SoloResult result={soloResult} />

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('duo.yourTokenLabel')}</p>
            <div className="flex gap-1.5 items-start">
              <code className="flex-1 min-w-0 text-xs font-mono text-accent break-all bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">{token}</code>
              <button type="button" onClick={copyToken} disabled={!token} title="Copier le token"
                className="shrink-0 p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg disabled:opacity-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
            <p className="text-xs text-slate-400">{t('duo.shareLinkToPartner')}</p>
            <div className="flex gap-1.5 items-start">
              <code className="flex-1 min-w-0 text-xs font-mono break-all text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-1.5">
                {getDuoInviteUrl(token)}
              </code>
              <button type="button" onClick={copyLink} disabled={!token} title={t('duo.copyLink')}
                className="shrink-0 p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg disabled:opacity-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-3">
            <h3 className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">{t('duo.inviteByEmail')}</h3>
            {inviteUserId && !inviteSent && (
              <div className="pb-3 border-b border-emerald-200 dark:border-emerald-800">
                <button
                  onClick={sendInviteByUserId}
                  disabled={inviteLoading}
                  className="w-full py-2.5 bg-violet-500 text-white rounded-xl text-sm font-semibold hover:bg-violet-600 disabled:opacity-50 transition-colors"
                >
                  💕 {inviteLoading ? '…' : t('duo.inviteFromPrairie', { pseudo: invitePseudo || t('duo.personBInvited') })}
                </button>
              </div>
            )}
            {inviteSent ? (
              <div className="space-y-3">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">{t('duo.inviteSentTo', { email: partnerEmail })}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{t('duo.inviteHint')}</p>
                <button onClick={checkDuo} disabled={checkLoading}
                  className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 transition-colors">
                  {checkLoading ? t('duo.checking') : t('duo.checkPartner')}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input type="email"
                    className="flex-1 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    placeholder={t('duo.partnerEmailPlaceholder')}
                    value={partnerEmail} onChange={e => { setPartnerEmail(e.target.value); setError('') }} />
                  <button onClick={sendInvite} disabled={inviteLoading || !partnerEmail.trim()}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                    {inviteLoading ? '…' : t('duo.send')}
                  </button>
                </div>
                <button onClick={copyLink} disabled={!token}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
                  {t('duo.copyLink')}
                </button>
              </div>
            )}
            {error && <p className={`text-sm ${error === t('duo.tokenCopied') || error === t('duo.linkCopied') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{error}</p>}
          </div>
        </>
      )}

      {/* FORM B (partenaire) */}
      {step === STEP.FORM_B && (
        <>
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold">{t('duo.personBTitle')}</h2>
            <p className="text-sm text-slate-500 italic">
              {duoData?.person_a?.email ? t('duo.personBDesc', { email: duoData.person_a.email }) : t('duo.personBDescNoEmail')}
            </p>
            <p className="text-xs text-slate-400">Token : <code className="font-mono text-accent">{token}</code></p>
          </div>
          {error && <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>}
          <Questionnaire onSubmit={submitB} loading={loading} partnerToken={token} />
        </>
      )}

      {/* CTA achat Tarot — visible sur tous les formulaires */}
      <div className="flex justify-center pt-2">
        <BuyTarotCTA variant="compact" />
      </div>
    </div>
  )
}
