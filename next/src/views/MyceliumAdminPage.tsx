'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { myceliumApi, type OrgDTO, type TeamDTO, type OrgInviteDTO, type AdoptionStatsDTO } from '@/api/mycelium'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'
import { invalidateMyceliumAccessCache } from '@/hooks/useMyceliumAccess'
import DemoAccountBadge from '@/components/DemoAccountBadge'
import { isDemoEmail } from '@/lib/demo-accounts'

export default function MyceliumAdminPage() {
  useStore((s) => s.locale)
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<OrgDTO | null>(null)
  const [teams, setTeams] = useState<TeamDTO[]>([])
  const [members, setMembers] = useState(0)
  const [seats, setSeats] = useState(0)
  const [invites, setInvites] = useState<OrgInviteDTO[]>([])
  const [adoption, setAdoption] = useState<AdoptionStatsDTO | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [orgName, setOrgName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [emails, setEmails] = useState('')
  const [seatsInput, setSeatsInput] = useState('')
  const [charter, setCharter] = useState('')
  const [charterSaved, setCharterSaved] = useState(false)
  const [campaignBusy, setCampaignBusy] = useState(false)
  const [activeCampaign, setActiveCampaign] = useState<{ title: string; message: string } | null>(null)
  const [lastInvites, setLastInvites] = useState<Array<{ email: string; inviteLink: string }>>([])

  function reload() {
    return myceliumApi
      .getOrg()
      .then(async (r) => {
        setOrg(r.org)
        setTeams(r.teams || [])
        setMembers(r.members || 0)
        setSeats(r.seats || 0)
        setInvites(r.invites || [])
        setCharter(r.org?.charter ?? '')
        setActiveCampaign(
          r.org?.pulseCampaign?.active
            ? { title: r.org.pulseCampaign.title, message: r.org.pulseCampaign.message }
            : null
        )
        if (r.org) {
          try {
            const stats = await myceliumApi.stats()
            setAdoption(stats.adoption)
          } catch {
            setAdoption(null)
          }
        } else {
          setAdoption(null)
        }
      })
      .catch(() => {
        setOrg(null)
        setAdoption(null)
      })
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  async function createOrg() {
    if (!orgName.trim()) return
    setBusy(true)
    setError('')
    try {
      await myceliumApi.createOrg(orgName.trim())
      setOrgName('')
      invalidateMyceliumAccessCache()
      await reload()
    } catch (e) {
      setError((e as { message?: string })?.message || t('mycelium.error'))
    } finally {
      setBusy(false)
    }
  }

  async function addTeam() {
    if (!teamName.trim()) return
    setBusy(true)
    try {
      await myceliumApi.createTeam(teamName.trim())
      setTeamName('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function sendInvites() {
    if (!emails.trim()) return
    setBusy(true)
    setError('')
    try {
      const r = await myceliumApi.inviteBatch(emails)
      setLastInvites(r.created)
      setEmails('')
      await reload()
    } catch (e) {
      setError((e as { message?: string })?.message || t('mycelium.error'))
    } finally {
      setBusy(false)
    }
  }

  async function saveSeats() {
    const n = parseInt(seatsInput, 10)
    if (!Number.isFinite(n) || n <= 0) return
    setBusy(true)
    try {
      const r = await myceliumApi.setSeats(n)
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl
        return
      }
      setSeatsInput('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function saveCharter() {
    setBusy(true)
    setError('')
    try {
      await myceliumApi.updateCharter(charter.trim() || null)
      setCharterSaved(true)
      await reload()
      setTimeout(() => setCharterSaved(false), 2000)
    } catch (e) {
      setError((e as { message?: string })?.message || t('mycelium.error'))
    } finally {
      setBusy(false)
    }
  }

  async function launchCampaign() {
    setCampaignBusy(true)
    setError('')
    try {
      const r = await myceliumApi.launchPulseCampaign()
      if (r.org?.pulseCampaign?.active) {
        setActiveCampaign({ title: r.org.pulseCampaign.title, message: r.org.pulseCampaign.message })
      }
    } catch (e) {
      setError((e as { message?: string })?.message || t('mycelium.error'))
    } finally {
      setCampaignBusy(false)
    }
  }

  async function endCampaign() {
    setCampaignBusy(true)
    try {
      await myceliumApi.endPulseCampaign()
      setActiveCampaign(null)
    } finally {
      setCampaignBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" aria-hidden />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('mycelium.adminTitle')}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.adminSubtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/mycelium/dashboard"
              className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              {t('mycelium.dashboardLink')}
            </Link>
            <Link
              href="/mycelium/espace"
              className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              {t('mycelium.espaceLink')}
            </Link>
          </div>
        </header>

        <p className="mb-4 rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-2 text-xs text-violet-800 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-200">
          {t('mycelium.pilotNoteOpen')}
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {!org ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.createOrgTitle')}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.createOrgLead')}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={t('mycelium.orgNamePlaceholder')}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={createOrg}
                disabled={busy || !orgName.trim()}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {t('mycelium.createOrgCta')}
              </button>
            </div>
          </section>
        ) : (
          <div className="space-y-8">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('mycelium.statMembers')} value={String(members)} />
              <Stat label={t('mycelium.statSeats')} value={seats > 0 ? String(seats) : '∞'} />
              <Stat label={t('mycelium.statTeams')} value={String(teams.length)} />
              <Stat
                label={t('mycelium.participationRate')}
                value={adoption ? `${adoption.participationRate}%` : '—'}
              />
            </section>

            <p className="rounded-lg border border-dashed border-sky-300/70 bg-sky-50/50 px-3 py-2 text-xs text-sky-800 dark:border-sky-600/40 dark:bg-sky-950/20 dark:text-sky-200">
              Les comptes <span className="font-mono">@demo-littoral.eludein.art</span> sont des personnages virtuels
              réservés à la démo Mycelium — ils n&apos;apparaissent pas dans la Prairie ni le social Fleur d&apos;Amour.
            </p>

            {adoption && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.adoptionTitle')}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.adoptionLead')}</p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
                  <div>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{adoption.withProfile}</p>
                    <p className="text-xs text-slate-500">{t('mycelium.profilesCount')}</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{adoption.withCheckin30d}</p>
                    <p className="text-xs text-slate-500">{t('mycelium.activeMembers30d')}</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{adoption.checkinCount30d}</p>
                    <p className="text-xs text-slate-500">{t('mycelium.pulses30d')}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Charte entreprise */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.charterTitle')}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.charterLead')}</p>
              <textarea
                value={charter}
                onChange={(e) => setCharter(e.target.value)}
                rows={3}
                placeholder={t('mycelium.charterPlaceholder')}
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={saveCharter}
                disabled={busy}
                className="mt-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {charterSaved ? t('mycelium.charterSaved') : t('mycelium.charterCta')}
              </button>
            </section>

            {/* Campagne pulse */}
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.campaignTitle')}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.campaignLead')}</p>
              {activeCampaign ? (
                <div className="mt-3 rounded-xl border border-emerald-300 bg-white/80 px-4 py-3 dark:border-emerald-800 dark:bg-slate-900/60">
                  <p className="font-medium text-emerald-800 dark:text-emerald-200">{activeCampaign.title}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{activeCampaign.message}</p>
                  <button
                    type="button"
                    onClick={endCampaign}
                    disabled={campaignBusy}
                    className="mt-3 text-xs font-semibold text-slate-500 hover:underline"
                  >
                    {t('mycelium.campaignEnd')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={launchCampaign}
                  disabled={campaignBusy}
                  className="mt-3 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {t('mycelium.campaignLaunch')}
                </button>
              )}
            </section>

            {/* Sièges / billing */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.seatsTitle')}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.seatsLead')}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  min={1}
                  value={seatsInput}
                  onChange={(e) => setSeatsInput(e.target.value)}
                  placeholder={t('mycelium.seatsPlaceholder')}
                  className="w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={saveSeats}
                  disabled={busy}
                  className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {t('mycelium.seatsCta')}
                </button>
              </div>
            </section>

            {/* Équipes */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.teamsTitle')}</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={t('mycelium.teamPlaceholder')}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={addTeam}
                  disabled={busy || !teamName.trim()}
                  className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {t('mycelium.teamAdd')}
                </button>
              </div>
              {teams.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {teams.map((team) => (
                    <li
                      key={team.id}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {team.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Invitations en masse */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t('mycelium.inviteTitle')}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('mycelium.inviteLead')}</p>
              <textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                rows={3}
                placeholder={t('mycelium.invitePlaceholder')}
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:border-emerald-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={sendInvites}
                disabled={busy || !emails.trim()}
                className="mt-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {t('mycelium.inviteCta')}
              </button>

              {lastInvites.length > 0 && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('mycelium.inviteCreated')}</p>
                  {lastInvites.map((inv) => (
                    <p key={inv.email} className="flex flex-wrap items-center gap-1.5 break-all text-xs text-slate-500 dark:text-slate-400">
                      <span>{inv.email}</span>
                      {isDemoEmail(inv.email) ? <DemoAccountBadge /> : null}
                      <span>— <span className="font-mono">{inv.inviteLink}</span></span>
                    </p>
                  ))}
                </div>
              )}

              {invites.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{t('mycelium.invitePending')}</p>
                  <ul className="flex flex-wrap gap-2">
                    {invites.map((inv) => (
                      <li key={inv.id} className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        {inv.email}
                        {isDemoEmail(inv.email) ? <DemoAccountBadge className="scale-90" /> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
