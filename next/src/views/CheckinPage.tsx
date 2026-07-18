'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  checkinsApi,
  type CheckinContextDTO,
  type CheckinDTO,
  type CheckinEchoDTO,
} from '@/api/checkins'
import { aiApi } from '@/api/ai'
import { FlowerSVG, PETAL_DEFS } from '@/components/FlowerSVG'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type Act = 'pose' | 'receive' | 'anchor' | 'done'

const FELT_OPTIONS = [
  { value: 1, key: 'feltHeavy' as const, emoji: '🌫' },
  { value: 2, key: 'feltMixed' as const, emoji: '🌤' },
  { value: 3, key: 'feltBright' as const, emoji: '☀️' },
]

function formatDate(s: string, locale: string) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString(locale || 'fr', { day: 'numeric', month: 'short' })
}

function petalName(id: string | null | undefined): string {
  if (!id) return ''
  const def = PETAL_DEFS.find((p) => p.id === id)
  return def?.name ?? id
}

function petalColor(id: string | null | undefined): string {
  if (!id) return '#a78bfa'
  return PETAL_DEFS.find((p) => p.id === id)?.color ?? '#a78bfa'
}

function buildDisplayPetals(
  profile: Record<string, number>,
  highlightId: string | null
): Record<string, number> {
  const base: Record<string, number> = {}
  for (const p of PETAL_DEFS) {
    base[p.id] = Math.max(0.12, Number(profile[p.id] ?? 0))
  }
  if (highlightId) {
    base[highlightId] = Math.max(base[highlightId] ?? 0, 0.88)
  }
  return base
}

function suggestionBadge(kind: CheckinContextDTO['suggestions'][0]['kind']): string | null {
  const key = `checkin.suggestionKind.${kind}` as const
  const s = t(key)
  return s !== key ? s : null
}

export default function CheckinPage() {
  const locale = useStore((s) => s.locale) || 'fr'
  const [act, setAct] = useState<Act>('pose')
  const [intention, setIntention] = useState('')
  const [echo, setEcho] = useState<CheckinEchoDTO | null>(null)
  const [feltAfter, setFeltAfter] = useState<number | null>(null)
  const [loadingEcho, setLoadingEcho] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<CheckinDTO[]>([])
  const [context, setContext] = useState<CheckinContextDTO | null>(null)

  const load = useCallback(() => {
    checkinsApi
      .my()
      .then((r) => {
        setHistory(r.checkins || [])
        setContext(r.context ?? null)
      })
      .catch(() => {
        setHistory([])
        setContext(null)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const displayPetals = useMemo(
    () => buildDisplayPetals(context?.petals ?? {}, echo?.highlight_petal ?? null),
    [context?.petals, echo?.highlight_petal]
  )

  const highlightId = echo?.highlight_petal ?? context?.todayEcho?.highlightPetal ?? null
  const checkedInToday = context?.checkedInToday ?? false

  async function listenToFlower() {
    const trimmed = intention.trim()
    if (!trimmed || loadingEcho || checkedInToday) return
    setError('')
    setLoadingEcho(true)
    setAct('receive')
    try {
      const res = await aiApi.checkinEcho({ intention: trimmed, locale })
      setEcho(res)
      setAct('anchor')
    } catch (e) {
      const err = e as { message?: string; detail?: string; code?: string }
      const msg =
        err?.code === 'CHECKIN_DAILY_LIMIT'
          ? t('checkin.limitError')
          : err?.detail || err?.message || t('checkin.echoError')
      setError(msg)
      setAct('pose')
    } finally {
      setLoadingEcho(false)
    }
  }

  async function plantEcho() {
    if (!echo || saving || checkedInToday) return
    setSaving(true)
    setError('')
    try {
      await checkinsApi.save({
        intention: intention.trim(),
        highlightPetal: echo.highlight_petal,
        aiResponse: echo,
        feltAfter: feltAfter ?? undefined,
      })
      setAct('done')
      setIntention('')
      setFeltAfter(null)
      load()
      setTimeout(() => {
        setAct('pose')
        setEcho(null)
      }, 3200)
    } catch (e) {
      const err = e as { message?: string; detail?: string; code?: string }
      const msg =
        err?.code === 'CHECKIN_DAILY_LIMIT'
          ? t('checkin.limitError')
          : err?.detail || err?.message || t('checkin.saveError')
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  function applySuggestion(text: string) {
    setIntention(text)
  }

  function resetFlow() {
    setAct('pose')
    setEcho(null)
    setIntention('')
    setFeltAfter(null)
    setError('')
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-slate-950 via-[#0f0a1a] to-slate-950">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-10 pb-28">
        <header className="mb-8 text-center space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-violet-200/90">
            {t('checkin.eyebrow')}
          </p>
          <h1 className="text-2xl sm:text-3xl font-light tracking-wide text-white/95">{t('checkin.title')}</h1>
          <p className="text-base text-white/80 max-w-md mx-auto leading-relaxed">{t('checkin.subtitle')}</p>
        </header>

        {checkedInToday ? (
          <section className="space-y-6">
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-950/20 px-4 py-4 text-center">
              <p className="text-sm text-emerald-100/95">{t('checkin.alreadyToday')}</p>
              <p className="mt-1 text-xs text-emerald-100/85">{t('checkin.comeBackTomorrow')}</p>
            </div>

            {context?.todayEcho ? (
              <>
                <div className="relative flex flex-col items-center">
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(100%,280px)] aspect-square rounded-full bg-gradient-to-tr from-violet-600/40 via-teal-500/20 to-fuchsia-600/30 blur-3xl opacity-90"
                    aria-hidden
                  />
                  <FlowerSVG
                    petals={buildDisplayPetals(context.petals ?? {}, context.todayEcho.highlightPetal)}
                    size={280}
                    animate
                    showLabels
                    labelsOnHoverOnly
                    pinnedLabelIds={
                      context.todayEcho.highlightPetal ? [context.todayEcho.highlightPetal] : []
                    }
                    pulsePetalId={context.todayEcho.highlightPetal}
                    visualPreset="zen"
                    labelTheme="dark"
                    svgClassName="relative z-[1]"
                  />
                </div>

                <div className="rounded-3xl border border-white/12 bg-white/[0.05] px-5 py-6 space-y-4">
                  <p className="text-xs uppercase tracking-wider text-violet-200/85 text-center">
                    {t('checkin.todayEchoLabel')}
                  </p>
                  {context.todayEcho.highlightPetal ? (
                    <div className="flex justify-center">
                      <span
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-wide"
                        style={{
                          color: petalColor(context.todayEcho.highlightPetal),
                          backgroundColor: `${petalColor(context.todayEcho.highlightPetal)}18`,
                          border: `1px solid ${petalColor(context.todayEcho.highlightPetal)}40`,
                        }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: petalColor(context.todayEcho.highlightPetal) }}
                        />
                        {petalName(context.todayEcho.highlightPetal)}
                      </span>
                    </div>
                  ) : null}
                  {context.todayEcho.intention ? (
                    <p className="text-xs text-white/75 text-center italic">
                      « {context.todayEcho.intention} »
                    </p>
                  ) : null}
                  <p className="text-base sm:text-lg font-light italic text-violet-50/95 leading-relaxed text-center">
                    {context.todayEcho.echo || context.todayEcho.whisper}
                  </p>
                  {context.todayEcho.invitation ? (
                    <div className="border-t border-white/8 pt-4">
                      <p className="text-xs uppercase tracking-wider text-white/70 text-center mb-2">
                        {t('checkin.invitationLabel')}
                      </p>
                      <p className="text-sm text-white/80 text-center leading-relaxed">
                        {context.todayEcho.invitation}
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {!checkedInToday && context?.lastEcho && act === 'pose' ? (
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
            <p className="text-xs uppercase tracking-wider text-violet-200/85">{t('checkin.lastEchoLabel')}</p>
            {context.lastEcho.highlightPetal ? (
              <span
                className="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider"
                style={{
                  color: petalColor(context.lastEcho.highlightPetal),
                  backgroundColor: `${petalColor(context.lastEcho.highlightPetal)}22`,
                  border: `1px solid ${petalColor(context.lastEcho.highlightPetal)}44`,
                }}
              >
                {petalName(context.lastEcho.highlightPetal)}
              </span>
            ) : null}
            <p className="mt-2 text-sm italic text-violet-100/90 leading-relaxed">
              {context.lastEcho.echo || context.lastEcho.whisper}
            </p>
            <p className="mt-1 text-xs text-white/70">
              {formatDate(context.lastEcho.createdAt, locale)}
            </p>
          </div>
        ) : null}

        {/* Acte 1 — Poser */}
        {!checkedInToday && act === 'pose' ? (
          <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 backdrop-blur-sm">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/85">{t('checkin.intentionLabel')}</label>
              <textarea
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder={t('checkin.intentionPlaceholder')}
                className="w-full rounded-2xl border border-white/12 bg-black/25 p-4 text-sm text-white/90 placeholder:text-white/55 focus:border-violet-400/50 focus:outline-none focus:ring-1 focus:ring-violet-400/30 resize-none"
              />
            </div>

            {context?.suggestions?.length ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-white/70">{t('checkin.suggestionsLabel')}</p>
                <div className="flex flex-col gap-2">
                  {context.suggestions.map((s, i) => {
                    const badge = suggestionBadge(s.kind)
                    return (
                    <button
                      key={`${s.kind}-${i}`}
                      type="button"
                      onClick={() => applySuggestion(s.text)}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-xs text-white/70 hover:border-violet-400/35 hover:bg-violet-950/25 hover:text-white/90 transition-colors"
                    >
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mb-1">
                        {badge ? (
                          <span className="text-xs font-medium uppercase tracking-wider text-violet-200/90">
                            {badge}
                          </span>
                        ) : null}
                        {s.petalId ? (
                          <span
                            className="text-xs font-semibold uppercase tracking-wider"
                            style={{ color: petalColor(s.petalId) }}
                          >
                            {petalName(s.petalId)}
                          </span>
                        ) : null}
                      </span>
                      <span className="block leading-relaxed">{s.text}</span>
                    </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-rose-400/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={listenToFlower}
              disabled={!intention.trim() || loadingEcho}
              className="w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:opacity-95 disabled:opacity-45"
            >
              {t('checkin.listenCta')}
            </button>
          </section>
        ) : null}

        {/* Acte 2 — Recevoir (chargement ou révélation) */}
        {!checkedInToday && (act === 'receive' || act === 'anchor') && (
          <section className="space-y-6">
            <div className="relative flex flex-col items-center">
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(100%,280px)] aspect-square rounded-full bg-gradient-to-tr from-violet-600/40 via-teal-500/20 to-fuchsia-600/30 blur-3xl opacity-90 motion-safe:animate-[pulse_4s_ease-in-out_infinite]"
                aria-hidden
              />
              <FlowerSVG
                petals={displayPetals}
                size={280}
                animate
                showLabels
                labelsOnHoverOnly
                pinnedLabelIds={highlightId ? [highlightId] : []}
                pulsePetalId={highlightId}
                visualPreset="zen"
                labelTheme="dark"
                svgClassName="relative z-[1]"
              />
            </div>

            {loadingEcho ? (
              <div className="text-center space-y-2 py-4">
                <div className="mx-auto h-8 w-8 rounded-full border-2 border-violet-400/30 border-t-violet-300 animate-spin" />
                <p className="text-sm text-violet-200/80 italic">{t('checkin.listening')}</p>
              </div>
            ) : echo ? (
              <div className="rounded-3xl border border-white/12 bg-white/[0.05] px-5 py-6 space-y-4">
                {highlightId ? (
                  <div className="flex justify-center">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-wide"
                      style={{
                        color: petalColor(highlightId),
                        backgroundColor: `${petalColor(highlightId)}18`,
                        border: `1px solid ${petalColor(highlightId)}40`,
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: petalColor(highlightId) }}
                      />
                      {petalName(highlightId)}
                    </span>
                  </div>
                ) : null}
                <p className="text-base sm:text-lg font-light italic text-violet-50/95 leading-relaxed text-center">
                  {echo.echo}
                </p>
                {echo.invitation ? (
                  <div className="border-t border-white/8 pt-4">
                    <p className="text-xs uppercase tracking-wider text-white/70 text-center mb-2">
                      {t('checkin.invitationLabel')}
                    </p>
                    <p className="text-sm text-white/80 text-center leading-relaxed">{echo.invitation}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        )}

        {/* Acte 3 — Ancrer */}
        {!checkedInToday && act === 'anchor' && echo && !loadingEcho ? (
          <section className="mt-6 space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div>
              <p className="mb-3 text-sm text-white/70 text-center">{t('checkin.feltLabel')}</p>
              <div className="grid grid-cols-3 gap-2">
                {FELT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFeltAfter(opt.value)}
                    aria-pressed={feltAfter === opt.value}
                    className={`rounded-2xl border px-2 py-3 text-center transition ${
                      feltAfter === opt.value
                        ? 'border-violet-400/60 bg-violet-950/40 text-white'
                        : 'border-white/10 bg-black/20 text-white/55 hover:border-white/25'
                    }`}
                  >
                    <span className="text-xl block mb-1">{opt.emoji}</span>
                    <span className="text-xs font-medium leading-tight">{t(`checkin.${opt.key}`)}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-center text-white/80">{t('checkin.feltOptional')}</p>
            </div>

            {error ? (
              <p className="rounded-xl border border-rose-400/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={resetFlow}
                className="flex-1 rounded-full border border-white/15 py-3 text-sm text-white/60 hover:bg-white/5 transition"
              >
                {t('checkin.back')}
              </button>
              <button
                type="button"
                onClick={plantEcho}
                disabled={saving}
                className="flex-[2] rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50 transition hover:opacity-95"
              >
                {saving ? t('checkin.saving') : t('checkin.plantCta')}
              </button>
            </div>

            <p className="text-center">
              <Link
                href={`/tirage?petal=${echo.highlight_petal}`}
                className="text-xs text-violet-200/90 hover:text-violet-200 underline-offset-2 hover:underline"
              >
                {t('checkin.drawLink', { petal: petalName(echo.highlight_petal) })}
              </Link>
            </p>
          </section>
        ) : null}

        {/* Confirmation */}
        {act === 'done' ? (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-950/25 px-6 py-8 text-center space-y-2">
            <p className="text-2xl">🌱</p>
            <p className="text-lg font-light text-emerald-100">{t('checkin.planted')}</p>
            <p className="text-xs text-emerald-200/70">{t('checkin.plantedHint')}</p>
          </div>
        ) : null}

        {/* Historique */}
        {history.filter((c) => c.intention || c.aiResponse).length > 0 && (checkedInToday || act === 'pose') ? (
          <section className="mt-10">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-white/70">
              {t('checkin.historyTitle')}
            </h2>
            <ul className="space-y-3">
              {history
                .filter((c) => c.intention || c.aiResponse)
                .slice(0, 12)
                .map((c) => (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-white/70 shrink-0 pt-0.5">
                        {formatDate(c.createdAt, locale)}
                      </span>
                      {c.highlightPetal ? (
                        <span
                          className="text-xs font-semibold uppercase tracking-wider shrink-0"
                          style={{ color: petalColor(c.highlightPetal) }}
                        >
                          {petalName(c.highlightPetal)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm text-white/75 leading-relaxed line-clamp-3">
                      {c.aiResponse?.whisper || c.intention}
                    </p>
                    {c.aiResponse?.echo && c.aiResponse.echo !== c.aiResponse.whisper ? (
                      <p className="mt-1 text-xs italic text-white/75 line-clamp-2">{c.aiResponse.echo}</p>
                    ) : null}
                  </li>
                ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
