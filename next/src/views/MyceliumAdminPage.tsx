'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { myceliumApi, type OrgDTO, type TeamDTO, type OrgInviteDTO } from '@/api/mycelium'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

export default function MyceliumAdminPage() {
  useStore((s) => s.locale)
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<OrgDTO | null>(null)
  const [teams, setTeams] = useState<TeamDTO[]>([])
  const [members, setMembers] = useState(0)
  const [seats, setSeats] = useState(0)
  const [invites, setInvites] = useState<OrgInviteDTO[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [orgName, setOrgName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [emails, setEmails] = useState('')
  const [seatsInput, setSeatsInput] = useState('')
  const [lastInvites, setLastInvites] = useState<Array<{ email: string; inviteLink: string }>>([])

  function reload() {
    return myceliumApi
      .getOrg()
      .then((r) => {
        setOrg(r.org)
        setTeams(r.teams || [])
        setMembers(r.members || 0)
        setSeats(r.seats || 0)
        setInvites(r.invites || [])
      })
      .catch(() => setOrg(null))
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
          {org && (
            <Link
              href="/mycelium/climat"
              className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
            >
              {t('mycelium.climateLink')}
            </Link>
          )}
        </header>

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
            <section className="grid grid-cols-3 gap-3">
              <Stat label={t('mycelium.statMembers')} value={String(members)} />
              <Stat label={t('mycelium.statSeats')} value={seats > 0 ? String(seats) : '∞'} />
              <Stat label={t('mycelium.statTeams')} value={String(teams.length)} />
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
                    <p key={inv.email} className="break-all text-xs text-slate-500 dark:text-slate-400">
                      {inv.email} — <span className="font-mono">{inv.inviteLink}</span>
                    </p>
                  ))}
                </div>
              )}

              {invites.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{t('mycelium.invitePending')}</p>
                  <ul className="flex flex-wrap gap-2">
                    {invites.map((inv) => (
                      <li key={inv.id} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        {inv.email}
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
