'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FlowerSVG } from '@/components/FlowerSVG'
import {
  dyadsApi,
  type DyadDTO,
  type DyadEventDTO,
  type DyadMembersDTO,
  type DyadRitualDTO,
  type DyadOperationalSummaryDTO,
  type DyadSummaryRecordDTO,
  type MediationDTO,
} from '@/api/dyads'
import { t } from '@/i18n'
import Link from 'next/link'
import { useStore } from '@/store/useStore'

export default function DyadePage() {
  const locale = useStore((s) => s.locale) || 'fr'
  const searchParams = useSearchParams()
  const acceptToken = searchParams?.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [dyad, setDyad] = useState<DyadDTO | null>(null)
  const [members, setMembers] = useState<DyadMembersDTO | null>(null)
  const [viewerUserId, setViewerUserId] = useState<number | null>(null)
  const [events, setEvents] = useState<DyadEventDTO[]>([])
  const [rituals, setRituals] = useState<DyadRitualDTO[]>([])

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [incomingInvite, setIncomingInvite] = useState<{
    inviteUrl: string
    token: string
  } | null>(null)
  const [error, setError] = useState('')

  const [message, setMessage] = useState('')
  const [ritualTitle, setRitualTitle] = useState('')
  const [mediationInput, setMediationInput] = useState('')
  const [mediation, setMediation] = useState<MediationDTO | null>(null)
  const [operationalSummary, setOperationalSummary] = useState<DyadOperationalSummaryDTO | null>(null)
  const [summaryHistory, setSummaryHistory] = useState<DyadSummaryRecordDTO[]>([])
  const [selectedSummaryId, setSelectedSummaryId] = useState<number | null>(null)
  const [summaryMatchesState, setSummaryMatchesState] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  function reload() {
    return dyadsApi
      .me()
      .then((r) => {
        setDyad(r.dyad)
        setMembers(r.members ?? null)
        setEvents(r.events || [])
        setRituals(r.rituals || [])
        if (r.dyad && r.role) {
          setViewerUserId(r.role === 'a' ? r.dyad.userA : r.dyad.userB ?? null)
        } else {
          setViewerUserId(null)
        }
        if (r.inviteUrl) setInviteUrl(r.inviteUrl)
        setIncomingInvite(
          r.incomingInvite
            ? { inviteUrl: r.incomingInvite.inviteUrl, token: r.incomingInvite.token }
            : null
        )
        if (r.dyad?.status === 'active') {
          void loadOperationalSummaryCached()
        } else {
          setOperationalSummary(null)
          setSummaryHistory([])
          setSelectedSummaryId(null)
        }
      })
      .catch(() => {
        setDyad(null)
        setMembers(null)
        setIncomingInvite(null)
        setOperationalSummary(null)
        setSummaryHistory([])
        setSelectedSummaryId(null)
      })
  }

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (acceptToken) {
        try {
          await dyadsApi.accept(acceptToken)
        } catch (e) {
          if (!cancelled) setError((e as { message?: string })?.message || t('couple.acceptError'))
        }
      }
      await reload()
      if (!cancelled) setLoading(false)
    }
    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptToken])

  async function sendInvite() {
    setError('')
    setBusy(true)
    try {
      const r = await dyadsApi.invite(inviteEmail.trim())
      setInviteUrl(r.inviteUrl)
      await reload()
    } catch (e) {
      setError((e as { message?: string })?.message || t('couple.inviteError'))
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage() {
    if (!message.trim()) return
    setBusy(true)
    try {
      await dyadsApi.postEvent(message.trim())
      setMessage('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function addRitual() {
    if (!ritualTitle.trim()) return
    setBusy(true)
    try {
      await dyadsApi.createRitual({ title: ritualTitle.trim() })
      setRitualTitle('')
      const r = await dyadsApi.rituals()
      setRituals(r.rituals)
    } finally {
      setBusy(false)
    }
  }

  async function completeRitual(id: number) {
    await dyadsApi.completeRitual(id)
    const r = await dyadsApi.rituals()
    setRituals(r.rituals)
  }

  function applySummaryView(history: DyadSummaryRecordDTO[], selectedId: number | null) {
    const row =
      selectedId != null ? history.find((h) => h.id === selectedId) ?? history[0] : history[0]
    setOperationalSummary(row?.summary ?? null)
  }

  async function loadOperationalSummaryCached() {
    setSummaryLoading(true)
    try {
      const r = await dyadsApi.getOperationalSummary(locale)
      setSummaryHistory(r.history || [])
      setSummaryMatchesState(r.matchesCurrentState)
      setSelectedSummaryId(null)
      applySummaryView(r.history || [], null)
    } catch {
      setOperationalSummary(null)
      setSummaryHistory([])
    } finally {
      setSummaryLoading(false)
    }
  }

  async function generateOperationalSummary(force = false) {
    setSummaryLoading(true)
    setError('')
    try {
      const r = await dyadsApi.generateOperationalSummary(locale, force)
      if (!r?.summary?.headline) {
        throw new Error(t('couple.summaryError'))
      }
      setSummaryHistory(r.history || [])
      setSummaryMatchesState(r.cached && !force)
      setSelectedSummaryId(null)
      setOperationalSummary(r.summary)
      const warn = (r as { persistWarning?: string }).persistWarning
      if (warn) setError(warn)
    } catch (e) {
      const err = e as { message?: string; detail?: string }
      setError(err.detail || err.message || t('couple.summaryError'))
    } finally {
      setSummaryLoading(false)
    }
  }

  function formatSummaryDate(s: string) {
    if (!s) return '—'
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
    if (isNaN(d.getTime())) return s
    return d.toLocaleDateString(locale || 'fr', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  async function computeFleur() {
    setBusy(true)
    setError('')
    try {
      const r = await dyadsApi.computeFleur()
      setDyad((d) => (d ? { ...d, fleur: r.fleur, fleurUpdatedAt: r.fleurUpdatedAt } : d))
      void loadOperationalSummaryCached()
    } catch (e) {
      setError((e as { message?: string })?.message || t('couple.fleurError'))
    } finally {
      setBusy(false)
    }
  }

  async function runMediation() {
    if (!mediationInput.trim()) return
    setBusy(true)
    setMediation(null)
    try {
      const r = await dyadsApi.mediation(mediationInput.trim(), locale)
      setMediation(r.mediation)
    } catch (e) {
      setError((e as { message?: string })?.message || t('couple.mediationError'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500" aria-hidden />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('couple.title')}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('couple.subtitle')}</p>
        </header>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {incomingInvite && !dyad && (
          <section className="mb-6 rounded-2xl border border-violet-300 bg-violet-50/80 p-5 dark:border-violet-800 dark:bg-violet-950/30">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('couple.incomingTitle')}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('couple.incomingLead')}</p>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  await dyadsApi.accept(incomingInvite.token)
                  setIncomingInvite(null)
                  await reload()
                } catch (e) {
                  setError((e as { message?: string })?.message || t('couple.acceptError'))
                } finally {
                  setBusy(false)
                }
              }}
              className="mt-3 rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
            >
              {t('couple.incomingAccept')}
            </button>
          </section>
        )}

        {/* Pas de dyade → invitation */}
        {!dyad && !incomingInvite && (
          <section className="rounded-2xl border border-pink-200 bg-pink-50/60 p-5 dark:border-pink-900 dark:bg-pink-950/20">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('couple.inviteTitle')}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('couple.inviteLead')}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t('couple.invitePlaceholder')}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={sendInvite}
                disabled={busy || !inviteEmail.trim()}
                className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-pink-600 disabled:opacity-60"
              >
                {t('couple.inviteCta')}
              </button>
            </div>
            {inviteUrl && (
              <p className="mt-3 break-all text-xs text-slate-500 dark:text-slate-400">
                {t('couple.inviteLinkLabel')} <span className="font-mono">{inviteUrl}</span>
              </p>
            )}
          </section>
        )}

        {/* Dyade en attente */}
        {dyad?.status === 'pending' && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            <p>
              {t('couple.pending')} {dyad.inviteeEmail ? `(${dyad.inviteeEmail})` : ''}
            </p>
            <p className="mt-2 text-xs text-amber-900/90 dark:text-amber-100/90">{t('couple.pendingHint')}</p>
            {inviteUrl && (
              <p className="mt-3 break-all text-xs font-mono text-amber-950 dark:text-amber-50">
                {t('couple.inviteLinkLabel')} {inviteUrl}
              </p>
            )}
          </section>
        )}

        {/* Dyade active */}
        {dyad?.status === 'active' && (
          <div className="space-y-8">
            {members && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="mb-4 text-center font-semibold text-slate-900 dark:text-slate-100">
                  {t('couple.individualTitle')}
                </h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <IndividualFlowerCard
                    label={members.memberA.label}
                    isYou={viewerUserId === members.memberA.userId}
                    petals={members.memberA.petals}
                  />
                  {members.memberB ? (
                    <IndividualFlowerCard
                      label={members.memberB.label}
                      isYou={viewerUserId === members.memberB.userId}
                      petals={members.memberB.petals}
                    />
                  ) : null}
                </div>
              </section>
            )}

            <section className="flex flex-col items-center rounded-2xl border border-pink-200/80 bg-gradient-to-b from-pink-50/40 to-white p-5 shadow-sm dark:border-pink-900/50 dark:from-pink-950/20 dark:to-slate-900">
              <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">{t('couple.fleurTitle')}</h2>
              <p className="mb-4 text-center text-xs text-slate-500 dark:text-slate-400">{t('couple.fleurCoupleHint')}</p>
              {dyad.fleur ? (
                <FlowerSVG petals={dyad.fleur} size={200} animate showLabels />
              ) : (
                <>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('couple.fleurEmpty')}</p>
                  <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">{t('couple.fleurEmptyHint')}</p>
                </>
              )}
              <button
                type="button"
                onClick={computeFleur}
                disabled={busy}
                className="mt-4 rounded-full border border-pink-300 px-4 py-2 text-sm font-semibold text-pink-700 transition hover:bg-pink-50 disabled:opacity-60 dark:text-pink-300 dark:hover:bg-pink-950/30"
              >
                {t('couple.fleurRecompute')}
              </button>
              {error && error.includes('Profil fleur') && (
                <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
                  <Link
                    href="/onboarding-diagnostic"
                    className="rounded-full border border-pink-300 px-3 py-1.5 text-pink-700 hover:bg-pink-50 dark:text-pink-300 dark:hover:bg-pink-950/30"
                  >
                    {t('nav.baseline')}
                  </Link>
                  <Link
                    href="/fleur"
                    className="rounded-full border border-pink-300 px-3 py-1.5 text-pink-700 hover:bg-pink-50 dark:text-pink-300 dark:hover:bg-pink-950/30"
                  >
                    {t('nav.fleur')}
                  </Link>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm dark:border-sky-900 dark:from-sky-950/30 dark:to-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('couple.summaryTitle')}</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => generateOperationalSummary(false)}
                    disabled={summaryLoading || busy}
                    className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
                  >
                    {summaryLoading ? t('couple.summaryLoading') : t('couple.summaryCta')}
                  </button>
                  {summaryHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={() => generateOperationalSummary(true)}
                      disabled={summaryLoading || busy}
                      className="rounded-full border border-sky-400 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60 dark:border-sky-600 dark:text-sky-200 dark:hover:bg-sky-950/50"
                    >
                      {t('couple.summaryForceCta')}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('couple.summaryLead')}</p>
              {selectedSummaryId != null && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{t('couple.summaryViewingPast')}</p>
              )}
              {summaryMatchesState && selectedSummaryId == null && operationalSummary && (
                <p className="mt-2 inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
                  {t('couple.summaryCachedBadge')}
                </p>
              )}
              {operationalSummary ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p className="font-serif text-lg font-semibold text-sky-900 dark:text-sky-200">
                    {operationalSummary.headline}
                  </p>
                  <SummaryBlock label={t('couple.summaryClimate')} value={operationalSummary.climate} />
                  <SummaryBlock label={t('couple.summaryAlignments')} value={operationalSummary.alignments} />
                  <SummaryBlock label={t('couple.summaryGaps')} value={operationalSummary.gaps} />
                  <SummaryBlock label={t('couple.summaryNext')} value={operationalSummary.nextStep} highlight />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('couple.summaryHint')}</p>
              )}

              {summaryHistory.length > 0 && (
                <div className="mt-6 border-t border-sky-200/80 pt-4 dark:border-sky-800">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {t('couple.summaryHistoryTitle')}
                  </h3>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {summaryHistory.map((h, idx) => {
                      const isLatest = idx === 0
                      const isSelected =
                        selectedSummaryId === h.id || (selectedSummaryId == null && isLatest)
                      return (
                        <li key={h.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSummaryId(isLatest ? null : h.id)
                              applySummaryView(summaryHistory, isLatest ? null : h.id)
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                              isSelected
                                ? 'bg-sky-200/80 font-semibold text-sky-900 dark:bg-sky-800/50 dark:text-sky-100'
                                : 'text-slate-600 hover:bg-sky-50 dark:text-slate-400 dark:hover:bg-sky-950/30'
                            }`}
                          >
                            <span className="block text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                              {formatSummaryDate(h.createdAt)}
                              {isLatest ? ` · ${t('couple.summaryLatest')}` : ''}
                            </span>
                            <span className="line-clamp-2">{h.summary.headline}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </section>

            {/* Médiation IA */}
            <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 dark:border-violet-900 dark:bg-violet-950/20">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('couple.mediationTitle')}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('couple.mediationLead')}</p>
              <textarea
                value={mediationInput}
                onChange={(e) => setMediationInput(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={t('couple.mediationPlaceholder')}
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-violet-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={runMediation}
                disabled={busy || !mediationInput.trim()}
                className="mt-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
              >
                {t('couple.mediationCta')}
              </button>
              {mediation && (
                <div className="mt-4 space-y-3 text-sm">
                  <MediationBlock label={t('couple.medReframed')} value={mediation.reframed} />
                  <MediationBlock label={t('couple.medOther')} value={mediation.otherPerspective} />
                  <MediationBlock label={t('couple.medDeescalation')} value={mediation.deescalation} />
                  <MediationBlock label={t('couple.medSuggestion')} value={mediation.suggestion} />
                </div>
              )}
            </section>

            {/* Rituels */}
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('couple.ritualsTitle')}</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={ritualTitle}
                  onChange={(e) => setRitualTitle(e.target.value)}
                  placeholder={t('couple.ritualPlaceholder')}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={addRitual}
                  disabled={busy || !ritualTitle.trim()}
                  className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {t('couple.ritualAdd')}
                </button>
              </div>
              <ul className="mt-3 space-y-2">
                {rituals.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <span className="text-slate-700 dark:text-slate-200">{r.title}</span>
                    <button
                      type="button"
                      onClick={() => completeRitual(r.id)}
                      className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      {t('couple.ritualDone')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* Fil partagé */}
            <section>
              <h2 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">{t('couple.threadTitle')}</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('couple.threadPlaceholder')}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-pink-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={busy || !message.trim()}
                  className="rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-pink-600 disabled:opacity-60"
                >
                  {t('couple.threadSend')}
                </button>
              </div>
              <ul className="mt-4 space-y-2">
                {events
                  .filter((e) => e.type === 'message')
                  .map((e) => (
                    <li
                      key={e.id}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {e.content}
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function IndividualFlowerCard({
  label,
  isYou,
  petals,
}: {
  label: string
  isYou: boolean
  petals: Record<string, number> | null
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/50">
      <p className="mb-2 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
        {isYou && (
          <span className="ml-1.5 text-xs font-normal text-pink-600 dark:text-pink-400">
            ({t('couple.memberYou')})
          </span>
        )}
      </p>
      {petals ? (
        <FlowerSVG petals={petals} size={160} animate showLabels />
      ) : (
        <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">{t('couple.memberNoProfile')}</p>
      )}
    </div>
  )
}

function SummaryBlock({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  if (!value) return null
  return (
    <div
      className={
        highlight
          ? 'rounded-xl border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-800 dark:bg-sky-950/40'
          : ''
      }
    >
      <p className="text-xs font-bold uppercase tracking-widest text-sky-600 dark:text-sky-300">{label}</p>
      <p className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  )
}

function MediationBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">{label}</p>
      <p className="text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  )
}
