'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { sessionsApi } from '@/api/sessions'
import { aiApi } from '@/api/ai'
import { useDebounce } from '@/hooks/useDebounce'
import { FlowerSVG, scoresToPetals } from '@/components/FlowerSVG'

const PETAL_LABELS: Record<string, string> = {
  agape: 'Agapè',
  philautia: 'Philautia',
  mania: 'Mania',
  storge: 'Storgè',
  pragma: 'Pragma',
  philia: 'Philia',
  ludus: 'Ludus',
  eros: 'Éros',
}
const PETAL_KEYS = [
  'agape',
  'philautia',
  'mania',
  'storge',
  'pragma',
  'philia',
  'ludus',
  'eros',
]

const DOOR_LABELS: Record<string, string> = {
  love: 'Cœur',
  vegetal: 'Végétal',
  elements: 'Éléments',
  life: 'Histoire',
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDuration(s?: number): string {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  return m > 0 ? `${m} min` : `${s} s`
}

function shadowPalette(level: number): {
  border: string
  bg: string
  text: string
  icon: string
  label: string
} | null {
  if (level >= 4)
    return {
      border: 'border-red-700/60',
      bg: 'bg-red-950/30',
      text: 'text-red-300',
      icon: '🔴',
      label: 'Détresse',
    }
  if (level >= 3)
    return {
      border: 'border-rose-700/50',
      bg: 'bg-rose-950/20',
      text: 'text-rose-300',
      icon: '🌑',
      label: 'Forte',
    }
  if (level >= 2)
    return {
      border: 'border-orange-700/40',
      bg: 'bg-orange-950/20',
      text: 'text-orange-300',
      icon: '🌘',
      label: 'Tension',
    }
  if (level >= 1)
    return {
      border: 'border-amber-700/30',
      bg: 'bg-amber-950/10',
      text: 'text-amber-300',
      icon: '🌗',
      label: 'Légère',
    }
  return null
}

function MiniFlower({
  petals,
  deficit,
}: {
  petals?: Record<string, number>
  deficit?: Record<string, number>
}) {
  const hasPetals = petals && Object.values(petals).some((v) => v > 0)
  if (!hasPetals)
    return (
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg">
        🌸
      </div>
    )
  return (
    <FlowerSVG
      petals={petals}
      petalsDeficit={deficit ?? {}}
      size={48}
    />
  )
}

function PetalRow({
  label,
  value,
  deficit,
  maxVal = 0.3,
}: {
  label: string
  value: number
  deficit: number
  maxVal?: number
}) {
  const pct = Math.min((value / maxVal) * 100, 100)
  const defPct = Math.min((deficit / maxVal) * 100, 100)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-slate-400 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-400 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {deficit > 0.005 && (
        <div className="w-10 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full"
            style={{ width: `${defPct}%` }}
          />
        </div>
      )}
      <span className="w-8 font-mono text-slate-400 text-right">
        {value.toFixed(2)}
      </span>
    </div>
  )
}

type SuiviDetailData = {
  session_count: number
  max_shadow_level: number
  shadow_event_count: number
  avg_petals: Record<string, number>
  avg_deficit: Record<string, number>
  petal_evolution: Array<{
    date: string
    petals: Record<string, number>
    deficit: Record<string, number>
  }>
  shadow_events: Array<{
    level?: number
    turn?: number
    urgent?: boolean
    door?: string
    resource_card?: string
    session_date?: string
    kind?: string
    top_deficit_petal?: string
    deficit_value?: number
  }>
  sessions: Array<{
    id: string
    created_at?: string
    door_suggested?: string
    status?: string
    first_words?: string
    turn_count?: number
    duration_seconds?: number
    max_shadow_level?: number
    shadow_event_count?: number
    petals?: Record<string, number>
    petals_deficit?: Record<string, number>
    threshold_snapshot?: Record<string, unknown> | null
    coach_summary?: string
    coach_analysis?: string
    coach_suggestions?: string[]
    coach_next_steps?: string[]
  }>
  coach_patient_snapshot?: {
    coach_summary?: string
    coach_analysis?: string
    coach_suggestions?: string[]
    coach_conversation_prompts?: string[]
    coach_next_steps?: string[]
    cached_at?: string
    provider?: string
  } | null
}

function UserDetailPanel({
  email,
  onClose,
}: {
  email: string
  onClose: () => void
}) {
  const [data, setData] = useState<SuiviDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('fleur')
  const [patientFicheLoading, setPatientFicheLoading] = useState(false)
  const [patientFicheError, setPatientFicheError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    sessionsApi
      .suiviDetail(email)
      .then(setData as (d: unknown) => void)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [email])

  const maxPetal = data
    ? Math.max(...Object.values(data.avg_petals), 0)
    : 0.3
  const maxDef = data ? Math.max(...Object.values(data.avg_deficit), 0) : 0.3
  const scale = Math.max(maxPetal, 0.05)
  const sp = data ? shadowPalette(data.max_shadow_level) : null
  const patientSnapshot = data?.coach_patient_snapshot ?? null

  async function handleGeneratePatientFiche(force = false) {
    if (!email) return
    if (patientFicheLoading) return
    setPatientFicheError(null)
    setPatientFicheLoading(true)
    try {
      await aiApi.coachPatientFiche({ patientEmail: email, force })
      const refreshed = await sessionsApi.suiviDetail(email)
      setData(refreshed as any)
      setTab('patient')
    } catch (e: unknown) {
      // best-effort UI
      const errAny = e as any
      setPatientFicheError(errAny?.detail ?? errAny?.message ?? "Erreur lors de la génération.")
    } finally {
      setPatientFicheLoading(false)
    }
  }
  const coachPatientFicheReady = data?.coach_patient_snapshot ? true : false

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-start justify-center pt-6 px-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto mb-6 border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-700 px-6 py-4 z-10 rounded-t-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 break-all">
                {email}
              </h2>
              {data && (
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <span className="text-xs text-slate-400">
                    {data.session_count} session
                    {data.session_count > 1 ? 's' : ''}
                  </span>
                  {sp && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sp.bg} ${sp.text} ${sp.border}`}
                    >
                      {sp.icon} Ombre niv. {data.max_shadow_level} — {sp.label}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              href={`/admin/chat?email=${encodeURIComponent(email)}`}
              onClick={onClose}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors"
            >
              💬 Ouvrir le chat
            </Link>
            <Link
              href={`/admin/messages?search=${encodeURIComponent(email)}`}
              onClick={onClose}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              ✉️ Messages contact
            </Link>
          </div>

          <div className="flex gap-1 mt-3">
            {[
              { id: 'fleur', label: '🌸 Fleur' },
              {
                id: 'ombres',
                label: `🌑 Ombres${data ? ` (${data.shadow_event_count})` : ''}`,
              },
              {
                id: 'sessions',
                label: `📋 Sessions${data ? ` (${data.session_count})` : ''}`,
              },
              { id: 'patient', label: '🧾 Fiche patient' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t.id
                    ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : !data ? (
            <p className="text-sm text-slate-400 italic text-center py-8">
              Impossible de charger les données.
            </p>
          ) : tab === 'fleur' ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <FlowerSVG
                    petals={scoresToPetals(data.avg_petals)}
                    petalsDeficit={scoresToPetals(data.avg_deficit)}
                    size={220}
                    animate
                    showLabels
                  />
                  <div className="flex items-center gap-4 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Lumière
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Ombre/Déficit
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    Moyenne sur {data.session_count} session
                    {data.session_count > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-4 mb-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Parts de lumière
                    </p>
                    <p className="text-[10px] text-amber-400 uppercase tracking-widest">
                      Déficits
                    </p>
                  </div>
                  {PETAL_KEYS.map((k) => (
                    <PetalRow
                      key={k}
                      label={PETAL_LABELS[k]}
                      value={data.avg_petals[k] ?? 0}
                      deficit={data.avg_deficit[k] ?? 0}
                      maxVal={scale}
                    />
                  ))}
                </div>
              </div>

              {data.petal_evolution.length > 1 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                    Évolution session par session
                  </p>
                  <div className="overflow-x-auto">
                    <div
                      className="flex gap-3 pb-2"
                      style={{
                        minWidth: `${data.petal_evolution.length * 80}px`,
                      }}
                    >
                      {data.petal_evolution.map((ev, i) => {
                        const topPetal = PETAL_KEYS.reduce(
                          (best, k) =>
                            (ev.petals[k] ?? 0) > (ev.petals[best] ?? 0)
                              ? k
                              : best,
                          'agape'
                        )
                        const topDeficit = PETAL_KEYS.reduce(
                          (best, k) =>
                            (ev.deficit[k] ?? 0) > (ev.deficit[best] ?? 0)
                              ? k
                              : best,
                          'agape'
                        )
                        const hasDeficit = PETAL_KEYS.some(
                          (k) => (ev.deficit[k] ?? 0) > 0.01
                        )
                        return (
                          <div
                            key={i}
                            className="flex flex-col items-center gap-1 shrink-0 w-16"
                          >
                            <FlowerSVG
                              petals={ev.petals}
                              petalsDeficit={ev.deficit}
                              size={56}
                            />
                            <p className="text-[9px] text-slate-400 text-center leading-tight">
                              {formatDate(ev.date)}
                            </p>
                            <p className="text-[9px] text-emerald-500 font-medium">
                              {PETAL_LABELS[topPetal]?.slice(0, 5)}
                            </p>
                            {hasDeficit && (
                              <p className="text-[9px] text-amber-400">
                                {PETAL_LABELS[topDeficit]?.slice(0, 5)}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'ombres' ? (
            <div className="space-y-4">
              {sp ? (
                <div
                  className={`rounded-xl border p-4 flex items-center gap-4 ${sp.bg} ${sp.border}`}
                >
                  <span className="text-3xl">{sp.icon}</span>
                  <div>
                    <p className={`font-bold ${sp.text}`}>
                      Niveau maximum détecté : {data.max_shadow_level}/4 —{' '}
                      {sp.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {data.shadow_event_count} signal
                      {data.shadow_event_count > 1 ? 'x' : ''} (Tuteur et/ou déficit
                      pétales) sur {data.session_count} session
                      {data.session_count > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10 p-4 flex items-center gap-3">
                  <span className="text-2xl">✨</span>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                    Aucune ombre détectée lors des sessions.
                  </p>
                </div>
              )}

              {data.shadow_events.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Chronologie complète
                  </p>
                  {data.shadow_events.map((ev, i) => {
                    const p = shadowPalette(ev.level ?? 0)
                    const isDeficit = ev.kind === 'petal_deficit'
                    return (
                      <div
                        key={i}
                        className={`rounded-xl border p-3 ${p?.bg || 'bg-slate-50 dark:bg-slate-800'} ${p?.border || 'border-slate-200 dark:border-slate-700'}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm">{p?.icon || '○'}</span>
                          <span
                            className={`font-semibold text-xs ${p?.text || 'text-slate-500'}`}
                          >
                            {isDeficit ? (
                              <>
                                Déficit pétales (ombre sur la fleur)
                                {ev.top_deficit_petal ? (
                                  <>
                                    {' '}
                                    — {PETAL_LABELS[ev.top_deficit_petal] ?? ev.top_deficit_petal}
                                    {typeof ev.deficit_value === 'number'
                                      ? ` (${Math.round(ev.deficit_value * 100)}%)`
                                      : ''}
                                  </>
                                ) : null}
                              </>
                            ) : (
                              <>
                                Niv. {ev.level ?? 0}
                                {ev.turn != null ? ` — Tour ${ev.turn}` : ''}
                              </>
                            )}
                          </span>
                          {ev.urgent && (
                            <span className="text-[10px] font-bold bg-red-700/30 text-red-300 px-1.5 py-0.5 rounded">
                              URGENT
                            </span>
                          )}
                          {ev.door && (
                            <span className="text-[10px] text-slate-400 uppercase">
                              {DOOR_LABELS[ev.door] || ev.door}
                            </span>
                          )}
                          <span className="ml-auto text-[10px] text-slate-400">
                            {formatDate(ev.session_date)}
                          </span>
                        </div>
                        {ev.resource_card && (
                          <p
                            className={`text-xs mt-1.5 ${p?.text || 'text-slate-400'}`}
                          >
                            Ressource suggérée :{' '}
                            <span className="font-semibold">
                              {ev.resource_card}
                            </span>
                          </p>
                        )}
                        {isDeficit && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                            Pas d&apos;événement Tuteur enregistré pour cette session ; la part
                            d&apos;ombre vient des déficits de pétales sauvegardés dans la session.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  Aucun événement d&apos;ombre enregistré.
                </p>
              )}

              {data.shadow_event_count > 0 && (
                <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10 p-4">
                  <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-1.5">
                    Note accompagnateur
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Ces zones d&apos;ombre indiquent des tensions ou vulnérabilités
                    exprimées en session. Un contact personnalisé peut être précieux
                    pour proposer un accompagnement adapté à ces dynamiques
                    spécifiques.
                  </p>
                </div>
              )}
            </div>
          ) : tab === 'patient' ? (
            <div className="space-y-4">
              {!patientSnapshot ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4">
                  <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                    Fiche patient non générée
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Génère un résumé, une analyse et des pistes d’accompagnement à destination du coach, basé sur l’historique du patient.
                  </p>
                  <div className="mt-3 flex gap-3 items-center flex-wrap">
                    <button
                      onClick={() => handleGeneratePatientFiche(false)}
                      disabled={patientFicheLoading}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-md hover:opacity-90 disabled:opacity-50"
                    >
                      {patientFicheLoading ? 'Génération…' : 'Générer la fiche patient'}
                    </button>
                  </div>
                  {patientFicheError && (
                    <p className="mt-2 text-xs text-red-400">
                      {patientFicheError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10 p-4">
                    <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-2">
                      Résumé
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                      {patientSnapshot.coach_summary ?? ''}
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10 p-4">
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2">
                      Analyse (pour le coach)
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                      {patientSnapshot.coach_analysis ?? ''}
                    </p>
                  </div>

                  {Array.isArray(patientSnapshot.coach_suggestions) && patientSnapshot.coach_suggestions.length > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                        Suggestions d’accompagnement
                      </p>
                      <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 list-disc pl-5">
                        {patientSnapshot.coach_suggestions.slice(0, 8).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(patientSnapshot.coach_conversation_prompts) && patientSnapshot.coach_conversation_prompts.length > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                        Questions à poser (coach → patient)
                      </p>
                      <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 list-disc pl-5">
                        {patientSnapshot.coach_conversation_prompts.slice(0, 8).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(patientSnapshot.coach_next_steps) && patientSnapshot.coach_next_steps.length > 0 && (
                    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10 p-4">
                      <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-2">
                        Prochaines relances (coach)
                      </p>
                      <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 list-disc pl-5">
                        {patientSnapshot.coach_next_steps.slice(0, 6).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-3 items-center flex-wrap">
                    <button
                      onClick={() => handleGeneratePatientFiche(true)}
                      disabled={patientFicheLoading}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                    >
                      {patientFicheLoading ? 'Régénération…' : 'Régénérer'}
                    </button>
                    {patientSnapshot.cached_at && (
                      <p className="text-xs text-slate-400">
                        Enregistré le {formatDate(String(patientSnapshot.cached_at))}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {data.session_count} session
                {data.session_count > 1 ? 's' : ''}
              </p>
              <p className="text-[10px] text-slate-500">
                Fiche patient générée : {coachPatientFicheReady ? 'Oui' : 'Non'}
              </p>
              {data.sessions.map((s) => {
                const sp2 = shadowPalette(s.max_shadow_level ?? 0)
                return (
                  <div
                    key={s.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      (s.max_shadow_level ?? 0) >= 1
                        ? `${sp2?.bg} ${sp2?.border}`
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <MiniFlower petals={s.petals} deficit={s.petals_deficit} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {formatDate(s.created_at)}
                          </span>
                          {s.door_suggested && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300">
                              {DOOR_LABELS[s.door_suggested] || s.door_suggested}
                            </span>
                          )}
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              s.status === 'completed'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {s.status === 'completed' ? 'Terminée' : 'En cours'}
                          </span>
                          {sp2 && (
                            <span className={`text-[10px] font-bold ${sp2.text}`}>
                              {sp2.icon} Niv. {s.max_shadow_level}
                            </span>
                          )}
                        </div>
                        {s.first_words && (
                          <p className="text-xs text-slate-400 italic mt-1 truncate">
                            &quot;{s.first_words}&quot;
                          </p>
                        )}
                        {s.threshold_snapshot &&
                          typeof s.threshold_snapshot.door_reason === 'string' &&
                          s.threshold_snapshot.door_reason.trim() && (
                            <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-1.5 leading-snug line-clamp-3">
                              <span className="font-semibold text-slate-500 dark:text-slate-400">
                                Seuil IA :{' '}
                              </span>
                              {s.threshold_snapshot.door_reason}
                            </p>
                          )}
                        {s.threshold_snapshot &&
                          typeof s.threshold_snapshot.first_question === 'string' &&
                          s.threshold_snapshot.first_question.trim() && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic line-clamp-2">
                              Q. {s.threshold_snapshot.first_question}
                            </p>
                          )}
                        {/* La fiche coach principale est la "Fiche patient" (onglet patient), générée par patient. */}
                        <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                          <span>{s.turn_count} tours</span>
                          <span>{formatDuration(s.duration_seconds)}</span>
                          {(s.shadow_event_count ?? 0) > 0 && (
                            <span className="text-amber-400">
                              {s.shadow_event_count} détection
                              {(s.shadow_event_count ?? 0) > 1 ? 's' : ''}{' '}
                              d&apos;ombre
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type SuiviUser = {
  email: string
  session_count: number
  avg_turns?: number
  last_session?: string
  max_shadow_level?: number
  shadow_urgent?: boolean
  shadow_event_count?: number
  avg_petals: Record<string, number>
  avg_deficit?: Record<string, number>
}

const DEFICIT_OMBRE_MIN = 0.02

function userHasDeficitShadow(u: SuiviUser): boolean {
  if (!u.avg_deficit) return false
  return PETAL_KEYS.some((k) => (u.avg_deficit?.[k] ?? 0) >= DEFICIT_OMBRE_MIN)
}

function UserCard({
  user,
  onClick,
}: {
  user: SuiviUser
  onClick: () => void
}) {
  const sp = shadowPalette(user.max_shadow_level ?? 0)
  const hasTuteurShadow = (user.max_shadow_level ?? 0) >= 1 || (user.shadow_event_count ?? 0) > 0
  const hasDeficit = userHasDeficitShadow(user)
  const hasShadow = hasTuteurShadow || hasDeficit

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-md ${
        user.shadow_urgent
          ? 'border-red-700/50 bg-red-950/10 hover:bg-red-950/20'
          : hasShadow
            ? hasTuteurShadow && sp
              ? `${sp.border} ${sp.bg} hover:brightness-110`
              : 'border-amber-700/35 bg-amber-950/15 hover:bg-amber-950/25 dark:border-amber-600/40'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-violet-300 dark:hover:border-violet-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <MiniFlower petals={user.avg_petals} deficit={user.avg_deficit ?? {}} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
              {user.email}
            </span>
            {hasTuteurShadow && sp && (
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sp.bg} ${sp.text} ${sp.border}`}
              >
                {sp.icon} Niv. {user.max_shadow_level}
              </span>
            )}
            {hasDeficit && !hasTuteurShadow && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-600/40 bg-amber-950/20 text-amber-300">
                🌗 Déficit pétales
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-slate-400">
            <span>
              {user.session_count} session
              {user.session_count > 1 ? 's' : ''}
            </span>
            <span>Moy. {user.avg_turns} tours</span>
            <span>Dernière : {formatDate(user.last_session)}</span>
            {(user.shadow_event_count ?? 0) > 0 && (
              <span className={sp?.text || 'text-amber-400'}>
                {user.shadow_event_count} événement
                {(user.shadow_event_count ?? 0) > 1 ? 's' : ''} d&apos;ombre
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right hidden sm:block">
          {(() => {
            const topK = Object.entries(user.avg_petals).sort(
              (a, b) => b[1] - a[1]
            )[0]
            if (!topK || topK[1] < 0.001) return null
            return (
              <div>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest">
                  Dominant
                </p>
                <p className="text-xs font-semibold text-emerald-500">
                  {PETAL_LABELS[topK[0]]}
                </p>
              </div>
            )
          })()}
        </div>
        <span className="text-slate-300 dark:text-slate-600 shrink-0">→</span>
      </div>
    </button>
  )
}

function GlobalStats({ users }: { users: SuiviUser[] }) {
  if (!users.length) return null

  const total = users.length
  const withShadow = users.filter(
    (u) =>
      (u.max_shadow_level ?? 0) >= 1 ||
      (u.shadow_event_count ?? 0) > 0 ||
      userHasDeficitShadow(u)
  ).length
  const urgent = users.filter((u) => u.shadow_urgent).length
  const totalSessions = users.reduce((s, u) => s + u.session_count, 0)

  const globalPetals: Record<string, number> = Object.fromEntries(
    PETAL_KEYS.map((k) => [k, 0])
  )
  users.forEach((u) =>
    PETAL_KEYS.forEach((k) => {
      globalPetals[k] += u.avg_petals[k] ?? 0
    })
  )
  PETAL_KEYS.forEach((k) => {
    globalPetals[k] = globalPetals[k] / total
  })
  const topPetal = PETAL_KEYS.reduce(
    (best, k) => (globalPetals[k] > globalPetals[best] ? k : best),
    'agape'
  )

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
        Vue d&apos;ensemble — {total} utilisateur
        {total > 1 ? 's' : ''} suivis
      </p>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <FlowerSVG petals={scoresToPetals(globalPetals)} size={180} animate showLabels />
          <p className="text-[10px] text-slate-400 text-center">
            Fleur moyenne globale
          </p>
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {totalSessions}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Sessions totales</p>
          </div>
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {PETAL_LABELS[topPetal]}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Dynamique dominante
            </p>
          </div>
          <div
            className={`rounded-xl border p-3 text-center ${
              withShadow > 0
                ? 'border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/10'
                : 'border-slate-100 dark:border-slate-800'
            }`}
          >
            <p
              className={`text-2xl font-bold ${
                withShadow > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {withShadow}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Avec ombre détectée
            </p>
          </div>
          <div
            className={`rounded-xl border p-3 text-center ${
              urgent > 0
                ? 'border-red-700/50 bg-red-950/20'
                : 'border-slate-100 dark:border-slate-800'
            }`}
          >
            {urgent > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block mr-1" />
            )}
            <p
              className={`text-2xl font-bold inline ${
                urgent > 0 ? 'text-red-300' : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {urgent}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Urgents (niv. 4)
            </p>
          </div>
        </div>

        <div className="w-full lg:w-52 space-y-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Équilibre global
          </p>
          {PETAL_KEYS.map((k) => (
            <div key={k} className="flex items-center gap-2 text-[11px]">
              <span className="w-14 text-slate-400 shrink-0 truncate">
                {PETAL_LABELS[k]}
              </span>
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-400 to-rose-400 rounded-full"
                  style={{
                    width: `${Math.min(globalPetals[k] * 333, 100)}%`,
                  }}
                />
              </div>
              <span className="font-mono text-slate-400 text-[10px] w-8 text-right">
                {globalPetals[k].toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CoachSuiviPage() {
  const [users, setUsers] = useState<SuiviUser[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [shadowOnly, setShadowOnly] = useState(false)
  const [sort, setSort] = useState('last_session')
  const [selected, setSelected] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const debouncedSearch = useDebounce(searchInput, 300)

  const load = useCallback(() => {
    setLoading(true)
    sessionsApi
      .suivi({ search: debouncedSearch || undefined, shadow: shadowOnly, sort })
      .then((r) => setUsers((r as { users?: SuiviUser[] }).users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [debouncedSearch, shadowOnly, sort])

  useEffect(() => {
    load()
  }, [load])

  const urgentCount = users?.filter((u) => u.shadow_urgent).length ?? 0

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div
        className="max-w-5xl mx-auto px-4 py-8 space-y-6"
        style={{ animation: 'fadeIn 0.4s ease' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-500 via-rose-500 to-violet-500 bg-clip-text text-transparent">
              Suivi des utilisateurs
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Indicateurs de la Fleur d&apos;AmOurs · Parts de lumière et
              d&apos;ombre
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200"
                title="Périmètre des utilisateurs affichés"
              >
                🧑‍🌾 Patientèle du coach
              </span>
              <span className="text-[10px] text-slate-400">
                (Pour la vue globale :{' '}
                <Link href="/coach/analytics" className="underline">
                  Vue globale
                </Link>
                )
              </span>
            </div>
          </div>
          {urgentCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/30 border border-red-700/60">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold text-red-300">
                {urgentCount} situation
                {urgentCount > 1 ? 's' : ''} urgente
                {urgentCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <input
              ref={searchRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher par email…"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            />
          </div>
          <button
            type="button"
            onClick={() => setShadowOnly((v) => !v)}
            title="Filtre : utilisateurs avec détections Tuteur (niveau d’ombre) ou déficit notable sur au moins un pétale (part d’ombre sur la fleur)."
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 ${
              shadowOnly
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
            }`}
          >
            🌑 Ombres uniquement
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
          >
            <option value="last_session">Trier : Activité récente</option>
            <option value="shadow">Trier : Niveau d&apos;ombre</option>
            <option value="sessions">Trier : Nb de sessions</option>
          </select>
          {users !== null && (
            <span className="text-xs text-slate-400 py-2.5">
              {users.length} utilisateur
              {users.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!debouncedSearch && users && users.length > 1 && (
          <GlobalStats users={users} />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="w-10 h-10 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : users && users.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-sm">
              Aucun utilisateur trouvé avec ces critères.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {users?.map((user) => (
              <UserCard
                key={user.email}
                user={user}
                onClick={() => setSelected(user.email)}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <UserDetailPanel email={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
