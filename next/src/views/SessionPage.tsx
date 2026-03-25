// @ts-nocheck — TODO: add proper types after migration
'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { createPortal } from 'react-dom'
import { FlowerSVG, PetalSlider, PETAL_DEFS } from '@/components/FlowerSVG'
import { CrystalTimeline } from '@/components/CrystalTimeline'
import { ConfirmationModal } from '@/components/ConfirmationModal'
import { sapApi } from '@/api/billing'
import { useSpeech } from '@/hooks/useSpeech'
import { useAuth } from '@/contexts/AuthContext'
import { aiApi } from '@/api/ai'
import { sessionsApi } from '@/api/sessions'
import { billingApi } from '@/api/billing'
import { toast } from '@/hooks/useToast'
import { FOUR_DOORS, BACK_IMG, getCardTranslated, getDoorTranslated } from '@/data/tarotCards'
import { BuyTarotCTA } from '@/components/BuyTarotCTA'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ExportPlan14j } from '@/components/ExportPlan14j'
import { TranslatableContent } from '@/components/TranslatableContent'
import { NoteCard } from '@/components/NoteCard'
import { AlertBox, AlertBoxLink } from '@/components/AlertBox'

// ── Helper : trouver une carte par nom dans les portes ─────────
function findCardByName(name) {
  if (!name) return null
  for (const door of FOUR_DOORS) {
    const card = door.group.find(c => (c.name || '').toLowerCase() === (name || '').toLowerCase())
    if (card) return { door: door.key, card }
  }
  return null
}

// ── État initial des pétales ──────────────────────────────────
const EMPTY_PETALS = Object.fromEntries(PETAL_DEFS.map(p => [p.id, 0.0]))

const DOOR_MAP = Object.fromEntries(FOUR_DOORS.map(d => [d.key, d]))

// ═══════════════════════════════════════════════════════════════
// COMPOSANTS UTILITAIRES
// ═══════════════════════════════════════════════════════════════

function MicButton({ listening, supported, onToggle, size = 'md' }) {
  const sz = size === 'lg' ? 'w-14 h-14' : 'w-11 h-11'
  const ic = size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'
  return (
    <button
      onClick={onToggle}
      disabled={!supported}
      className={`relative ${sz} rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95 flex-shrink-0
        ${listening
          ? 'bg-rose-500 shadow-rose-500/40 scale-105'
          : supported
            ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-rose-400'
            : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed'}`}
      title={supported ? (listening ? t('session.stop') : t('session.speak')) : t('session.microUnavailable')}
    >
      {listening && <span className="absolute inset-0 rounded-xl bg-rose-500 animate-ping opacity-30" />}
      <svg viewBox="0 0 24 24" className={`${ic} ${listening ? 'text-white' : 'text-slate-500'}`} fill="currentColor">
        <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm7.07 8.93A7 7 0 0 1 5 12H3a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12h-2a7 7 0 0 1-.93 3.07z"/>
      </svg>
    </button>
  )
}

function LiveThreads({ threadContext }) {
  if (!threadContext) return null
  const { live_threads = [], metaphors = [], contradictions = [] } = threadContext
  const items = []
  contradictions.forEach(c => items.push({ type: 'contradiction', text: c }))
  metaphors.slice(0, 1).forEach(m => items.push({ type: 'metaphor', text: m }))
  live_threads.slice(0, 2).forEach(t => items.push({ type: 'thread', text: t }))
  if (!items.length) return null

  const colors = {
    contradiction: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    metaphor:      'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300',
    thread:        'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300',
  }
  const icons = { contradiction: '⚡', metaphor: '🌀', thread: '🔗' }

  return (
    <div className="space-y-1" style={{ animation: 'fadeIn 0.4s ease' }}>
      {items.map((item, i) => (
        <div key={i} className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${colors[item.type]}`}>
          <span className="flex-shrink-0 mt-0.5">{icons[item.type]}</span>
          <span className="leading-relaxed italic">«{item.text}»</span>
        </div>
      ))}
    </div>
  )
}

const SOVEREIGNTY_OPEN_KEY = 'fleur-sovereignty-panel-open'

// ── Panneau Souveraineté ──────────────────────────────────────
function SovereigntyPanel({ petals, overriddenPetals, onChange, autoOpen, shadowPetalId }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(SOVEREIGNTY_OPEN_KEY) === 'true'
    } catch {
      return false
    }
  })

  if (autoOpen && !open) setOpen(true)

  function toggleOpen() {
    setOpen(prev => {
      const next = !prev
      try {
        localStorage.setItem(SOVEREIGNTY_OPEN_KEY, String(next))
      } catch {}
      return next
    })
  }

  return (
    <div className={`rounded-xl border transition-all
      ${overriddenPetals.size > 0
        ? 'border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/10'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
      <button
        data-sovereignty-toggle
        onClick={toggleOpen}
        className="w-full flex items-center justify-between p-3 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
        <span className="flex items-center gap-1.5">
          <span>⚖</span>
          <span>{t('session.sovereignty')}</span>
          {overriddenPetals.size > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-300 text-[10px] font-bold">
              {overriddenPetals.size} ✎
            </span>
          )}
        </span>
        <span className="text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-2">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            {t('session.sovereigntyHint')}
          </p>
          {PETAL_DEFS.map(p => (
            <div key={p.id} className={`rounded-lg px-2 py-1.5 transition-colors
              ${shadowPetalId === p.id ? 'bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-300 dark:ring-amber-700' : ''}
              ${overriddenPetals.has(p.id) ? 'bg-teal-50/80 dark:bg-teal-950/20' : ''}`}>
              <PetalSlider
                petalId={p.id} label={p.name} color={p.color}
                value={petals[p.id] ?? 0}
                onChange={onChange}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Panneau Résumé de Porte (contexte, choix, intention) ───────
function DoorSummaryPanel({ door, summary, onConfirm, loading, isLastDoor, card }) {
  const [expanded, setExpanded] = useState(true)
  const prev = summary?.door_summary_preview || summary
  const synthesis = prev?.synthesis_suggestion || prev?.synthesis || ''
  const paths = prev?.paths_solutions || ''
  const intention = prev?.intention_emerged || ''
  const choices = prev?.choices_emerged || ''
  const shadowsNoted = prev?.shadows_noted || ''
  const hasContent = !!(synthesis || intention || choices || paths || shadowsNoted)

  const HeaderWrapper = hasContent ? 'button' : 'div'
  return (
    <div className={`rounded-2xl border-2 ${door?.border ?? 'border-emerald-400'} p-5 space-y-4 bg-white dark:bg-slate-900 w-full overflow-visible flex flex-col min-h-[50vh]`}
      style={{ animation: 'slideUp 0.5s ease' }}>
      <HeaderWrapper
        type={hasContent ? 'button' : undefined}
        onClick={hasContent ? () => setExpanded(e => !e) : undefined}
        className="flex items-center gap-2 w-full text-left hover:opacity-90 transition-opacity shrink-0"
        aria-expanded={hasContent ? expanded : undefined}>
        {card?.img ? (
          <div className="w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 shadow-sm">
            <img src={card.img} alt={card.name} className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
          </div>
        ) : (
          <span className="text-2xl">📋</span>
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${door?.color ?? 'text-emerald-600'}`}>
            {t('session.summaryPrefix', { door: door?.subtitle ?? t('session.thisDoor') })}
          </p>
          <p className="text-xs text-slate-500">{t('session.contextChoices')}</p>
        </div>
        {hasContent && (
          <span className="text-slate-400 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
        )}
      </HeaderWrapper>

      <div className="flex-1">
      {expanded && (loading ? (
        <div className="flex items-center gap-2 py-4">
          <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-500">{t('session.synthesisInProgress')}</span>
        </div>
      ) : (
        <div className="space-y-4 text-left">
          {synthesis && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{t('session.synthesis')}</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic break-words">{synthesis}</p>
            </div>
          )}
          {intention && (
            <div>
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">{t('session.pathIntention')}</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed break-words">{intention}</p>
            </div>
          )}
          {choices && (
            <div>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">{t('session.choicesActions')}</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed break-words">{choices}</p>
            </div>
          )}
          {paths && (
            <div>
              <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-1">{t('session.leads')}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">{paths}</p>
            </div>
          )}
          {shadowsNoted && (
            <div className="rounded-xl bg-slate-800/60 dark:bg-slate-900/80 border border-slate-600 p-3">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">🌑 {t('session.shadowParts')}</p>
              <p className="text-xs text-slate-300 leading-relaxed italic break-words">{shadowsNoted}</p>
              <p className="text-[10px] text-slate-500 mt-1.5">{t('session.shadowNeedAccompaniment')}</p>
            </div>
          )}
        </div>
      ))}
      </div>

      <div className="shrink-0 space-y-3 pt-2">
        {isLastDoor && (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            {t('session.takeBreath')}
          </p>
        )}
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`w-full py-4 rounded-xl font-bold text-base transition-all active:scale-98
            bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20
            disabled:opacity-50 disabled:cursor-not-allowed`}>
          {isLastDoor ? t('session.seeSynthesis') : t('session.nextDoor')}
        </button>
      </div>
    </div>
  )
}

// ── Panneau Verrou de Porte (legacy, conservé pour compatibilité) ──
function DoorLockPanel({ door, onLock, supportedSpeech }) {
  const [synthText, setSynthText] = useState('')
  const [habitText, setHabitText] = useState('')
  const [mode, setMode]           = useState('synth')
  const baseAtStartRef            = useRef('')
  const canLock = synthText.trim().length > 5

  const synthSpeech = useSpeech({
    onResult: (t) => {
      if (!t) return
      const base = baseAtStartRef.current
      const next = base.trimEnd() ? `${base.trimEnd()} ${t}`.trim() : t
      if (mode === 'synth') setSynthText(next)
      if (mode === 'habit') setHabitText(next)
    },
  })

  return (
    <div className="rounded-2xl border-2 border-dashed border-emerald-400 dark:border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/10 p-4 space-y-3"
      style={{ animation: 'slideUp 0.5s ease' }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">🔐</span>
        <div>
          <p className={`text-xs font-bold ${door?.color ?? 'text-emerald-600'}`}>
            {t('session.lockDoor', { door: door?.subtitle ?? t('session.thisDoor') })}
          </p>
          <p className="text-[10px] text-slate-400">{t('session.synthesizeBeforeMoving')}</p>
        </div>
      </div>

      {/* Synthèse */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t('session.synthesisLabel')}
        </label>
        <div className="flex gap-2">
          {supportedSpeech && (
            <button
              onMouseDown={() => { setMode('synth'); baseAtStartRef.current = synthText; synthSpeech.reset(); synthSpeech.start() }}
              onMouseUp={synthSpeech.stop}
              onTouchStart={(e) => { e.preventDefault(); setMode('synth'); baseAtStartRef.current = synthText; synthSpeech.reset(); synthSpeech.start() }}
              onTouchEnd={synthSpeech.stop}
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                ${synthSpeech.listening && mode === 'synth'
                  ? 'bg-rose-500 text-white scale-105 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              🎙
            </button>
          )}
          <textarea
            value={synthSpeech.listening && mode === 'synth' && synthSpeech.interimText
              ? (synthText.trimEnd() ? `${synthText.trimEnd()} ${synthSpeech.interimText}` : synthSpeech.interimText)
              : synthText}
            onChange={e => setSynthText(e.target.value)}
            placeholder={t('session.synthesisPlaceholder')}
            rows={2}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-none"
          />
        </div>
      </div>

      {/* Habitude */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t('session.habitLabel')}{' '}
          <span className="font-normal text-slate-400">({t('common.optional')})</span>
        </label>
        <div className="flex gap-2">
          {supportedSpeech && (
            <button
              onMouseDown={() => { setMode('habit'); baseAtStartRef.current = habitText; synthSpeech.reset(); synthSpeech.start() }}
              onMouseUp={synthSpeech.stop}
              onTouchStart={(e) => { e.preventDefault(); setMode('habit'); baseAtStartRef.current = habitText; synthSpeech.reset(); synthSpeech.start() }}
              onTouchEnd={synthSpeech.stop}
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                ${synthSpeech.listening && mode === 'habit'
                  ? 'bg-rose-500 text-white scale-105 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              🎙
            </button>
          )}
          <input
            value={synthSpeech.listening && mode === 'habit' && synthSpeech.interimText
              ? (habitText.trimEnd() ? `${habitText.trimEnd()} ${synthSpeech.interimText}` : synthSpeech.interimText)
              : habitText}
            onChange={e => setHabitText(e.target.value)}
            placeholder={t('session.habitPlaceholder')}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
          />
        </div>
      </div>

      <button
        onClick={() => onLock({ synthesis: synthText.trim(), habit: habitText.trim() })}
        disabled={!canLock}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-98
          ${canLock
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}>
        🔒 {t('session.lockThisDoor')}
      </button>
    </div>
  )
}

// ── Proposition de tirage ou carte suggérée ───────────────────
function CardSuggestionPanel({ suggestion, onAccept, onSkip, onRandomDraw, onShowCard }) {
  const door = DOOR_MAP[suggestion.door] ?? FOUR_DOORS[0]
  const suggestedCard = suggestion?.card_name
    ? door.group.find(c => (c.name || '').toLowerCase() === (suggestion.card_name || '').toLowerCase())
    : null
  const hasSpecificCard = !!suggestedCard
  return (
    <div className={`rounded-2xl border-2 ${door.border} p-5 space-y-4 w-fit max-w-full self-start overflow-visible`}
      style={{ animation: 'slideUp 0.5s ease' }}>
      <p className="text-xs text-slate-500 dark:text-slate-400 italic break-words leading-relaxed">
        {t('session.cardContext')}
      </p>
      <div className="flex items-start gap-3">
        {hasSpecificCard && suggestedCard ? (
          <button
            type="button"
            onClick={() => onShowCard?.({ door: suggestion.door, card: suggestedCard })}
            className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500 hover:opacity-90 transition-all cursor-pointer group"
            title="Cliquer pour agrandir">
            <img src={suggestedCard.img} alt={suggestedCard.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" onError={e => { e.target.style.display = 'none' }} />
          </button>
        ) : (
          <img src={BACK_IMG} alt="" className="w-20 h-28 object-contain rounded-lg flex-shrink-0" />
        )}
        <div className="min-w-0 max-w-sm">
          <p className={`text-xs font-bold ${door.color}`}>{door.subtitle}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed mt-0.5 break-words">
            {suggestion.reason}
          </p>
          {hasSpecificCard && (
            <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 mt-1">
              {t('session.suggestedCard')} : {suggestion.card_name}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={onAccept}
          className={`min-w-[140px] py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-98
            bg-gradient-to-r ${door.gradient ?? 'from-slate-500 to-slate-600'} shadow-md`}>
          {hasSpecificCard ? `${t('session.useCard')} ${suggestion.card_name} →` : `${t('session.drawCardFrom')} ${door.subtitle} →`}
        </button>
        <button onClick={onRandomDraw}
          className="py-2.5 px-4 rounded-xl text-xs font-semibold border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          🎲 {t('session.drawRandom')}
        </button>
        <button onClick={onSkip}
          className="px-3 py-2.5 rounded-xl text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          {t('session.notNow')}
        </button>
      </div>
    </div>
  )
}

// ── Tirage d'une carte pour une porte (1 clic = tirage + validation) ──
function CardDrawPanel({ door, onDrawn, preDrawnCard, onBeforeDraw }) {
  const [drawing, setDrawing] = useState(false)
  const [drawError, setDrawError] = useState('')
  async function drawAndSelect() {
    setDrawError('')
    setDrawing(true)
    try {
      if (onBeforeDraw) await onBeforeDraw()
      const card = preDrawnCard || door.group[Math.floor(Math.random() * door.group.length)]
      onDrawn(card)
    } catch (e) {
      setDrawError(e?.detail ?? e?.message ?? t('session.drawError'))
    } finally {
      setDrawing(false)
    }
  }

  return (
    <div className={`rounded-2xl border-2 ${door.border} p-5 space-y-4 w-fit max-w-full self-start overflow-visible`}
      style={{ animation: 'slideUp 0.4s ease' }}>
      <p className="text-xs text-slate-500 dark:text-slate-400 italic leading-relaxed">
        {t('session.cardContext')}
      </p>
      <p className={`text-xs font-bold ${door.color}`}>{door.subtitle}</p>
      {drawError && <p className="text-xs text-red-500">{drawError}</p>}
      <button
        onClick={drawAndSelect}
        disabled={drawing}
        className={`py-3 px-6 rounded-xl font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-70
          bg-gradient-to-r ${door.gradient ?? 'from-slate-500 to-slate-600'}`}>
        {drawing ? '…' : '🎴'} {t('session.drawCard')}
      </button>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 1 : INTRO
// ═══════════════════════════════════════════════════════════════

const getDoorLabels = () => ({ love: t('session.doorLove'), vegetal: t('session.doorVegetal'), elements: t('session.doorElements'), life: t('session.doorLife') })

function IntroStep({ onStart, onResume, userEmail, resumeError, quotaExceeded, access }) {
  const locale = useStore((s) => s.locale)
  const hasSeenSessionIntro = useStore((s) => s.hasSeenSessionIntro)
  const setHasSeenSessionIntro = useStore((s) => s.setHasSeenSessionIntro)
  const [showSessionIntroModal, setShowSessionIntroModal] = useState(false)
  const [sessions, setSessions] = useState([])
  const [showOpenDoorConfirm, setShowOpenDoorConfirm] = useState(false)
  const [sapPreview, setSapPreview] = useState(null)
  const [sapConfirmLoading, setSapConfirmLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [completedSessions, setCompletedSessions] = useState([])
  const [loadingCompleted, setLoadingCompleted] = useState(true)
  const [expandedSessionId, setExpandedSessionId] = useState(null)
  const [expandedDetail, setExpandedDetail] = useState(null)
  const [sessionDetailZoom, setSessionDetailZoom] = useState(null) // { type: 'flower' } | { type: 'card', door, card }
  const [completedSessionIndex, setCompletedSessionIndex] = useState(0)

  useEffect(() => {
    if (!userEmail) { setLoadingSessions(false); setLoadingCompleted(false); return }
    sessionsApi.my('in_progress')
      .then(res => setSessions(res?.items ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false))
    sessionsApi.my('completed')
      .then(res => setCompletedSessions(res?.items ?? []))
      .catch(() => setCompletedSessions([]))
      .finally(() => setLoadingCompleted(false))
  }, [userEmail])

  useEffect(() => {
    if (completedSessions.length > 0 && completedSessionIndex >= completedSessions.length) {
      setCompletedSessionIndex(Math.max(0, completedSessions.length - 1))
    }
  }, [completedSessions, completedSessionIndex])

  function goToCompletedSession(index) {
    if (index < 0 || index >= completedSessions.length) return
    setCompletedSessionIndex(index)
  }

  function openSessionDetailModal(s) {
    setExpandedSessionId(s.id)
    setExpandedDetail(null)
    setSessionDetailZoom(null)
    sessionsApi.get(s.id)
      .then(full => setExpandedDetail(full))
          .catch(() => setExpandedDetail({ error: t('session.loadDetailError') }))
  }

  function closeSessionDetailModal() {
    setExpandedSessionId(null)
    setExpandedDetail(null)
    setSessionDetailZoom(null)
  }

  async function handleDeleteSession(id, e) {
    e?.stopPropagation()
    if (!window.confirm(t('session.deleteConfirm'))) return
    try {
      await sessionsApi.delete(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      setCompletedSessions(prev => prev.filter(s => s.id !== id))
      if (expandedSessionId === id) closeSessionDetailModal()
      if (completedSessionIndex >= completedSessions.length - 1 && completedSessions.some(s => s.id === id)) {
        setCompletedSessionIndex(Math.max(0, completedSessions.length - 2))
      }
    } catch (err) {
      window.alert(err?.message || t('session.loadError'))
    }
  }

  async function doEntrer() {
    if (access?.free_access) {
      onStart()
      return
    }
    try {
      const p = await sapApi.preview('open_door')
      if (!p?.ok) {
        const av = p?.available ?? 0
        window.alert(`Sève insuffisante. Il vous faut 15 Sèves (vous en avez ${av}).`)
        return
      }
      setSapPreview(p)
      setShowOpenDoorConfirm(true)
    } catch {
      setSapPreview({ from_sablier: 15, from_cristal: 0 })
      setShowOpenDoorConfirm(true)
    }
  }

  async function handleEntrerClick() {
    if (!hasSeenSessionIntro) {
      setShowSessionIntroModal(true)
      return
    }
    await doEntrer()
  }

  function handleConfirmOpenDoor() {
    setSapConfirmLoading(true)
    onStart()
    setShowOpenDoorConfirm(false)
    setSapPreview(null)
    setSapConfirmLoading(false)
  }

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="max-w-lg mx-auto text-center space-y-4 sm:space-y-6 py-4 sm:py-8 px-1 sm:px-0" style={{ animation: 'fadeIn 0.6s ease' }}>
      <div className="space-y-1 sm:space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-transparent">
          {t('session.gardenTitle')}
        </h2>
        <p className="text-slate-500 italic text-sm sm:text-base">{t('session.gardenSubtitle')}</p>
      </div>

      {/* Sessions en cours — reprise + terminées (historique) */}
      <section id="section-sessions" className="space-y-4 text-left">
      {userEmail && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-4 text-left space-y-3">
          <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">{t('session.ongoingSessions')}</h3>
          {loadingSessions ? (
            <p className="text-xs text-slate-400 italic">{t('common.loading')}</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{t('session.noSessionInProgress')}</p>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => {
                const doors = s.doors_locked ?? []
                const cards = (s.cards_drawn ?? []).map(c => (typeof c === 'object' && c?.card_name) ? c.card_name : c)
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onResume(s.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onResume(s.id) } }}
                    className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-all cursor-pointer group">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-4 group-hover:text-rose-600 dark:group-hover:text-rose-400 break-words">
                      « {s.first_words || 'Session'} »
                    </p>
                    <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-slate-500">
                      {s.door_suggested && (
                        <span className="px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300">
                          {getDoorLabels()[s.door_suggested] || s.door_suggested}
                        </span>
                      )}
                      <span>{t('session.exchanges').replace('{n}', s.turn_count)}</span>
                      <span>{formatDate(s.created_at)}</span>
                    </div>
                    {(doors.length > 0 || cards.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-2 text-[10px]">
                        {doors.length > 0 && (
                          <span className="text-slate-500">
                            {t('session.doorsSummary')} : {doors.map(d => getDoorLabels()[d] || d).join(', ')}
                          </span>
                        )}
                        {cards.length > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {t('session.cardsLabel')} {cards.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="text-[10px] text-rose-500 font-medium">{t('session.resume')}</p>
                      <button
                        type="button"
                        onClick={e => handleDeleteSession(s.id, e)}
                        className="text-[10px] text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Sessions terminées — plans 14j et résumés */}
      {userEmail && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-4 text-left space-y-3">
          <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">{t('session.completedSessions')}</h3>
          {loadingCompleted ? (
            <p className="text-xs text-slate-400 italic">{t('common.loading')}</p>
          ) : completedSessions.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{t('session.noCompletedSessions')}</p>
          ) : (
            <>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => goToCompletedSession(completedSessionIndex - 1)}
                  disabled={completedSessionIndex <= 0}
                  aria-label={t('session.sessionPrevious')}
                  className="flex-shrink-0 w-7 h-7 rounded border border-slate-200 dark:border-slate-600 bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm transition-colors">
                  ‹
                </button>
                <div className="flex-1 min-w-0">
              {(() => {
                const s = completedSessions[completedSessionIndex]
                if (!s) return null
                return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openSessionDetailModal(s)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSessionDetailModal(s) } }}
                  className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100 line-clamp-4 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 break-words">
                    « {s.first_words || 'Session'} »
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-0.5 text-[10px] text-slate-500">
                    {s.door_suggested && (
                      <span className="px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300">
                        {getDoorLabels()[s.door_suggested] || s.door_suggested}
                      </span>
                    )}
                    <span>{t('session.exchanges').replace('{n}', s.turn_count)}</span>
                    <span>{formatDate(s.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {t('session.seePlanSummary')}
                    </p>
                    <button
                      type="button"
                      onClick={e => handleDeleteSession(s.id, e)}
                      className="text-[10px] text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              )})()}
                </div>
                <button
                  type="button"
                  onClick={() => goToCompletedSession(completedSessionIndex + 1)}
                  disabled={completedSessionIndex >= completedSessions.length - 1}
                  aria-label={t('session.sessionNext')}
                  className="flex-shrink-0 w-7 h-7 rounded border border-slate-200 dark:border-slate-600 bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm transition-colors">
                  ›
                </button>
              </div>
              <p className="text-center text-[10px] text-slate-500">
                {completedSessionIndex + 1} / {completedSessions.length}
              </p>
            </div>

            {/* Modal aperçu session — fenêtre contextuelle par-dessus l'app */}
            {expandedSessionId && createPortal(
              (
              <div
                className="flex items-center justify-center p-4"
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, backgroundColor: 'rgba(0,0,0,0.9)' }}
                onClick={closeSessionDetailModal}
                role="dialog"
                aria-modal="true"
                aria-label={t('session.sessionPreviewAria')}>
                <div
                  className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0f172a] shadow-2xl text-left border border-slate-200 dark:border-slate-700"
                  onClick={e => e.stopPropagation()}>
                  <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={closeSessionDetailModal}
                      aria-label={t('common.close')}
                      className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-sm font-bold transition-colors">
                      ✕
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(expandedSessionId)}
                      className="text-[10px] text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                      {t('common.delete')}
                    </button>
                  </div>
                  <div className="p-4 pt-12 space-y-4">
                  {expandedDetail === null ? (
                    <p className="text-xs text-slate-400 italic">{t('common.loading')}</p>
                  ) : expandedDetail.error ? (
                        <p className="text-xs text-red-500">{expandedDetail.error}</p>
                      ) : (
                        <>
                          {/* Fleur + cartes (zoomables) */}
                          {((expandedDetail.petals && Object.keys(expandedDetail.petals || {}).length > 0) || (expandedDetail.cards_drawn?.length > 0)) && (
                            <div className="flex flex-col items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                              {expandedDetail.petals && Object.keys(expandedDetail.petals).length > 0 && (
                                <div className="flex flex-col items-center gap-3">
                                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{t('session.myFleur')}</p>
                                  <button
                                    type="button"
                                    onClick={() => setSessionDetailZoom({ type: 'flower' })}
                                    className="cursor-zoom-in hover:opacity-90 transition-opacity"
                                    aria-label="Agrandir la fleur">
                                    <FlowerSVG petals={expandedDetail.petals} size={180} animate showLabels />
                                  </button>
                                </div>
                              )}
                              {(() => {
                                const drawn = (expandedDetail.cards_drawn || []).map(item => {
                                  const name = typeof item === 'object' && item?.card_name ? item.card_name : item
                                  const found = findCardByName(name)
                                  if (!found) return null
                                  const door = (typeof item === 'object' && item?.door) ? item.door : found.door
                                  return { door, card: found.card }
                                }).filter(Boolean)
                                if (drawn.length === 0) return null
                                return (
                                  <div className="flex flex-col items-center gap-1 w-full">
                                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">{t('session.drawnCards')}</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-xs">
                                      {drawn.map((d, i) => (
                                        <button
                                          key={`${d.door}-${i}`}
                                          type="button"
                                          onClick={() => setSessionDetailZoom({ type: 'card', door: d.door, card: d.card })}
                                          className="flex flex-col items-center gap-0.5 cursor-zoom-in hover:opacity-90 transition-opacity">
                                          <div className="w-16 h-24 rounded-lg overflow-hidden border-2 border-slate-300 dark:border-slate-600 flex-shrink-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800">
                                            {d.card?.img ? (
                                              <img src={d.card.img} alt={d.card.name} className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
                                            ) : (
                                              <span className="text-[9px] text-slate-500 text-center px-0.5">{d.card?.name}</span>
                                            )}
                                          </div>
                                          <span className="text-[9px] text-slate-600 dark:text-slate-300 truncate w-full">{d.card?.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })()}
                              {completedSessions.filter(s => s.petals && Object.keys(s.petals || {}).length > 0).length >= 2 && (
                                <CrystalTimeline
                                  currentSession={expandedDetail}
                                  snapshots={completedSessions.filter(s => s.petals && Object.keys(s.petals || {}).length > 0)}
                                  size={180}
                                />
                              )}
                            </div>
                          )}
                          {/* Modal zoom fleur ou carte — porté au body pour centrage immédiat */}
                          {sessionDetailZoom && createPortal(
                            <div
                              className="flex items-center justify-center p-4"
                              style={{ position: 'fixed', inset: 0, zIndex: 2147483647, backgroundColor: 'rgba(0,0,0,0.92)' }}
                              onClick={() => setSessionDetailZoom(null)}
                              role="dialog"
                              aria-modal="true"
                              aria-label={sessionDetailZoom.type === 'flower' ? 'Fleur agrandie' : 'Carte agrandie'}>
                              <div
                                className="relative flex items-center justify-center w-full max-w-[90vw] max-h-[90vh]"
                                style={{ maxHeight: 'min(90vh, 600px)' }}
                                onClick={e => e.stopPropagation()}>
                                {sessionDetailZoom.type === 'flower' && expandedDetail?.petals && (
                                  <div className="flex items-center justify-center w-full">
                                    <FlowerSVG petals={expandedDetail.petals} size={Math.min(window.innerWidth - 24, window.innerHeight - 80, 700)} animate showLabels />
                                  </div>
                                )}
                                {sessionDetailZoom.type === 'card' && sessionDetailZoom.card && (
                                  <div className="flex flex-col items-center gap-4 max-w-lg mx-auto">
                                    <img
                                      src={sessionDetailZoom.card.img}
                                      alt={sessionDetailZoom.card.name}
                                      className="max-w-full max-h-[60vh] w-auto h-auto object-contain rounded-xl shadow-2xl cursor-zoom-in"
                                      style={{ maxHeight: 'min(60vh, 420px)' }}
                                      onError={e => { e.target.style.display = 'none' }}
                                    />
                                    <div className="rounded-xl bg-white dark:bg-[#0f172a] px-4 py-3 w-full text-center shadow-lg border border-slate-200 dark:border-slate-700">
                                      <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-0.5">
                                        {getDoorTranslated(DOOR_MAP[sessionDetailZoom.door], locale)?.subtitle ?? sessionDetailZoom.door}
                                      </p>
                                      <h3 className="font-bold text-slate-800 dark:text-slate-100">{sessionDetailZoom.card.name}</h3>
                                      <p className="text-sm text-slate-600 dark:text-slate-300 italic mt-2 leading-relaxed">
                                        {getCardTranslated(sessionDetailZoom.card, locale).synth || getCardTranslated(sessionDetailZoom.card, locale).desc?.split('\n')[0] || ''}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setSessionDetailZoom(null)}
                                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold hover:bg-white dark:hover:bg-slate-700 shadow-lg z-10">
                                ✕
                              </button>
                            </div>,
                            document.getElementById('modal-root') || document.body
                          )}
                          {expandedDetail.anchors?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">✦ {t('session.doorsSummary')}</p>
                              <div className="space-y-2">
                                {expandedDetail.anchors.map((a, i) => (
                                  <div key={i} className="rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 border border-emerald-100 dark:border-emerald-900/50">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase">{a.subtitle ?? a.door}</p>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 italic">{a.synthesis}</p>
                                    {a.habit && <p className="text-[10px] text-slate-500 mt-0.5">🔗 {a.habit}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {expandedDetail.plan14j && (
                            <div>
                              <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-2">{t('session.plan14Title')}</p>
                              {(expandedDetail.plan14j.synthesis || expandedDetail.plan14j.synthesis_suggestion) && (
                                <p className="text-xs text-slate-700 dark:text-slate-200 italic mb-3">
                                  {expandedDetail.plan14j.synthesis || expandedDetail.plan14j.synthesis_suggestion}
                                </p>
                              )}
                              {expandedDetail.plan14j.levers?.length > 0 && (
                                <div className="space-y-1.5 mb-3">
                                  {expandedDetail.plan14j.levers.map((lever, i) => {
                                    const [action, anchor] = (lever || '').split('||ANCHOR||')
                                    return (
                                      <div key={i} className="flex gap-2 items-start">
                                        <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                          {i + 1}
                                        </span>
                                        <p className="text-xs text-slate-700 dark:text-slate-200">{action}{anchor ? ` ${t('session.anchorAfter')} ${anchor}` : ''}</p>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                              {expandedDetail.plan14j.plan_14j?.length > 0 && (
                                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                                  {expandedDetail.plan14j.plan_14j.map((day, idx) => (
                                    <div key={day.day ?? idx} className="flex gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs">
                                      <span className="w-7 flex-shrink-0 font-bold text-slate-500">J{day.day ?? idx + 1}</span>
                                      <div>
                                        <p className="font-semibold text-slate-800 dark:text-slate-100">{day.theme || t('session.anchoringFallback')}</p>
                                        <p className="text-slate-600 dark:text-slate-300">{day.action || '—'}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(!expandedDetail.plan14j.levers?.length && !expandedDetail.plan14j.plan_14j?.length && !expandedDetail.plan14j.synthesis) && (
                                <p className="text-xs text-slate-400 italic">{t('session.planNotGenerated')}</p>
                              )}
                            </div>
                          )}
                          {!expandedDetail.plan14j && (!expandedDetail.anchors?.length) && (
                            <p className="text-xs text-slate-400 italic">{t('session.noDetails')}</p>
                          )}
                        </>
                      )}
                  </div>
                </div>
              </div>
              ),
              document.getElementById('modal-root') || document.body
            )}
            </>
          )}
        </div>
      )}
      </section>

      {resumeError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
          {resumeError}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:p-6 text-left space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200">{t('session.howItWorks')}</h3>
          <span className="text-[10px] text-slate-400 font-medium">~25–40 min</span>
        </div>
        {[
          ['🌱', t('session.step1Title'), t('session.step1Desc')],
          ['🎙️', t('session.step2Title'), t('session.step2Desc')],
          ['🎴', t('session.step3Title'), t('session.step3Desc')],
          ['🌸', t('session.step4Title'), t('session.step4Desc')],
          ['📋', t('session.step5Title'), t('session.step5Desc')],
        ].map(([icon, title, desc]) => (
          <div key={title} className="flex items-start gap-3">
            <span className="text-lg">{icon}</span>
            <div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <NoteCard>
        <p>{t('session.disclaimer')}</p>
        <p>
          {t('session.accompanyLight')}{' '}
          <a href="/contact" className="text-violet-400 hover:text-violet-300 underline hover:no-underline">{t('session.requestMeeting')}</a>
        </p>
      </NoteCard>

      <p className="text-sm text-slate-600 dark:text-slate-300 italic">
        {t('session.breatheEnter')}
      </p>
      {quotaExceeded && (
        <AlertBox
          variant="warning"
          title={t('session.quotaReached')}
          actions={<AlertBoxLink href="/account">{t('session.activatePromo')}</AlertBoxLink>}
        >
          {t('session.quotaReachedDesc')}
        </AlertBox>
      )}
      <button
        onClick={quotaExceeded ? undefined : handleEntrerClick}
        disabled={quotaExceeded}
        className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300
          ${quotaExceeded
            ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-rose-500 to-violet-500 text-white hover:shadow-rose-500/25 hover:scale-[1.02] active:scale-[0.98]'}`}>
        {t('session.enterGarden')}
      </button>
      <p className="text-[10px] text-slate-400 text-center">{t('session.doorsDesc')}</p>

      <div className="flex justify-center pt-4">
        <BuyTarotCTA variant="compact" />
      </div>

      {showOpenDoorConfirm && (
        <ConfirmationModal
          open={showOpenDoorConfirm}
          onClose={() => { setShowOpenDoorConfirm(false); setSapPreview(null) }}
          onConfirm={handleConfirmOpenDoor}
          action="open_door"
          fromSablier={sapPreview?.from_sablier ?? 15}
          fromCristal={sapPreview?.from_cristal ?? 0}
          cost={15}
          loading={sapConfirmLoading}
          title="Ouverture de la première porte"
          bodyTemplate={`L'ouverture de cette porte consomme 15 Sèves. Utilise ${sapPreview?.from_sablier ?? 15} Sèves de Saison et ${sapPreview?.from_cristal ?? 0} Sèves Éternelles. Confirmer ?`}
        />
      )}

      {showSessionIntroModal && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div
            className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              🌿 {t('session.howItWorks')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('onboarding.sessionIntro')}
            </p>
            <button
              type="button"
              onClick={() => {
                setHasSeenSessionIntro(true)
                setShowSessionIntroModal(false)
                doEntrer()
              }}
              className="w-full py-3 rounded-xl bg-accent text-white font-semibold hover:opacity-90 transition-opacity"
            >
              {t('onboarding.sessionIntroContinue')}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 2 : SEUIL (Threshold) — remplace le tirage upfront
// ═══════════════════════════════════════════════════════════════

function ThresholdStep({ onThresholdComplete, userEmail, quotaExceeded }) {
  const [text, setText]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(quotaExceeded ? 'quota_exceeded' : '')
  const baseAtStartRef     = useRef('')

  useEffect(() => {
    if (quotaExceeded) setError('quota_exceeded')
  }, [quotaExceeded])

  const { listening, transcript, interimText, supported, start, stop, reset } = useSpeech({
    onResult: (t) => {
      if (!t) return
      const base = baseAtStartRef.current
      setText(base.trimEnd() ? `${base.trimEnd()} ${t}`.trim() : t)
    },
  })

  function toggleMic() {
    if (listening) stop()
    else { baseAtStartRef.current = text; reset(); start() }
  }

  async function handleSubmit() {
    const words = text.trim()
    if (!words) return
    setLoading(true); setError('')
    try {
      const res = await aiApi.threshold({ first_words: words })
      const payload = { firstWords: words, ...res }
      // Sauvegarder la session en in_progress pour permettre la reprise
      try {
        const saved = await sessionsApi.save({
          email: userEmail || null,
          first_words: words,
          door_suggested: res.door_suggested ?? null,
          petals: {},
          history: [],
          cards_drawn: [],
          anchors: [],
          doors_locked: '',
          turn_count: 0,
          status: 'in_progress',
          duration_seconds: 0,
        })
        if (saved?.id) payload.sessionId = saved.id
      } catch (saveErr) {
        if (saveErr?.code === 'quota_exceeded' || saveErr?.status === 402) {
          setError('quota_exceeded')
          setLoading(false)
          return
        }
      }
      onThresholdComplete(payload)
    } catch (e) {
      setError(e.detail ?? e.message ?? t('session.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8" style={{ animation: 'fadeIn 0.6s ease' }}>
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{t('session.thresholdTitle')}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 italic">
          {t('session.thresholdInvite')}
        </p>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
          {t('session.thresholdQuestion')}
        </h3>
        <p className="text-lg text-slate-600 dark:text-slate-300 italic leading-relaxed">
          {t('session.thresholdSubQ')}
        </p>
        <p className="text-xs text-slate-400">
          {t('session.noRightAnswer')}
        </p>
      </div>

      <div className="space-y-3">
        {/* Zone de texte — pendant la dictée : texte précédent + interim en cours */}
        <textarea
          value={listening && interimText ? (text.trimEnd() ? `${text.trimEnd()} ${interimText}` : interimText) : text}
          onChange={e => {
            if (listening) stop()
            setText(e.target.value)
          }}
          onKeyDown={e => {
            if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) && text.trim() && !loading && !quotaExceeded) {
              e.preventDefault()
              if (listening) stop()
              handleSubmit()
            }
          }}
          placeholder={t('session.speakOrWriteFreely')}
          rows={4}
          inputMode="text"
          autoComplete="off"
          spellCheck={!listening}
          className={`w-full px-4 py-3 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 resize-none leading-relaxed
            ${listening
              ? 'border-rose-400 dark:border-rose-600 bg-rose-50/40 dark:bg-rose-950/20 focus:ring-rose-400/40'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-violet-400/40'}`}
        />

        {/* Contrôles */}
        <div className="flex items-center gap-3">
          {supported && (
            <MicButton listening={listening} supported={supported} onToggle={toggleMic} size="lg" />
          )}
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || loading || quotaExceeded}
            className={`flex-1 py-4 rounded-xl font-bold text-base transition-all duration-300 active:scale-[0.98]
              ${text.trim() && !loading && !quotaExceeded
                ? 'bg-gradient-to-r from-violet-500 to-rose-500 text-white shadow-lg shadow-violet-500/20 hover:scale-[1.01]'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('session.tuteurWelcoming')}
              </span>
            ) : t('session.enterSession')}
          </button>
        </div>
      </div>

      {error === 'quota_exceeded' && (
        <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200 space-y-2">
          <p className="font-semibold">{t('session.quotaReached')}</p>
          <p className="text-xs">{t('session.quotaReachedDesc')}</p>
          <a href="/account" className="inline-block mt-1 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors">
            {t('session.activatePromo')}
          </a>
        </div>
      )}
      {error && error !== 'quota_exceeded' && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 3 : SESSION — organique, cartes émergentes
// ═══════════════════════════════════════════════════════════════

function SessionStep({ thresholdData, initialState, onComplete, onBeforeDrawCard }) {
  const locale = useStore((s) => s.locale)
  // ── État conversation ─────────────────────────────────────
  const [turn, setTurn]               = useState(initialState?.turn ?? 0)
  const [petals, setPetals]           = useState(initialState?.petals ?? EMPTY_PETALS)
  const [petalsDeficit, setPetalsDeficit] = useState(initialState?.petalsDeficit ?? {})
  const [shadowEvents, setShadowEvents] = useState(initialState?.shadowEvents ?? [])
  const [maxShadowLevel, setMaxShadowLevel] = useState(initialState?.maxShadowLevel ?? 0)
  const [petalsHistory, setPetalsHistory] = useState(initialState?.petalsHistory ?? [])
  const [history, setHistory]         = useState(initialState?.history ?? [])
  const [aiMessage, setAiMessage]     = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [manualText, setManualText]   = useState('')
  const [threadContext, setThreadCtx] = useState(null)

  // ── État des portes et cartes (organiques) ────────────────
  const [currentDoor, setCurrentDoor]     = useState(initialState?.currentDoor ?? thresholdData?.door_suggested ?? 'love')
  const [currentCard, setCurrentCard]     = useState(() => {
    // Reprise : restaurer la carte déjà tirée pour la porte courante (éviter de reproposer une carte)
    const initCards = initialState?.drawnCards ?? []
    const door = initialState?.currentDoor ?? thresholdData?.door_suggested ?? 'love'
    const found = initCards.find(d => d.door === door)
    return found ? found.card : null
  })
  const [drawnCards, setDrawnCards]       = useState(initialState?.drawnCards ?? [])
  const [doorTurn, setDoorTurn]           = useState(initialState?.doorTurn ?? 0)           // tours depuis la dernière porte
  const [doorTurnAtCardDraw, setDoorTurnAtCardDraw] = useState(initialState?.doorTurnAtCardDraw ?? null) // tour au moment où la carte a été tirée (pour retarder le résumé)
  const [lockedDoors, setLockedDoors]     = useState(initialState?.lockedDoors ?? [])
  const [anchors, setAnchors]             = useState(initialState?.anchors ?? [])
  const [pendingSuggestion, setPendingSugg] = useState(null)      // suggest_card en attente
  const [fallbackSuggestionDismissed, setFallbackSuggestionDismissed] = useState(false)
  const [doorIntroMessage, setDoorIntroMessage] = useState(null) // question IA pour chaque nouvelle porte
  const [preDrawnCard, setPreDrawnCard]  = useState(null)        // carte pré-tirée pour cohérence question ↔ carte
  const lastAssistantMsg = initialState?.history?.length
    ? [...(initialState.history || [])].reverse().find(m => m.role === 'assistant')
    : null

  // À la reprise : afficher le dernier message du Tuteur ou la question initiale
  useEffect(() => {
    if (initialState?.history?.length && lastAssistantMsg?.content) {
      const parts = String(lastAssistantMsg.content).split(/\n\n+/)
      const response_a = parts[0]?.trim() || ''
      const question = (parts.slice(1).join('\n\n') || response_a || '').trim()
      setAiMessage(prev => prev ?? {
        response_a,
        response_b: '',
        question: question || lastAssistantMsg.content,
        reflection: null,
        suggest_card: null,
        thread_context: null,
        shadow_detected: false,
        explore_petal: null,
      })
      if (!(initialState?.lockedDoors?.length)) {
        const t = Math.floor((initialState.history?.length ?? 0) / 2)
        // Utiliser les valeurs sauvegardées si présentes, sinon calculer (legacy)
        if (initialState?.doorTurn == null) setDoorTurn(t)
        if (initialState?.doorTurnAtCardDraw == null && initialState?.drawnCards?.some(d => d.door === (initialState?.currentDoor ?? 'love'))) {
          setDoorTurnAtCardDraw(Math.max(0, t - 3))
        }
      }
    } else if (initialState && thresholdData?.firstWords) {
      // Reprise sans échanges : afficher la question initiale de l'IA
      setAiMessage(prev => prev ?? {
        response_a: `Vous entrez par ${DOOR_MAP[thresholdData.door_suggested]?.subtitle ?? 'la Porte du Cœur'}.`,
        response_b: thresholdData.door_reason ?? '',
        question: thresholdData.first_question ?? "Qu'est-ce qui est le plus vivant pour vous en ce moment ?",
        reflection: null,
        suggest_card: null,
        thread_context: null,
        shadow_detected: false,
        explore_petal: null,
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [showCardDraw, setShowCardDraw]   = useState(false)       // panneau tirage carte

  // Fallback : chaque porte suggère toujours une carte (évite doublon bouton 1 / bouton 2)
  const fallbackSuggestion = useMemo(() => {
    const door = DOOR_MAP[currentDoor]
    if (!door?.group?.length) return { door: currentDoor, reason: t('session.cardCanIlluminate') }
    const card = door.group[Math.floor(Math.random() * door.group.length)]
    return { door: currentDoor, reason: t('session.cardCanIlluminate'), card_name: card.name }
  }, [currentDoor])

  // ── Gating : verrou de porte (résumé proposé, pas automatique) ──
  const [doorLocked, setDoorLocked]   = useState(false)
  const [showSummaryPanel, setShowSummaryPanel] = useState(false)
  const [showInputWithSummary, setShowInputWithSummary] = useState(false)
  const [doorSummary, setDoorSummary] = useState(null)
  useEffect(() => {
    if (showSummaryPanel) setShowInputWithSummary(false)
  }, [showSummaryPanel])
  const [summaryLoading, setSummaryLoading] = useState(false)

  // ── Souveraineté ──────────────────────────────────────────
  const [overriddenPetals, setOverriddenPetals] = useState(new Set())

  // ── Première question depuis threshold (ou reprise) ───────
  const initialAiMsg = useRef({
    response_a: thresholdData
      ? `Vous entrez par ${DOOR_MAP[thresholdData.door_suggested]?.subtitle ?? 'la Porte du Cœur'}.`
      : 'Bienvenue dans le Jardin.',
    response_b: thresholdData?.door_reason ?? '',
    question: thresholdData?.first_question ?? 'Qu\'est-ce qui est là pour vous en ce moment ?',
    reflection: null,
    suggest_card: null,
    thread_context: null,
    shadow_detected: false,
    explore_petal: null,
  })

  // STT dialogue principal — base = valeur au démarrage, onResult = transcript complet
  const baseAtStartRef = useRef('')
  const { listening, interimText, supported, start, stop, reset } = useSpeech({
    onResult: (t) => {
      if (!t) return
      const base = baseAtStartRef.current
      setManualText(base.trimEnd() ? `${base.trimEnd()} ${t}`.trim() : t)
    },
  })

  function toggleMic() {
    if (listening) {
      stop()
    } else {
      baseAtStartRef.current = manualText
      start()
    }
  }

  function handlePetalOverride(id, val) {
    setPetals(prev => ({ ...prev, [id]: val }))
    setOverriddenPetals(prev => new Set([...prev, id]))
  }

  // ── Sauvegarde session en cours (historique, portes, cartes) ─
  const saveSessionInProgressRef = useRef(null)
  const lastSummarizedHistoryLen = useRef(0)

  // 4e porte : même flow que les autres (pas d'auto-assign de carte)
  useEffect(() => () => {
    if (saveSessionInProgressRef.current) clearTimeout(saveSessionInProgressRef.current)
  }, [])
  function saveSessionInProgress(overrides = {}) {
    if (!thresholdData?.sessionId) return
    const anchorsToUse = overrides.anchors ?? anchors
    const lockedToUse = Array.isArray(overrides.doors_locked) ? overrides.doors_locked : (overrides.doors_locked ? overrides.doors_locked.split(',') : lockedDoors)
    const cardsToUse = overrides.cards_drawn ?? drawnCards.map(d => ({ door: d.door, card_name: d.card.name }))
    const doorToUse = overrides.currentDoor ?? currentDoor
    const stepData = {
      currentDoor: doorToUse,
      drawnCards: cardsToUse,
      lockedDoors: Array.isArray(lockedToUse) ? lockedToUse : lockedDoors,
      petalsDeficit: overrides.petalsDeficit ?? petalsDeficit,
      petalsHistory: overrides.petalsHistory ?? petalsHistory,
      doorTurn: overrides.doorTurn ?? doorTurn,
      doorTurnAtCardDraw: overrides.doorTurnAtCardDraw ?? doorTurnAtCardDraw,
      shadowEvents: overrides.shadowEvents ?? shadowEvents,
      maxShadowLevel: overrides.maxShadowLevel ?? maxShadowLevel,
    }
    const payload = {
      id: thresholdData.sessionId,
      history: overrides.history ?? history,
      petals: overrides.petals ?? petals,
      cards_drawn: cardsToUse,
      anchors: anchorsToUse,
      doors_locked: Array.isArray(lockedToUse) ? lockedToUse.join(',') : lockedToUse,
      turn_count: overrides.turn_count ?? turn,
      step_data: stepData,
      status: 'in_progress',
    }
    clearTimeout(saveSessionInProgressRef.current)
    saveSessionInProgressRef.current = setTimeout(() => {
      sessionsApi.update(payload)
        .then(() => {})
        .catch(() => {})
    }, 500)
  }

  // ── Envoi au Tuteur ───────────────────────────────────────
  async function sendToTuteur(text) {
    if (!text.trim()) return
    if (listening) stop() // Arrêter le micro avant envoi (évite redémarrage auto sur Android)
    if (!currentCard) {
      // Pas encore de carte : initier le dialogue sans carte
      await sendToTuteurWithCard(text, '__no_card__', currentDoor)
      return
    }
    await sendToTuteurWithCard(text, currentCard.name, currentDoor)
  }

  const lastFailedTextRef = useRef('')
  const RETRY_MAX = 2
  const RETRY_DELAY_MS = 2000

  async function sendToTuteurWithCard(text, cardName, cardGroup) {
    const userMsg = { role: 'user', content: text }
    const newHistory = [...history, userMsg]
    setError('')
    setHistory(newHistory)
    setManualText('')
    reset()
    setLoading(true)
    lastFailedTextRef.current = text

    const payload = {
      card_name: cardName === '__no_card__' ? `Porte : ${cardGroup}` : cardName,
      card_group: cardGroup,
      transcript: text,
      history: history,
      current_petals: petals,
      overridden_petals: Object.fromEntries([...overriddenPetals].map(id => [id, petals[id]])),
      locked_doors: lockedDoors,
      turn,
    }

    for (let attempt = 0; attempt <= RETRY_MAX; attempt++) {
      try {
        const res = await aiApi.tuteur(payload)

        // Historique pour l'évolution (état avant mise à jour)
      setPetalsHistory(prev => [...prev, { petals: { ...petals }, petalsDeficit: { ...petalsDeficit } }])

      // Respecter les overrides
      const nextPetals = { ...res.petals }
      overriddenPetals.forEach(id => { nextPetals[id] = petals[id] })
      setPetals(nextPetals)
      setPetalsDeficit(res.petals_deficit ?? {})

      const responseA = (res.response_a ?? '').trim() || 'Je vous reçois.'
      const questionText = (res.question ?? '').trim() || "Qu'est-ce qui est le plus vivant dans ce que vous venez de dire ?"
      const aMsg = { role: 'assistant', content: `${responseA}\n\n${questionText}` }
      const nextHistory = [...newHistory, aMsg]
      setHistory(nextHistory)
      setAiMessage({ ...res, response_a: responseA, question: questionText })
      setTurn(t => t + 1)
      setDoorTurn(t => t + 1)
      setFallbackSuggestionDismissed(false)
      if (res.thread_context) setThreadCtx(res.thread_context)
      reset()
      setManualText('')

      // Tracker les détections d'ombre
      const nextShadowEvents = [...shadowEvents]
      const nextMaxShadowLevel = maxShadowLevel
      const shadowLvl = res.shadow_level ?? 0
      if (shadowLvl >= 1) {
        nextShadowEvents.push({
          turn: turn + 1,
          door: cardGroup,
          level: shadowLvl,
          urgent: res.shadow_urgent ?? false,
          resource_card: res.resource_card ?? null,
          at: new Date().toISOString(),
        })
        setShadowEvents(nextShadowEvents)
        if (shadowLvl > maxShadowLevel) setMaxShadowLevel(shadowLvl)
      }

      // Sauvegarde session en cours (historique complet)
      const nextPetalsHistory = [...petalsHistory, { petals: { ...petals }, petalsDeficit: { ...petalsDeficit } }]
      const nextMax = Math.max(maxShadowLevel, shadowLvl)
      saveSessionInProgress({
        history: nextHistory,
        petals: { ...nextPetals, ...Object.fromEntries([...overriddenPetals].map(id => [id, petals[id]])) },
        turn_count: turn + 1,
        doorTurn: doorTurn + 1,
        petalsDeficit: res.petals_deficit ?? {},
        petalsHistory: nextPetalsHistory,
        shadowEvents: nextShadowEvents,
        maxShadowLevel: nextMax,
      })

      // Proposition de carte si l'IA suggère — pour la porte courante ; afficher dès qu'une carte est proposée
      if (res.suggest_card && res.suggest_card.door === currentDoor && !currentCard && !showCardDraw && lockedDoors.length < 4) {
        setPendingSugg(res.suggest_card)
      }
      // Diagnostic : OpenRouter a échoué, on utilise le mock (afficher une fois)
      if (res._openrouter_error && !window.__fleurOpenRouterWarned) {
        window.__fleurOpenRouterWarned = true
        toast(`IA : OpenRouter indisponible (${res._openrouter_error}). Mode dégradé actif.`, 'warning')
      }

        setLoading(false)
        return
      } catch (e) {
        if (attempt < RETRY_MAX) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
          continue
        }
        setHistory(history)
        setManualText(text)
        setError(t('session.tutorErrorSoft'))
        setLoading(false)
      }
    }
  }

  function handleRetrySend() {
    const text = lastFailedTextRef.current || manualText
    if (!text.trim()) return
    setError('')
    if (!currentCard) {
      sendToTuteurWithCard(text, '__no_card__', currentDoor)
    } else {
      sendToTuteurWithCard(text, currentCard.name, currentDoor)
    }
  }

  // ── Carte tirée ───────────────────────────────────────────
  function handleCardDrawn(card, doorOverride, opts = {}) {
    const { isRandomDraw = false } = opts
    const doorToUse = doorOverride ?? currentDoor
    const doorObj = DOOR_MAP[doorToUse] ?? FOUR_DOORS[0]
    // Vérifier que la carte appartient bien à la porte (éviter incohérence carte/porte)
    const cardInDoor = doorObj?.group?.some((c) => (c.name || '').toLowerCase() === (card?.name || '').toLowerCase())
    const cardToUse = cardInDoor ? card : (doorObj?.group?.[Math.floor(Math.random() * (doorObj?.group?.length || 1))] ?? card)
    const newDrawn = [...drawnCards, { door: doorToUse, card: cardToUse }]
    setDrawnCards(prev => [...prev, { door: doorToUse, card: cardToUse }])
    setShowCardDraw(false)
    setPendingSugg(null)
    if (doorToUse === currentDoor) {
      setCurrentCard(cardToUse)
      setDoorTurnAtCardDraw(doorTurn) // Pour retarder le résumé : attendre quelques échanges après la carte
      // Tirage au hasard : mettre à jour la question de l'IA en fonction de la nouvelle carte
      if (isRandomDraw) {
        aiApi.cardQuestion({
          card_name: cardToUse.name,
          card_desc: cardToUse.desc || '',
          door: currentDoor,
          history,
        })
          .then(res => {
            if (res?.question) {
              const response_a = res.response_a || `Vous avez tiré « ${cardToUse.name} ».`
              const newMsg = {
                response_a,
                response_b: '',
                question: res.question,
                reflection: null,
                suggest_card: null,
                thread_context: null,
                shadow_detected: false,
                explore_petal: null,
              }
              setAiMessage(newMsg)
              // Mettre à jour l'historique pour que la reprise affiche le bon texte (carte tirée, pas la suggérée)
              setHistory(prev => {
                if (prev.length === 0) return prev
                const last = prev[prev.length - 1]
                if (last?.role !== 'assistant') return prev
                const updated = [...prev.slice(0, -1), { role: 'assistant', content: `${response_a}\n\n${res.question}` }]
                saveSessionInProgress({ history: updated })
                return updated
              })
            }
          })
          .catch(() => {})
      }
    }
    saveSessionInProgress({
      cards_drawn: newDrawn.map(d => ({ door: d.door, card_name: d.card?.name })),
      doorTurnAtCardDraw: doorToUse === currentDoor ? doorTurn : doorTurnAtCardDraw,
    })
  }

  // ── Verrouillage de porte (synthèse automatique) ────────────
  function handleDoorLock({ synthesis, habit }) {
    const door = DOOR_MAP[currentDoor]
    const newAnchor = {
      door: currentDoor,
      subtitle: door?.subtitle ?? currentDoor,
      synthesis,
      habit: habit || '',
    }
    const newLocked = [...lockedDoors, currentDoor]
    setAnchors(prev => [...prev, newAnchor])
    setLockedDoors(prev => [...prev, currentDoor])
    setDoorLocked(true)
    saveSessionInProgress({
      anchors: [...anchors, newAnchor],
      doors_locked: newLocked,
    })
  }

  // ── Proposition de passage : résumé après plusieurs échanges ayant intégré la carte (pas juste après le tirage) ──
  const hasCardForCurrentDoor = drawnCards.some(d => d.door === currentDoor) || !!currentCard
  const exchangesSinceCard = doorTurnAtCardDraw !== null ? doorTurn - doorTurnAtCardDraw : 0
  const hasIntegratedCard = exchangesSinceCard >= 3 // Au moins 3 échanges après la carte
  // Reprise : si 4+ échanges avec carte, considérer intégrée (on ne sait pas exactement quand la carte a été tirée)
  const isResumeWithEnoughExchanges = !!initialState && doorTurn >= 4 && hasCardForCurrentDoor
  const shouldProposeTransition = (aiMessage?.turn_complete || doorTurn >= 3) && (hasIntegratedCard || isResumeWithEnoughExchanges) && !doorLocked && !showSummaryPanel && hasCardForCurrentDoor
  useEffect(() => {
    if (!shouldProposeTransition) return
    // Si l'IA a fourni door_summary_preview, l'utiliser
    if (aiMessage?.door_summary_preview) {
      setDoorSummary({
        door_summary_preview: aiMessage.door_summary_preview,
        next_door_suggestion: aiMessage.next_door_suggestion,
      })
      setShowSummaryPanel(true)
      lastSummarizedHistoryLen.current = history.length
      return
    }
    // Sinon, appeler l'API pour générer le résumé
    setSummaryLoading(true)
    setShowSummaryPanel(true)
    lastSummarizedHistoryLen.current = history.length
    const door = DOOR_MAP[currentDoor]
    aiApi.extractDoorSummary({
      history: history,
      door_subtitle: door?.subtitle ?? 'cette Porte',
      door_key: currentDoor,
    })
      .then((res) => {
        setDoorSummary({
          door_summary_preview: res,
          next_door_suggestion: aiMessage?.next_door_suggestion,
        })
      })
      .catch(() => {
        const lastUser = history.filter(m => m.role === 'user').pop()
        setDoorSummary({
          door_summary_preview: {
            synthesis_suggestion: lastUser?.content?.trim() || `${t('session.explorationOf')} ${door?.subtitle ?? t('session.thisDoor')}`,
            paths_solutions: '',
          },
        })
      })
      .finally(() => setSummaryLoading(false))
  }, [shouldProposeTransition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mise à jour du résumé quand l'utilisateur continue à échanger après l'affichage du résumé
  useEffect(() => {
    if (!showSummaryPanel || doorLocked || history.length <= lastSummarizedHistoryLen.current) return
    lastSummarizedHistoryLen.current = history.length
    setSummaryLoading(true)
    const door = DOOR_MAP[currentDoor]
    aiApi.extractDoorSummary({
      history,
      door_subtitle: door?.subtitle ?? 'cette Porte',
      door_key: currentDoor,
    })
      .then((res) => {
        setDoorSummary(prev => ({
          door_summary_preview: res,
          next_door_suggestion: prev?.next_door_suggestion,
        }))
      })
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
  }, [showSummaryPanel, doorLocked, history, currentDoor])

  function confirmDoorTransition() {
    const prev = doorSummary?.door_summary_preview || {}
    const synthesis = prev.synthesis_suggestion || prev.synthesis || ''
    handleDoorLock({ synthesis, habit: '' })
    setShowSummaryPanel(false)
    setShowInputWithSummary(false)
    setDoorSummary(null)
  }

  // ── Passage à la porte suivante après confirmation (ou onComplete si 4 portes) ──
  useEffect(() => {
    if (!doorLocked) return
    if (lockedDoors.length >= 4) {
      onComplete({
        petals,
        petalsDeficit,
        petalsHistory,
        cardsDrawn: drawnCards.map(d => d.card.name),
        drawnCardsWithDetails: drawnCards,
        history,
        anchors,
        lockedDoors,
        turnCount: turn,
        sessionId: thresholdData?.sessionId,
      })
      return
    }
    const t = setTimeout(() => nextDoor(), 1500)
    return () => clearTimeout(t)
  }, [doorLocked, lockedDoors.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Porte suivante ────────────────────────────────────────
  async function nextDoor() {
    const allDoorKeys = FOUR_DOORS.map(d => d.key)
    const remaining = allDoorKeys.filter(k => !lockedDoors.includes(k) && k !== currentDoor)

    if (remaining.length === 0) {
      onComplete({
        petals,
        petalsDeficit,
        petalsHistory,
        cardsDrawn: drawnCards.map(d => d.card.name),
        drawnCardsWithDetails: drawnCards,
        history,
        anchors,
        lockedDoors: [...lockedDoors, currentDoor],
        turnCount: turn,
        sessionId: thresholdData?.sessionId,
      })
      return
    }

    // Choisir la porte suivante en fonction de la suggestion ou de l'ordre
    const nextKey = pendingSuggestion?.door && remaining.includes(pendingSuggestion.door)
      ? pendingSuggestion.door
      : remaining[0]

    const nextDoorObj = DOOR_MAP[nextKey] ?? FOUR_DOORS[0]
    const existingDrawn = drawnCards.find(x => x.door === nextKey)
    const nextDoorTurnAtCardDraw = existingDrawn ? 0 : null

    setCurrentDoor(nextKey)
    setDoorLocked(false)
    setDoorTurn(0)
    setAiMessage(null)
    setPendingSugg(null)
    setFallbackSuggestionDismissed(false)
    setShowCardDraw(false)
    setDoorIntroMessage(null)
    setPreDrawnCard(null)
    reset()
    setDoorTurnAtCardDraw(nextDoorTurnAtCardDraw)
    saveSessionInProgress({ currentDoor: nextKey, doorTurn: 0, doorTurnAtCardDraw: nextDoorTurnAtCardDraw })
    const card = existingDrawn ? existingDrawn.card : nextDoorObj.group[Math.floor(Math.random() * nextDoorObj.group.length)]
    if (existingDrawn) {
      setCurrentCard(card)
    } else {
      // Même flow pour toutes les portes (y compris la 4e) : proposition puis validation par l'utilisateur
      setCurrentCard(null)
      setPreDrawnCard(card)
    }
    try {
      const introRes = await aiApi.doorIntro({
        door: nextKey,
        first_words: thresholdData?.firstWords || '',
        anchors,
        card_name: card.name,
        card_theme: card.desc?.split('\n')[0] || '',
        history,
        locked_doors: lockedDoors,
        petals: petals,
      })
      const txt = introRes?.door_intro || introRes?.question || ''
      setDoorIntroMessage({
        response_a: txt,
        response_b: '',
        question: introRes?.question || "Qu'est-ce qui est vivant pour vous en entrant dans cette porte ?",
        reflection: null,
        suggest_card: null,
        thread_context: null,
        shadow_detected: false,
        explore_petal: null,
      })
    } catch (_) {
      setDoorIntroMessage({
        response_a: `${nextDoorObj.subtitle} ${t('session.invitesContinue')}`,
        response_b: '',
        question: "Qu'est-ce qui est vivant pour vous en entrant dans cette porte ?",
        reflection: null,
        suggest_card: null,
        thread_context: null,
        shadow_detected: false,
        explore_petal: null,
      })
    }
  }

  // ── Fin sans passer par toutes les portes ─────────────────
  function finishSession() {
    onComplete({
      petals,
      petalsDeficit,
      petalsHistory,
      cardsDrawn: drawnCards.map(d => d.card.name),
      drawnCardsWithDetails: drawnCards,
      history,
      anchors,
      lockedDoors,
      turnCount: turn,
      sessionId: thresholdData?.sessionId,
    })
  }

  // ── Calcul d'affichage ────────────────────────────────────
  // Pendant l'écoute : manualText + interimText en cours (aperçu)
  // Après arrêt mic  : manualText seul (le résultat final y a déjà été concaténé via onResult)
  const effectiveText = listening && interimText
    ? (manualText.trimEnd() ? `${manualText.trimEnd()} ${interimText}` : interimText)
    : manualText
  const textToSend      = effectiveText
  const door            = DOOR_MAP[currentDoor] ?? FOUR_DOORS[0]
  const aiSuggestsLock  = aiMessage?.turn_complete === true
  const shadowPetalId   = aiMessage?.shadow_detected
    ? Object.entries(petals).reduce((a, b) => b[1] > a[1] ? b : a, ['', 0])[0]
    : null

  // Message initial à afficher (avant premier envoi ou après reprise)
  const displayMessage = aiMessage ?? doorIntroMessage ?? (lastAssistantMsg
    ? { response_a: '', response_b: '', question: lastAssistantMsg.content, reflection: null, suggest_card: null, thread_context: null, shadow_detected: false, explore_petal: null }
    : initialAiMsg.current)

  const inputZoneRef = useRef(null)
  const conversationScrollRef = useRef(null)
  const sessionInputTextareaRef = useRef(null)
  // Toujours positionner le scroll sur les derniers mots — nouvel échange, réponse IA, ou parole (vocal/taper)
  useEffect(() => {
    const el = conversationScrollRef.current
    if (!el) return
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(raf)
  }, [history.length, aiMessage, effectiveText])

  // Textarea Session : garder le curseur visible lors de la dictée (texte trop long = défilement vers le bas)
  useEffect(() => {
    const ta = sessionInputTextareaRef.current
    if (!ta) return
    const raf = requestAnimationFrame(() => {
      ta.scrollTop = ta.scrollHeight
    })
    return () => cancelAnimationFrame(raf)
  }, [effectiveText])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerContentRef = useRef(null)
  const [cardModal, setCardModal] = useState(null)
  const [cardImageZoomed, setCardImageZoomed] = useState(false)
  const [flowerZoomOpen, setFlowerZoomOpen] = useState(false)
  const [mobileFlowerExpanded, setMobileFlowerExpanded] = useState(true)
  const [exchangesModalOpen, setExchangesModalOpen] = useState(false)
  const [cardContext, setCardContext] = useState(null)
  const [cardContextLoading, setCardContextLoading] = useState(false)

  useEffect(() => {
    if (!cardModal) {
      setCardContext(null)
      return
    }
    if (!history.length) {
      setCardContext(null)
      setCardContextLoading(false)
      return
    }
    setCardContextLoading(true)
    setCardContext(null)
    aiApi.cardContext({
      card_name: cardModal.card.name,
      card_desc: cardModal.card.desc || '',
      door: cardModal.door,
      history,
    })
      .then(res => setCardContext(res?.context || ''))
      .catch(() => setCardContext(''))
      .finally(() => setCardContextLoading(false))
  }, [cardModal]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (drawerOpen && drawerContentRef.current) {
      drawerContentRef.current.scrollTop = 0
    }
  }, [drawerOpen])

  const renderLeftColumnContent = ({ flowerSize = 320, compact = false }) => (
    <div className={`space-y-4 ${compact ? 'p-3 space-y-3' : 'p-4 lg:p-0'}`}>
      <div className="flex flex-col items-center w-full shrink-0">
        <button
          type="button"
          onClick={() => { setFlowerZoomOpen(true); setDrawerOpen(false) }}
          className="cursor-zoom-in hover:opacity-90 transition-opacity rounded-lg flex justify-center items-center"
          aria-label="Agrandir la fleur">
          <FlowerSVG
            petals={petals}
            petalsDeficit={petalsDeficit}
            petalsEvolution={petalsHistory.length > 0 ? petalsHistory[petalsHistory.length - 1] : null}
            size={flowerSize}
            animate
            showLabels
            overriddenPetals={overriddenPetals}
            highlightId={aiMessage?.explore_petal ?? undefined}
          />
        </button>
        {(Object.values(petalsDeficit || {}).some(v => (v ?? 0) > 0.05) || petalsHistory.length > 0) && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 text-center flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              <span>{t('session.rises')}</span>
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="inline-flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 dark:bg-red-500" />
              <span>{t('session.tensions')}</span>
            </span>
            {petalsHistory.length > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span className="inline-flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full border border-blue-400 dark:border-blue-500 border-dashed" />
                  <span>{t('session.evolution')}</span>
                </span>
              </>
            )}
          </p>
        )}
      </div>
      {threadContext && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1">{t('session.liveThreads')}</p>
          <LiveThreads threadContext={threadContext} />
        </div>
      )}
      <SovereigntyPanel
        petals={petals}
        overriddenPetals={overriddenPetals}
        onChange={handlePetalOverride}
        autoOpen={compact ? false : !!(aiMessage?.shadow_detected && (doorTurn >= 3 || aiMessage?.shadow_urgent))}
        shadowPetalId={shadowPetalId}
      />
      <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2 ${compact ? 'p-2' : 'p-3'}`}>
        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('session.drawnCards')}</p>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {['love', 'vegetal', 'elements', 'life'].map(doorKey => {
            const d = drawnCards.find(x => x.door === doorKey)
            const doorObj = DOOR_MAP[doorKey] ?? FOUR_DOORS[0]
            const doorLabel = getDoorLabels()[doorKey] ?? doorKey
            const cardSize = compact ? 'w-14 h-20' : 'w-16 h-24'
            return (
              <div key={doorKey} className="flex flex-col items-center gap-0.5 min-w-0">
                {d ? (
                  <button
                    type="button"
                    onClick={() => { setCardModal(d); setDrawerOpen(false) }}
                    title={d.card.name}
                    className="flex flex-col items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity w-full">
                    <div className={`${cardSize} rounded-lg overflow-hidden border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex-shrink-0 relative flex items-center justify-center`}>
                      {d.card.img ? (
                        <>
                          <img src={d.card.img} alt={d.card.name} className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none'; e.target.parentElement?.querySelector('.card-fallback')?.classList.remove('hidden') }} />
                          <span className="card-fallback hidden absolute inset-0 flex items-center justify-center p-0.5 text-[7px] text-slate-500 dark:text-slate-400 text-center leading-tight break-words">{d.card.name}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-600 dark:text-slate-300 text-center leading-tight break-words px-1">{d.card.name}</span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-600 dark:text-slate-300 text-center leading-tight w-full min-w-0 truncate block">{d.card.name}</span>
                  </button>
                ) : (
                  <div className={`${cardSize} rounded-lg overflow-hidden border-2 border-slate-300 dark:border-slate-600 bg-slate-100/50 dark:bg-slate-800/30 flex-shrink-0 flex items-center justify-center`}>
                    <img src={BACK_IMG} alt="" className="w-full h-full object-contain" />
                  </div>
                )}
                <span className={`text-[9px] font-medium ${doorObj.color}`}>{doorLabel}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const leftColumnContent = renderLeftColumnContent({ flowerSize: 420 })
  const drawerContent = renderLeftColumnContent({ flowerSize: 280, compact: true })

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col min-h-0">

      {/* ── Bande mobile : accordéon cartes + fleur + souveraineté ── */}
      <div className="lg:hidden shrink-0 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Barre de repli — toujours visible */}
        <button
          type="button"
          onClick={() => setMobileFlowerExpanded(e => !e)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
          aria-expanded={mobileFlowerExpanded}
          aria-label={mobileFlowerExpanded ? 'Replier la Fleur et les cartes' : 'Déplier la Fleur et les cartes'}>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {mobileFlowerExpanded ? t('session.flowerCardsSovereignty') : t('session.unfoldHint')}
          </span>
          <span className={`text-slate-400 transition-transform duration-300 ${mobileFlowerExpanded ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {/* Contenu repliable */}
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${mobileFlowerExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="px-3 pb-3 space-y-2">
        <div className="flex flex-row items-center gap-3">
          {/* 4 cartes en grille 2×2 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 shrink-0 overflow-visible">
            <div className="grid grid-cols-2 gap-1.5">
              {['love', 'vegetal', 'elements', 'life'].map(doorKey => {
                const d = drawnCards.find(x => x.door === doorKey)
                const doorObj = DOOR_MAP[doorKey] ?? FOUR_DOORS[0]
                const doorLabel = getDoorLabels()[doorKey] ?? doorKey
                return (
                  <div key={doorKey} className="flex flex-col items-center gap-0 min-w-0">
                    {d ? (
                      <button type="button" onClick={() => setCardModal(d)} title={d.card.name}
                        className="flex flex-col items-center gap-0 cursor-pointer hover:opacity-80 transition-opacity w-full">
                        <div className="w-14 h-20 rounded-md overflow-hidden border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex-shrink-0 relative flex items-center justify-center">
                          {d.card.img ? (
                            <>
                              <img src={d.card.img} alt={d.card.name} className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none'; e.target.parentElement?.querySelector('.card-fallback')?.classList.remove('hidden') }} />
                              <span className="card-fallback hidden absolute inset-0 flex items-center justify-center p-0.5 text-[6px] text-slate-500 dark:text-slate-400 text-center leading-tight break-words">{d.card.name}</span>
                            </>
                          ) : (
                            <span className="text-[8px] text-slate-600 dark:text-slate-300 text-center leading-tight break-words px-0.5">{d.card.name}</span>
                          )}
                        </div>
                        <span className={`text-[8px] font-medium truncate w-full text-center px-0.5 ${doorObj.color}`}>{doorLabel}</span>
                      </button>
                    ) : (
                      <div className="flex flex-col items-center gap-0 w-full">
                        <div className="w-14 h-20 rounded-md overflow-hidden border border-slate-300 dark:border-slate-600 bg-slate-100/50 dark:bg-slate-800/30 flex-shrink-0 flex items-center justify-center">
                          <img src={BACK_IMG} alt="" className="w-full h-full object-contain" />
                        </div>
                        <span className={`text-[8px] font-medium ${doorObj.color}`}>{doorLabel}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {/* Fleur */}
          <div className="flex-1 flex flex-col items-center">
            <button type="button" onClick={() => setFlowerZoomOpen(true)}
              className="cursor-zoom-in hover:opacity-90 transition-opacity rounded-lg flex justify-center items-center"
              aria-label="Agrandir la fleur">
              <FlowerSVG
                petals={petals}
                petalsDeficit={petalsDeficit}
                petalsEvolution={petalsHistory.length > 0 ? petalsHistory[petalsHistory.length - 1] : null}
                size={220}
                animate
                showLabels
                overriddenPetals={overriddenPetals}
                highlightId={aiMessage?.explore_petal ?? undefined}
              />
            </button>
            {(Object.values(petalsDeficit || {}).some(v => (v ?? 0) > 0.05) || petalsHistory.length > 0) && (
              <p className="text-[9px] text-slate-500 dark:text-slate-400 text-center flex items-center justify-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-emerald-500" />{t('session.rises')}</span>
                <span className="text-slate-400">|</span>
                <span className="inline-flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-red-400" />{t('session.tensions')}</span>
                {petalsHistory.length > 0 && (
                  <><span className="text-slate-400">|</span><span className="inline-flex items-center gap-0.5"><span className="w-1 h-1 rounded-full border border-blue-400 border-dashed" />{t('session.evolution')}</span></>
                )}
              </p>
            )}
          </div>
        </div>
        {/* Bouton Souveraineté */}
        <button type="button" onClick={() => setDrawerOpen(true)}
          className="w-full py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors">
          {t('session.sovereignty')} · {t('session.liveThreads')} · {t('session.details')}
        </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[420px,1fr] gap-5 flex-1 min-h-0 min-w-0 overflow-hidden">

        {/* Colonne gauche — desktop, sticky pour rester visible au scroll */}
        <div className="hidden lg:block lg:sticky lg:top-4 lg:self-start min-w-0 min-h-0 h-full overflow-y-auto overflow-x-hidden">
          {leftColumnContent}
        </div>

        {/* Drawer mobile */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)} role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
            <div
              className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
              style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)' }}
              onClick={e => e.stopPropagation()}>
              <div className="shrink-0 flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{t('session.myFlowerCards')}</span>
                <button type="button" onClick={() => setDrawerOpen(false)} className="p-3 -m-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Fermer">✕</button>
              </div>
              <div ref={drawerContentRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
                {drawerContent}
              </div>
            </div>
          </div>
        )}

        {/* Modal zoom fleur */}
        {flowerZoomOpen && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={() => setFlowerZoomOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Fleur agrandie">
            <div className="relative flex flex-col items-center justify-center w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <FlowerSVG
                petals={petals}
                petalsDeficit={petalsDeficit}
                petalsEvolution={petalsHistory.length > 0 ? petalsHistory[petalsHistory.length - 1] : null}
                size={Math.min(window.innerWidth - 24, window.innerHeight - 120, 820)}
                animate
                showLabels
                overriddenPetals={overriddenPetals}
                highlightId={aiMessage?.explore_petal ?? undefined}
              />
              {(Object.values(petalsDeficit || {}).some(v => (v ?? 0) > 0.05) || petalsHistory.length > 0) && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 text-center flex items-center justify-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                    <span>{t('session.rises')}</span>
                  </span>
                  <span className="text-slate-400 dark:text-slate-600">|</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500" />
                    <span>{t('session.tensions')}</span>
                  </span>
                  {petalsHistory.length > 0 && (
                    <>
                      <span className="text-slate-400 dark:text-slate-600">|</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full border-2 border-blue-400 dark:border-blue-500 border-dashed" />
                        <span>{t('session.evolution')}</span>
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFlowerZoomOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold hover:bg-white dark:hover:bg-slate-700 shadow-lg z-10">
              ✕
            </button>
          </div>,
          document.body
        )}

        {/* Modal carte (description étendue + mise en contexte) — porté dans body pour fond opaque */}
        {cardModal && createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => { setCardModal(null); setCardImageZoomed(false) }} role="dialog" aria-modal="true" aria-labelledby="card-modal-title">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-md" aria-hidden="true" />
            <div
              className="relative max-w-md w-full max-h-[90vh] overflow-y-auto rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setCardImageZoomed(true)}
                  className="flex-shrink-0 cursor-zoom-in hover:opacity-90 transition-opacity rounded-xl overflow-hidden shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
                  title={t('session.zoomCard')}
                  aria-label={t('session.zoomCard')}>
                  <img src={cardModal.card.img} alt={cardModal.card.name} className="w-36 h-48 sm:w-44 sm:h-60 object-contain" onError={e => { e.target.style.display = 'none' }} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{getDoorTranslated(DOOR_MAP[cardModal.door], locale)?.subtitle ?? cardModal.door}</p>
                  <h3 id="card-modal-title" className="font-bold text-lg text-slate-800 dark:text-slate-100">{cardModal.card.name}</h3>
                  {(getCardTranslated(cardModal.card, locale).synth) && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic mt-2 leading-relaxed">
                      {getCardTranslated(cardModal.card, locale).synth}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Description</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {getCardTranslated(cardModal.card, locale).desc || ''}
                  </p>
                </div>
                {history.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-1">Mise en contexte</p>
                    {cardContextLoading ? (
                      <div className="flex items-center gap-2 py-2">
                        <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-500 rounded-full animate-spin" />
                        <span className="text-xs text-slate-500 italic">Reliance avec votre conversation…</span>
                      </div>
                    ) : cardContext ? (
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">{cardContext}</p>
                    ) : null}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setCardModal(null)} className="mt-6 w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700">{t('common.close')}</button>
            </div>
          </div>,
          document.body
        )}

        {/* Zoom pleine page carte (détails + mini explication) */}
        {cardModal && cardImageZoomed && createPortal(
          <div
            className="fixed inset-0 z-[70] flex flex-col items-center justify-center p-4 bg-black/95 backdrop-blur-md"
            onClick={() => setCardImageZoomed(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Carte agrandie">
            <div className="flex flex-col items-center gap-4 max-w-2xl w-full" onClick={e => e.stopPropagation()}>
              <img
                src={cardModal.card.img}
                alt={cardModal.card.name}
                className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-xl shadow-2xl cursor-zoom-out"
                style={{ maxHeight: 'min(70vh, 540px)' }}
                onError={e => { e.target.style.display = 'none' }}
                onClick={() => setCardImageZoomed(false)}
              />
              <div className="rounded-xl bg-white dark:bg-[#0f172a] px-5 py-4 w-full text-center shadow-xl border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-1">
                  {getDoorTranslated(DOOR_MAP[cardModal.door], locale)?.subtitle ?? cardModal.door}
                </p>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{cardModal.card.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 italic mt-2 leading-relaxed">
                  {getCardTranslated(cardModal.card, locale).synth || getCardTranslated(cardModal.card, locale).desc?.split('\n')[0] || ''}
                </p>
                <p className="text-xs text-slate-400 mt-3">{t('session.zoomCardClose')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCardImageZoomed(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold hover:bg-white dark:hover:bg-slate-700 shadow-lg z-10">
              ✕
            </button>
          </div>,
          document.body
        )}

        {/* ── Colonne droite : Conversation (scroll interne) — scroll auto vers le bas sur nouvel échange ou parole ── */}
        <div ref={conversationScrollRef} className="space-y-4 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-stretch pb-8">

          {/* Barre de progression des portes */}
          <div className={`rounded-2xl border-2 ${door.border} p-4 flex gap-3 items-center w-full shrink-0`}>
            {currentCard && (
              <button
                type="button"
                onClick={() => setCardModal({ door: currentDoor, card: currentCard })}
                className="w-12 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 hover:opacity-80 transition-opacity"
                aria-label={`Voir la description de ${currentCard.name}`}>
                <img src={currentCard.img} alt={currentCard.name} className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className={`text-xs font-bold ${door.color}`}>{door.subtitle}</p>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                  {t('session.doorXof4', { n: lockedDoors.length + 1 })}
                </span>
              </div>
              {currentCard && (
                <p className="font-semibold text-sm truncate">{currentCard.name}</p>
              )}
              {!currentCard && (
                <p className="text-xs text-slate-400 italic">Pas encore de carte tirée</p>
              )}
              <div className="flex gap-1 mt-1.5" role="progressbar" aria-valuenow={lockedDoors.length} aria-valuemin={0} aria-valuemax={4} aria-label="Progression des portes">
                {FOUR_DOORS.map(d => (
                  <div key={d.key}
                    className={`h-2 flex-1 rounded-full transition-all duration-500 ease-out
                      ${lockedDoors.includes(d.key) ? 'bg-emerald-500'
                        : d.key === currentDoor ? (d.bg ?? 'bg-violet-500')
                        : 'bg-slate-200 dark:bg-slate-700'}`}
                    title={d.subtitle}
                  />
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Échange {doorTurn} sur cette porte</p>
            </div>
          </div>

          {/* Alerte ombre — visible après N échanges selon le niveau, ou immédiatement si urgent */}
          {aiMessage?.shadow_detected && (() => {
            const level = aiMessage.shadow_level ?? 1
            const minTurns = level >= 4 ? 0 : level >= 3 ? 2 : 3
            if (doorTurn < minTurns && !aiMessage?.shadow_urgent) return null

            // Palette par niveau
            const palette = level >= 4
              ? { bg: 'from-red-950 to-slate-950', border: 'border-red-700', icon: '🔴', labelKey: 'distress', labelColor: 'text-red-300', reflectionBorder: 'border-red-500', anchorColor: 'text-red-300', ctaBg: 'bg-red-900/50 border-red-700/50', ctaText: 'text-red-200', ctaBtn: 'bg-red-600 hover:bg-red-500', pulse: true }
              : level >= 3
              ? { bg: 'from-rose-950 to-slate-950', border: 'border-rose-700', icon: '🌑', labelKey: 'strongShadow', labelColor: 'text-rose-300', reflectionBorder: 'border-rose-500', anchorColor: 'text-rose-300', ctaBg: 'bg-rose-900/50 border-rose-700/50', ctaText: 'text-rose-200', ctaBtn: 'bg-rose-600 hover:bg-rose-500', pulse: false }
              : level >= 2
              ? { bg: 'from-orange-950 to-slate-950', border: 'border-orange-700', icon: '🌘', labelKey: 'notableTension', labelColor: 'text-orange-300', reflectionBorder: 'border-orange-500', anchorColor: 'text-orange-300', ctaBg: 'bg-orange-900/40 border-orange-700/40', ctaText: 'text-orange-200', ctaBtn: 'bg-orange-600 hover:bg-orange-500', pulse: false }
              : { bg: 'from-amber-950 to-slate-950', border: 'border-amber-700', icon: '🌗', labelKey: 'lightShadow', labelColor: 'text-amber-300', reflectionBorder: 'border-amber-500', anchorColor: 'text-amber-300', ctaBg: 'bg-amber-900/30 border-amber-700/30', ctaText: 'text-amber-200', ctaBtn: 'bg-amber-600 hover:bg-amber-500', pulse: false }

            const resourceCardObj = aiMessage.resource_card
              ? (DOOR_MAP['love']?.group ?? []).find(c => (c.name || '').toLowerCase() === (aiMessage.resource_card || '').toLowerCase())
              : null
            const reflectionText = aiMessage.reflection
            return (
              <div
                className={`rounded-2xl bg-gradient-to-br ${palette.bg} border ${palette.border} p-4 shrink-0 w-full shadow-xl ${palette.pulse ? 'ring-2 ring-red-600/50 ring-offset-1 ring-offset-slate-900' : ''}`}
                style={{ animation: 'slideUp 0.5s ease' }}>
                {/* En-tête */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{palette.icon}</span>
                  <p className={`text-xs font-bold uppercase tracking-widest ${palette.labelColor}`}>{palette.labelKey ? t(`session.${palette.labelKey}`) : palette.label}</p>
                  <span className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded ${palette.ctaBg} ${palette.anchorColor}`}>N{level}</span>
                </div>

                {/* Observation du Tuteur */}
                {reflectionText && (
                  <TranslatableContent
                    text={reflectionText}
                    className={`text-sm text-slate-300 leading-relaxed italic mb-3 border-l-2 ${palette.reflectionBorder} pl-3`}
                    as="p"
                  />
                )}

                {/* Carte ressource */}
                {(resourceCardObj || aiMessage.resource_card) && (
                  <div className="flex gap-3 items-center mb-3 bg-white/5 rounded-xl p-2">
                    {resourceCardObj ? (
                      <button
                        type="button"
                        onClick={() => setCardModal({ door: 'love', card: resourceCardObj })}
                        className={`w-10 h-14 flex-shrink-0 rounded-lg overflow-hidden border ${palette.border} hover:opacity-80 transition-opacity cursor-pointer`}
                        title="Cliquer pour agrandir">
                        <img src={resourceCardObj.img} alt={resourceCardObj.name} className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none' }} />
                      </button>
                    ) : (
                      <span className="text-2xl flex-shrink-0">🌿</span>
                    )}
                    <div className="min-w-0">
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${palette.anchorColor}`}>{t('session.proposedAnchor')}</p>
                      <p className="text-xs text-slate-200 font-medium">{aiMessage.resource_card}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{t('session.dynamicHelp')}</p>
                    </div>
                  </div>
                )}

                {/* CTA accompagnement — uniquement en stade critique (ombre forte ou détresse, niv. 3+) */}
                {level >= 3 && (
                <div className={`rounded-xl ${palette.ctaBg} border p-3 mt-1`}>
                  <p className={`text-xs ${palette.ctaText} leading-relaxed mb-2`}>
                    {level >= 4
                      ? t('session.shadowBeyondTool')
                      : t('session.shadowDedicatedSpace')}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href="/contact"
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg ${palette.ctaBtn} text-white text-xs font-semibold transition-colors`}>
                      {t('session.requestAccompaniment')} →
                    </a>
                    <button
                      onClick={() => {
                        setDrawerOpen(true)
                        setTimeout(() => document.querySelector('[data-sovereignty-toggle]')?.click(), 200)
                      }}
                      className="text-[10px] font-medium px-2 py-1.5 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 transition-colors">
                      ✎ {t('session.inaccurateScore')}
                    </button>
                  </div>
                </div>
                )}
              </div>
            )
          })()}

          {/* Reprise : texte initial de l'utilisateur (premiers mots au seuil + première réponse si présente) */}
          {initialState && (thresholdData?.firstWords || (history.length > 0 && history[0]?.role === 'user')) && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 p-4 md:p-3 space-y-3 shrink-0 w-full">
              {thresholdData?.firstWords && (
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">{t('session.firstWords')}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic break-words">« {thresholdData.firstWords} »</p>
                </div>
              )}
              {history.length > 0 && history[0]?.role === 'user' && (
                <div className={`min-w-0 ${thresholdData?.firstWords ? 'border-t border-rose-200 dark:border-rose-800 pt-3' : ''}`}>
                  <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">{t('session.firstResponse')}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed break-words">« {history[0].content} »</p>
                </div>
              )}
            </div>
          )}

          {/* Bouton discret pour accéder aux échanges précédents */}
          {history.length > 2 && (
            <button
              type="button"
              onClick={() => setExchangesModalOpen(true)}
              className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
              aria-label="Voir les échanges précédents">
              <span className="text-slate-400 dark:text-slate-500">💬</span>
              <span>{t('session.previousExchanges')} ({Math.floor(history.length / 2)})</span>
            </button>
          )}

          {/* Modal échanges précédents */}
          {exchangesModalOpen && (
            <div
              className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/50"
              onClick={() => setExchangesModalOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Échanges précédents">
              <div
                className="relative w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
                onClick={e => e.stopPropagation()}>
                <div className="shrink-0 flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('session.previousExchanges')}</p>
                  <button
                    type="button"
                    onClick={() => setExchangesModalOpen(false)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                    aria-label="Fermer">
                    ✕
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                  {history.slice(0, -2).map((msg, i) => (
                    <div
                      key={i}
                      className={`text-sm leading-relaxed px-3 py-2 rounded-xl break-words ${
                        msg.role === 'user'
                          ? 'bg-rose-50 dark:bg-rose-950/20 text-slate-700 dark:text-slate-200 border-l-2 border-rose-300'
                          : 'bg-violet-50 dark:bg-violet-950/20 text-slate-600 dark:text-slate-300 italic border-l-2 border-violet-300'
                      }`}>
                      <span className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                        {msg.role === 'user' ? t('session.you') : t('session.tuteur')}
                      </span>
                      {msg.content}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Message du Tuteur (dernier échange) */}
          <div className="relative rounded-2xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/10 dark:to-slate-900 p-5 md:p-6 space-y-4 shrink-0 w-full max-w-full min-w-0 overflow-visible"
            style={{ animation: 'fadeIn 0.5s ease' }}>
            {/* Petite fleur — ouvre Ma Fleur et cartes — visible sur mobile uniquement */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden absolute top-3 right-3 flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-rose-500 to-violet-500 text-white shadow-md hover:shadow-lg active:scale-95 transition-all z-10"
              aria-label="Voir ma Fleur et mes cartes"
              title="Voir ma Fleur et mes cartes">
              <span className="text-base">🌸</span>
            </button>
            <div className="flex items-center justify-between pr-12 lg:pr-0">
              <p className="text-sm font-bold text-violet-500 uppercase tracking-widest">✦ {t('session.tuteur')}</p>
              {turn > 0 && (
                <span className="text-[10px] text-slate-400">Échange {turn}</span>
              )}
            </div>
            <p className="text-base leading-[1.6] italic text-slate-700 dark:text-slate-200 break-words">
              {!aiMessage && doorIntroMessage
                ? `Prenez un instant pour sentir ce qui se passe en vous. ${(doorIntroMessage.response_a || '').trim()}`
                : displayMessage.response_a}
            </p>
            {displayMessage.response_b && (
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words border-t border-violet-100 dark:border-violet-900 pt-2">
                {displayMessage.response_b}
              </p>
            )}
            {displayMessage.reflection && (
              <div className="flex items-start gap-2 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 px-3 py-2 min-w-0">
                <span className="text-teal-500 text-sm mt-0.5 flex-shrink-0">⚖</span>
                <TranslatableContent text={displayMessage.reflection} className="text-xs text-teal-700 dark:text-teal-300 leading-relaxed italic break-words min-w-0" as="p" />
              </div>
            )}
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-violet-100 dark:border-violet-900 p-4 md:p-5 w-full max-w-full min-w-0 overflow-visible">
              <p className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-100 leading-[1.6] break-words pb-px">
                {displayMessage.question}
              </p>
            </div>
          </div>

          {/* Proposition de tirage ou carte suggérée — jamais si une carte existe déjà pour cette porte (reprise de session) */}
          {((pendingSuggestion || (doorTurn >= 3 && !currentCard && !drawnCards.some(d => d.door === currentDoor) && !fallbackSuggestionDismissed && fallbackSuggestion))) && !showCardDraw && !doorLocked && !showSummaryPanel && lockedDoors.length < 4 && (
            <div className="w-fit max-w-full self-start shrink-0">
              <CardSuggestionPanel
              suggestion={pendingSuggestion || fallbackSuggestion}
              onShowCard={setCardModal}
              onAccept={() => {
                const displayedSugg = pendingSuggestion || fallbackSuggestion
                const d = DOOR_MAP[currentDoor] ?? door
                let card
                if (displayedSugg?.card_name) {
                  card = d.group.find(c => (c.name || '').toLowerCase() === (displayedSugg.card_name || '').toLowerCase())
                }
                if (!card) {
                  card = preDrawnCard ? preDrawnCard : d.group[Math.floor(Math.random() * d.group.length)]
                }
                handleCardDrawn(card, currentDoor)
                setPendingSugg(null)
                if (preDrawnCard) setPreDrawnCard(null)
              }}
              onRandomDraw={() => {
                const d = DOOR_MAP[currentDoor] ?? door
                const card = d.group[Math.floor(Math.random() * d.group.length)]
                handleCardDrawn(card, currentDoor, { isRandomDraw: true })
                setPendingSugg(null)
                if (preDrawnCard) setPreDrawnCard(null)
              }}
              onSkip={() => {
                if (pendingSuggestion) setPendingSugg(null)
                else setFallbackSuggestionDismissed(true)
              }}
            />
            </div>
          )}

          {/* Tirage effectif — utilise preDrawnCard si disponible (pas sur la 4e porte) */}
          {showCardDraw && lockedDoors.length < 4 && (
            <div className="w-fit max-w-full self-start shrink-0">
              <CardDrawPanel
              door={DOOR_MAP[currentDoor] ?? door}
              onDrawn={(card) => { handleCardDrawn(card, undefined, { isRandomDraw: true }); setPreDrawnCard(null) }}
              preDrawnCard={preDrawnCard}
              onBeforeDraw={onBeforeDrawCard}
            />
            </div>
          )}

          {/* Zone d'échange — masquée si tirage en cours ou si panneau résumé sans "continuer" */}
          {!doorLocked && !showCardDraw && (!showSummaryPanel || showInputWithSummary) && (
            <div ref={inputZoneRef} className="space-y-2 py-4 md:py-3 shrink-0 w-full">
              {/* Zone de saisie texte + micro — transcript vocal intégré dans le textarea pour éviter les sauts de layout */}
              <div className="space-y-2">
                <textarea
                  ref={sessionInputTextareaRef}
                  value={effectiveText}
                  onChange={e => {
                    // Si l'utilisateur tape pendant l'écoute, on arrête le mic
                    if (listening) stop()
                    setManualText(e.target.value)
                  }}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) && textToSend.trim() && !loading) {
                      e.preventDefault()
                      if (listening) stop()
                      sendToTuteur(textToSend)
                    }
                  }}
                  placeholder={listening ? t('session.speaking') : (supported ? t('session.speakOrWrite') : t('session.writeResponse'))}
                  rows={3}
                  disabled={loading}
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={!listening}
                  className={`w-full px-4 py-3 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 resize-none leading-relaxed disabled:opacity-50 overflow-y-auto transition-colors
                    ${listening
                      ? 'border-rose-400 dark:border-rose-600 bg-rose-50/40 dark:bg-rose-950/20 focus:ring-rose-400/40'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-violet-400/40'}`}
                />
                <div className="flex gap-2 items-center">
                  {supported && (
                    <MicButton listening={listening} supported={supported} onToggle={toggleMic} />
                  )}
                  <button
                    onClick={() => sendToTuteur(textToSend)}
                    disabled={!textToSend.trim() || loading}
                    className={`flex-1 h-11 rounded-xl flex items-center justify-center font-semibold text-sm transition-all active:scale-95
                      ${textToSend.trim() && !loading
                        ? 'bg-gradient-to-r from-violet-500 to-rose-500 text-white shadow-md'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                    title="Envoyer (Entrée)"
                    aria-label="Envoyer">
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {loading && (
                <p className="text-xs text-violet-400 italic text-center animate-pulse">{t('session.tuteurListening')}</p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200 space-y-3">
              <p>{error}</p>
              <p className="text-xs text-amber-600 dark:text-amber-300">{t('session.tutorErrorSavedHint')}</p>
              <button
                type="button"
                onClick={handleRetrySend}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors"
              >
                {t('session.tutorErrorRetry')}
              </button>
            </div>
          )}

          {/* Panneau résumé de porte — contexte, choix, intention (passage proposé) */}
          {showSummaryPanel && !doorLocked && (
            <>
              <DoorSummaryPanel
                door={door}
                summary={doorSummary}
                onConfirm={confirmDoorTransition}
                loading={summaryLoading}
                isLastDoor={lockedDoors.length === 3}
                card={currentCard}
              />
              {!showInputWithSummary && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowInputWithSummary(true)}
                    className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-violet-300 dark:border-violet-600 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors">
                    {t('session.continueExchanges')}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Bouton tirer une carte — après 4 échanges sur cette porte (portes 1 à 4) */}
          {!doorLocked && !showCardDraw && !showSummaryPanel && lockedDoors.length < 4 && (
            <div className="flex gap-2 flex-wrap">
              {!currentCard && !pendingSuggestion && doorTurn >= 6 && (
                <button
                  onClick={() => setShowCardDraw(true)}
                  className={`flex-1 min-w-[140px] py-2 rounded-xl text-xs font-semibold border ${door.border} ${door.color} bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors`}>
                  🎴 {t('session.drawCard')}
                </button>
              )}
            </div>
          )}

          {/* Transition automatique vers la porte suivante (message bref) */}
          {doorLocked && lockedDoors.length < 4 && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
              <p className="text-sm text-emerald-700 dark:text-emerald-300 animate-pulse">
                {lockedDoors.length === 3 ? t('session.preparingSynthPlan') : t('session.passingToNextDoor')}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cardReveal { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 4 : PLAN 14J
// ═══════════════════════════════════════════════════════════════

function PlanStep({ petals, petalsDeficit = {}, petalsHistory = [], cardsDrawn, drawnCardsWithDetails = [], history, anchors = [], onRestart, sessionMeta = {}, maxShadowLevel = 0 }) {
  const hasCompletedFirstSession = useStore((s) => s.hasCompletedFirstSession)
  const setHasCompletedFirstSession = useStore((s) => s.setHasCompletedFirstSession)
  const [showFirstSessionHint, setShowFirstSessionHint] = useState(!hasCompletedFirstSession)
  const [plan, setPlan]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [saved, setSaved]     = useState(false)
  const generated             = useRef(false)
  const planExportRef         = useRef(null)

  async function generate() {
    if (generated.current) return
    generated.current = true
    setLoading(true)
    try {
      const notes = history.filter(m => m.role === 'user').map(m => m.content).join('\n')
      const res   = await aiApi.plan14j({
        petals,
        cards_drawn: cardsDrawn,
        session_notes: notes,
        anchors,
        user_email: sessionMeta.email || undefined,
      })
      setPlan(res)
      saveSession(res)
    } catch (e) {
      setError(e.detail ?? e.message ?? t('session.planError'))
    } finally { setLoading(false) }
  }

  async function saveSession(planResult) {
    if (saved) return
    try {
      const elapsed = sessionMeta.startTime
        ? Math.round((Date.now() - sessionMeta.startTime) / 1000)
        : 0
      const payload = {
        petals,
        history,
        cards_drawn: cardsDrawn,
        anchors,
        plan14j: planResult,
        doors_locked: (sessionMeta.lockedDoors || []).join(','),
        turn_count: sessionMeta.turnCount || 0,
        status: 'completed',
        duration_seconds: elapsed,
      }
      if (sessionMeta.sessionId) {
        await sessionsApi.update({ id: sessionMeta.sessionId, ...payload })
      } else {
        await sessionsApi.save({
          email: sessionMeta.email || null,
          first_words: sessionMeta.firstWords || '',
          door_suggested: sessionMeta.doorSuggested || null,
          ...payload,
        })
      }
      setSaved(true)
      toast(t('session.saved'), 'success')
    } catch (_) { /* silent — archival is best-effort */ }
  }

  const cardsGrid = drawnCardsWithDetails?.length > 0 && (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-xl mx-auto">
      {drawnCardsWithDetails.map((d, i) => (
        <div key={d.door ?? i} className="flex flex-col items-center gap-1">
          <div className="w-20 h-28 sm:w-24 sm:h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0 flex">
            {d.card?.img ? (
              <>
                <img src={d.card.img} alt={d.card.name} className="w-full h-full object-contain" onError={e => { e.target.style.display = 'none'; e.target.parentElement?.querySelector('.card-fallback')?.classList.remove('hidden') }} />
                <span className="card-fallback hidden w-full h-full items-center justify-center p-0.5 text-[7px] text-slate-500 dark:text-slate-400 text-center leading-tight break-words">{d.card?.name ?? ''}</span>
              </>
            ) : (
              <span className="w-full h-full flex items-center justify-center p-0.5 text-[7px] text-slate-500 dark:text-slate-400 text-center leading-tight break-words">{d.card?.name ?? ''}</span>
            )}
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-300 text-center leading-tight truncate w-full px-0.5">{d.card?.name ?? ''}</span>
        </div>
      ))}
    </div>
  )

  const petalsEvolution = petalsHistory?.length > 0 ? petalsHistory[petalsHistory.length - 1] : null

  useEffect(() => {
    if (showFirstSessionHint) setHasCompletedFirstSession(true)
  }, [showFirstSessionHint, setHasCompletedFirstSession])

  if (!plan && !loading && !error) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6 py-8">
        <div className="flex flex-col items-center">
          <FlowerSVG petals={petals} petalsDeficit={petalsDeficit} petalsEvolution={petalsEvolution} size={400} animate showLabels />
          {(Object.values(petalsDeficit || {}).some(v => (v ?? 0) > 0.05) || petalsHistory?.length > 0) && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t('session.rises')}</span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> {t('session.tensions')}</span>
              {petalsHistory?.length > 0 && (
                <><span className="text-slate-300">|</span><span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full border border-blue-400 border-dashed" /> {t('session.evolution')}</span></>
              )}
            </p>
          )}
        </div>
        {cardsGrid}
        <h3 className="text-2xl font-bold">{t('session.sessionEnded')}</h3>
        <p className="text-slate-500 text-sm">{t('session.flowerReadyPlan')}</p>
        <button onClick={generate}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-violet-500 text-white font-bold text-lg shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-rose-500/25 active:scale-[0.98]">
          {t('session.generatePlan')}
        </button>
      </div>
    )
  }

  if (loading) return (
    <div className="flex flex-col items-center gap-6 py-12 max-w-2xl mx-auto" style={{ animation: 'fadeIn 0.4s ease' }}>
      <div className="flex flex-col items-center">
        <FlowerSVG petals={petals} petalsDeficit={petalsDeficit} petalsEvolution={petalsEvolution} size={400} animate showLabels />
        {(Object.values(petalsDeficit || {}).some(v => (v ?? 0) > 0.05) || petalsHistory?.length > 0) && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t('session.rises')}</span>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> {t('session.tensions')}</span>
            {petalsHistory?.length > 0 && (
              <><span className="text-slate-300">|</span><span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full border border-blue-400 border-dashed" /> {t('session.evolution')}</span></>
            )}
          </p>
        )}
      </div>
      {cardsGrid}
      <p className="text-slate-600 dark:text-slate-300 font-medium">{t('session.preparingPlan')}</p>
      <div className="w-full max-w-sm h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className="progress-bar-fill h-full rounded-full bg-gradient-to-r from-rose-500 to-violet-500" />
      </div>
      <style>{`
        @keyframes progressBar {
          0% { width: 0%; }
          100% { width: 95%; }
        }
        .progress-bar-fill {
          animation: progressBar 12s ease-out forwards;
        }
      `}</style>
    </div>
  )

  if (error) return (
    <div className="max-w-lg mx-auto py-8 text-center">
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-600">{error}</div>
      <button onClick={() => { generated.current = false; generate() }}
        className="mt-4 px-6 py-2 bg-violet-500 text-white rounded-xl font-semibold">{t('session.retry')}</button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6" style={{ animation: 'slideUp 0.6s ease' }}>
      {showFirstSessionHint && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 flex items-start justify-between gap-3">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            ✨ {t('onboarding.sessionDoneHint')}
          </p>
          <button
            type="button"
            onClick={() => setShowFirstSessionHint(false)}
            className="shrink-0 text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 text-lg"
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
      )}
      <div className="flex justify-end">
        <ExportPlan14j targetRef={planExportRef} />
      </div>
      <div ref={planExportRef} className="space-y-6">
      <div className="flex flex-col items-center">
        <FlowerSVG petals={petals} petalsDeficit={petalsDeficit} petalsEvolution={petalsEvolution} size={400} animate showLabels />
        {(Object.values(petalsDeficit || {}).some(v => (v ?? 0) > 0.05) || petalsHistory?.length > 0) && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t('session.rises')}</span>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> {t('session.tensions')}</span>
            {petalsHistory?.length > 0 && (
              <><span className="text-slate-300">|</span><span className="inline-flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full border border-blue-400 border-dashed" /> {t('session.evolution')}</span></>
            )}
          </p>
        )}
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400 italic text-center">
        {t('session.beforeLeaving')}
      </p>

      {/* Phrase-synthèse */}
      <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/10 dark:to-slate-900 p-5">
        <p className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-2">✦ {t('session.synthesisPhrase')}</p>
        <p className="text-base font-medium text-slate-800 dark:text-slate-100 leading-relaxed italic">
          {plan.synthesis || plan.synthesis_suggestion || t('session.synthesisFallback')}
        </p>
      </div>

      {/* Ancres */}
      {anchors.length > 0 && (
        <div className="rounded-2xl border border-emerald-300/60 dark:border-emerald-700/60 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40 dark:from-emerald-950/20 dark:via-slate-900 dark:to-emerald-950/10 p-5 space-y-3 shadow-sm">
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">✦ {t('session.sessionAnchors')}</p>
          {anchors.map((a, i) => (
            <div key={i} className="space-y-0.5 p-3 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-emerald-100/80 dark:border-emerald-900/40">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{a.subtitle}</p>
              <p className="text-sm text-slate-700 dark:text-slate-200 italic">"{a.synthesis}"</p>
              {a.habit && <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">{t('session.habit')} : {a.habit}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 3 micro-leviers */}
      <div className={`rounded-2xl border p-5 space-y-3 shadow-sm ${(plan.levers?.length ?? 0) > 0 ? 'border-violet-300/60 dark:border-violet-700/60 bg-gradient-to-br from-violet-50/80 via-white to-violet-50/40 dark:from-violet-950/20 dark:via-slate-900 dark:to-violet-950/10' : 'border-amber-200/60 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 dark:from-amber-950/10 dark:via-slate-900 dark:to-slate-900'}`}>
        <p className="text-xs font-bold text-violet-500 uppercase tracking-widest">{t('session.leversTitle')}</p>
        {(plan.levers?.length ?? 0) > 0 ? (plan.levers ?? []).map((lever, i) => {
          const [action, anchor] = lever.split('||ANCHOR||')
          return (
            <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-violet-100/80 dark:border-violet-900/40">
              <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{action}</p>
                {anchor && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {t('session.anchorAfter')} {anchor}
                  </p>
                )}
              </div>
            </div>
          )
        }) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            {t('session.leversEmptyHint')}
          </p>
        )}
      </div>

      {/* Plan 14j */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50/60 via-white to-violet-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-violet-950/10 p-5 space-y-4 shadow-sm">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('session.plan14Title')}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('session.plan14Desc')}</p>
        </div>
        <div className="space-y-3">
          {(plan.plan_14j || []).map((day, idx) => (
            <div
              key={day.day ?? idx}
              className="flex gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/50 shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/50 border border-violet-200/60 dark:border-violet-800/60 flex items-center justify-center">
                <span className="text-sm font-bold text-violet-700 dark:text-violet-300">J{day.day ?? idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{day.theme || 'Ancrage'}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                  {day.action || 'Respirer et observer.'}
                </p>
                {day.context && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">{day.context}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bloc accompagnement — visible uniquement en stade critique de l'ombre (niv. 3+) */}
      {maxShadowLevel >= 3 && (() => {
        const hasTensions = Object.values(petalsDeficit || {}).some(v => (v ?? 0) > 0.08)
        const tensionLabels = {
          agape: 'Agapè', philautia: 'Philautia', mania: 'Mania', storge: 'Storgè',
          pragma: 'Pragma', philia: 'Philia', ludus: 'Ludus', eros: 'Éros',
        }
        const tensionNames = hasTensions
          ? Object.entries(petalsDeficit || {})
              .filter(([, v]) => (v ?? 0) > 0.08)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([k]) => tensionLabels[k] ?? k)
          : []
        return (
          <div className={`rounded-2xl border p-5 space-y-3 ${
            hasTensions
              ? 'border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/15 dark:to-slate-900'
              : 'border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/10 dark:to-slate-900'
          }`}>
            <div className="flex items-start gap-2">
              <span className="text-xl mt-0.5">{hasTensions ? '🌑' : '🌸'}</span>
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest ${hasTensions ? 'text-rose-600 dark:text-rose-400' : 'text-violet-600 dark:text-violet-400'}`}>
                  {hasTensions ? t('session.shadowEmerging') : t('session.extendExploration')}
                </p>
                {hasTensions && tensionNames.length > 0 && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {t('session.dynamicsInTension')} : {tensionNames.join(', ')}
                  </p>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              {hasTensions
                ? t('session.shadowAccompanyFull')
                : t('session.accompanyFull')
              }
            </p>
            <a
              href="/contact"
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98] ${
                hasTensions
                  ? 'bg-gradient-to-r from-rose-500 to-rose-600 shadow-md shadow-rose-500/20'
                  : 'bg-gradient-to-r from-violet-500 to-rose-500 shadow-md'
              }`}>
              {t('session.requestAccompaniment')} →
            </a>
          </div>
        )
      })()}

      <button onClick={onRestart}
        className="w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
        {t('session.newSession')}
      </button>
      </div>

      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

// ── Wrapper pour transitions cinématiques entre étapes ─────────
function StepTransition({ step, children, className = '' }) {
  const [isVisible, setIsVisible] = useState(true)
  const prevStep = useRef(step)

  useEffect(() => {
    if (step !== prevStep.current) {
      setIsVisible(false)
      const t = setTimeout(() => {
        prevStep.current = step
        setIsVisible(true)
      }, 200)
      return () => clearTimeout(t)
    }
  }, [step])

  return (
    <div
      className={`transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
      }}
    >
      {children}
    </div>
  )
}

export default function SessionPage() {
  const locale = useStore((s) => s.locale)
  const pathname = usePathname()
  const urlSessionId = pathname?.match(/\/session\/([^/]+)/)?.[1] ?? null
  const { user } = useAuth()
  const [step, setStep]                 = useState('intro')      // intro | threshold | session | plan
  const [thresholdData, setThresholdData] = useState(null)
  const [finalState, setFinalState]     = useState(null)
  const [initialState, setInitialState]  = useState(null)
  const [resumeError, setResumeError]   = useState('')
  const [quotaExceededForSessions, setQuotaExceededForSessions] = useState(false)
  const [access, setAccess] = useState(null)
  const startTime                       = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    billingApi.getAccess()
      .then((data) => {
        setAccess(data)
        if (data?.free_access) return
        const used = data?.usage?.sessions_count ?? 0
        const limit = data?.limits?.sessions_per_month ?? 2
        if (used >= limit) setQuotaExceededForSessions(true)
      })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (urlSessionId && user?.id) {
      handleResume(urlSessionId)
    }
  }, [urlSessionId, user?.id])

  function handleStart() {
    startTime.current = Date.now()
    setInitialState(null)
    setResumeError('')
    setStep('threshold')
  }
  function handleThreshold(data) {
    setThresholdData(data)
    setInitialState(null)
    setStep('session')
  }
  function handleComplete(state) {
    setFinalState(state)
    setStep('plan')
  }
  async function handleResume(sessionId) {
    setResumeError('')
    try {
      const session = await sessionsApi.get(sessionId)
      setThresholdData({
        firstWords: session.first_words,
        door_suggested: session.door_suggested ?? 'love',
        door_reason: DOOR_MAP[session.door_suggested]?.subtitle ?? '',
        first_question: "Qu'est-ce qui est le plus vivant pour vous en ce moment ?",
        sessionId: session.id,
      })
      const locked = session.doors_locked || []
      const currentDoor = session.step_data?.currentDoor ?? FOUR_DOORS.find(d => !locked.includes(d.key))?.key ?? 'love'
      const drawnCards = (session.cards_drawn || []).map(item => {
        const name = typeof item === 'object' && item?.card_name ? item.card_name : item
        const found = findCardByName(name)
        if (!found) return null
        const door = (typeof item === 'object' && item?.door) ? item.door : found.door
        return { door, card: found.card }
      }).filter(Boolean)
      const anchors = (session.anchors || []).map(a =>
        typeof a === 'object' ? a : { door: 'love', subtitle: 'Porte', synthesis: String(a), habit: '' }
      )
      const stepData = session.step_data || {}
      const histLen = (session.history || []).length
      // Sur la 1ère porte : t = échanges totaux. Sur les portes suivantes : step_data.doorTurn ou 0
      const t = locked.length === 0 ? Math.floor(histLen / 2) : (stepData.doorTurn ?? 0)
      const hasCardForDoor = drawnCards.some(d => d.door === currentDoor)
      setInitialState({
        petals: session.petals || EMPTY_PETALS,
        petalsDeficit: stepData.petalsDeficit || {},
        petalsHistory: stepData.petalsHistory || [],
        history: session.history || [],
        currentDoor,
        drawnCards,
        lockedDoors: locked,
        anchors,
        turn: session.turn_count || 0,
        doorTurn: stepData.doorTurn ?? t,
        doorTurnAtCardDraw: stepData.doorTurnAtCardDraw ?? (hasCardForDoor ? Math.max(0, t - 3) : null),
        shadowEvents: stepData.shadowEvents || [],
        maxShadowLevel: stepData.maxShadowLevel ?? 0,
      })
      setFinalState(null)
      setStep('session')
    } catch (e) {
      setResumeError(e.detail ?? e.message ?? t('session.loadError'))
    }
  }
  function handleRestart() {
    setStep('intro')
    setThresholdData(null)
    setFinalState(null)
    setInitialState(null)
    setResumeError('')
    startTime.current = null
  }

  return (
    <div className={`max-w-4xl mx-auto space-y-2 flex flex-col min-h-[70vh] ${step === 'session' ? 'h-full' : 'py-4 px-1'}`}>
      {/* Breadcrumbs + Retour contextuel en session */}
      <div className="flex flex-col gap-1 shrink-0">
        <Breadcrumbs extra={step === 'plan' ? [t('session.plan14days')] : step === 'session' ? [t('session.sessionInProgress')] : []} />
        {step === 'session' && urlSessionId && (
          <Link
            href="/session"
            className="text-sm text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-1 w-fit"
          >
            ← Retour à Explorer ma Fleur
          </Link>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
      <StepTransition step={step} className="flex-1 min-h-[55vh] flex flex-col">
        {step === 'intro'     && (
          <IntroStep
            onStart={handleStart}
            onResume={handleResume}
            userEmail={user?.email}
            resumeError={resumeError}
            quotaExceeded={quotaExceededForSessions}
            access={access}
          />
        )}
        {step === 'threshold' && (
          <ThresholdStep
            onThresholdComplete={handleThreshold}
            userEmail={user?.email}
            quotaExceeded={quotaExceededForSessions}
          />
        )}
        {step === 'session'   && (
          <SessionStep
            thresholdData={thresholdData}
            initialState={initialState}
            onComplete={handleComplete}
            onBeforeDrawCard={user ? () => sapApi.deduct('draw_card') : null}
          />
        )}
        {step === 'plan' && finalState && (
          <PlanStep
          petals={finalState.petals}
          petalsDeficit={finalState.petalsDeficit}
          petalsHistory={finalState.petalsHistory}
          cardsDrawn={finalState.cardsDrawn}
          drawnCardsWithDetails={finalState.drawnCardsWithDetails}
          history={finalState.history}
          anchors={finalState.anchors}
          onRestart={handleRestart}
          maxShadowLevel={finalState.maxShadowLevel ?? 0}
          sessionMeta={{
            email: user?.email || '',
            sessionId: finalState?.sessionId ?? thresholdData?.sessionId,
            startTime: startTime.current,
            firstWords: thresholdData?.firstWords || '',
            doorSuggested: thresholdData?.door_suggested || null,
            lockedDoors: finalState.lockedDoors || [],
            turnCount: finalState.turnCount || 0,
          }}
        />
      )}
      </StepTransition>
    </div>
  )
}
