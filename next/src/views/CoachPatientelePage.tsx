// @ts-nocheck
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { coachPatientsApi } from '@/api/coachPatients'
import { sapApi } from '@/api/billing'
import { chatApi } from '@/api/chat'
import { useAuth } from '@/contexts/AuthContext'
import { INTENTIONS } from '@/api/social'
import { FlowerSVG } from '@/components/FlowerSVG'
import { useStore } from '@/store/useStore'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function pathWithoutBase(pathname: string): string {
  if (!pathname) return '/'
  return pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname
}

const PETAL_IDS = ['agape', 'philautia', 'mania', 'storge', 'pragma', 'philia', 'ludus', 'eros']

function petalsArrayToRecord(petals) {
  const arr = Array.isArray(petals) ? petals : []
  const out = {}
  PETAL_IDS.forEach((id, i) => {
    out[id] = Number.isFinite(arr[i]) ? Math.max(0, Math.min(1, Number(arr[i]))) : 0.3
  })
  return out
}

export default function CoachPatientelePage() {
  const pathname = usePathname() || ''
  const routeRoot = pathWithoutBase(pathname).split('/').filter(Boolean)[0]
  const suiviBase = routeRoot === 'admin' ? '/admin/suivi' : '/coach/suivi'
  const chatBase = routeRoot === 'admin' ? '/admin/chat' : '/coach/chat'

  const { isAdmin, isCoach } = useAuth()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rechargePid, setRechargePid] = useState(null)
  const [rechargeAmt, setRechargeAmt] = useState('10')
  const [rechargeBusy, setRechargeBusy] = useState(false)

  const [email, setEmail] = useState('')
  const [intentionId, setIntentionId] = useState(INTENTIONS[0]?.id ?? 'resonance')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [rebuildPatientId, setRebuildPatientId] = useState<number | null>(null)
  const locale = useStore((s) => s.locale) || 'fr'

  const [conversations, setConversations] = useState<Array<any>>([])
  const [loadingConvs, setLoadingConvs] = useState(true)

  const intentionLabel = useMemo(() => {
    const map = new Map()
    INTENTIONS.forEach((i) => map.set(i.id, i.label))
    return map
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    coachPatientsApi
      .listMyPatients()
      .then((r) => {
        if (!cancelled) setPatients(r?.patients ?? [])
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Erreur chargement')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingConvs(true)
    chatApi
      .listConversations({ status: 'all', per_page: 200, dedupe: 'none' })
      .then((r) => {
        if (cancelled) return
        const items = (r as { items?: Array<any> })?.items ?? []
        setConversations(Array.isArray(items) ? items : [])
      })
      .catch(() => {
        if (!cancelled) setConversations([])
      })
      .finally(() => {
        if (!cancelled) setLoadingConvs(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const convOpen = useMemo(
    () => conversations.filter((c) => String(c?.status ?? 'open') !== 'closed'),
    [conversations]
  )
  const convClosed = useMemo(
    () => conversations.filter((c) => String(c?.status ?? '') === 'closed'),
    [conversations]
  )

  async function copyLink() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      return true
    } catch {
      // fallback
      try {
        const ta = document.createElement('textarea')
        ta.value = inviteLink
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        ta.remove()
        return true
      } catch {
        return false
      }
    }
  }

  async function handleInvite() {
    setInviteLink(null)
    setInviteLoading(true)
    try {
      const res = await coachPatientsApi.invite({ email: email.trim(), intention_id: intentionId })
      if (res?.ok) setInviteLink(res.inviteLink ?? null)
      setEmail('')
      // rafraîchir la liste (au moins si le user existe déjà)
      const r2 = await coachPatientsApi.listMyPatients()
      setPatients(r2?.patients ?? [])
    } catch (e) {
      setError(e?.message ?? 'Impossible d\'envoyer l\'invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleRechargeSap() {
    const pid = rechargePid
    if (pid == null) return
    const n = parseInt(rechargeAmt, 10)
    if (!n || n < 1) {
      setError('Montant invalide (minimum 1 SAP).')
      return
    }
    setRechargeBusy(true)
    setError(null)
    try {
      await sapApi.bonusPatient(pid, n, 'bonus_coach_manuel')
      const r2 = await coachPatientsApi.listMyPatients()
      setPatients(r2?.patients ?? [])
      setRechargePid(null)
    } catch (e) {
      setError(e?.message ?? 'Impossible de créditer la Sève')
    } finally {
      setRechargeBusy(false)
    }
  }

  async function handleRebuildScience(patientUserId: number) {
    setRebuildPatientId(patientUserId)
    setError(null)
    try {
      await coachPatientsApi.rebuildScience({ patient_user_id: patientUserId, locale })
      // Rafraîchir la liste (car le endpoint retourne la science, mais pas forcément generated_at côté UI).
      const r2 = await coachPatientsApi.listMyPatients()
      setPatients(r2?.patients ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de recalculer la science')
    } finally {
      setRebuildPatientId(null)
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-500 via-teal-500 to-violet-500 bg-clip-text text-transparent">
              Patientèle coach
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Invitez par email, puis suivez et dialoguez dans la Clairière.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
            Inviter une personne
          </h2>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@domaine.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Cadre</label>
              <select
                value={intentionId}
                onChange={(e) => setIntentionId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              >
                {INTENTIONS.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviteLoading || !email.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {inviteLoading ? '…' : 'Inviter'}
            </button>
            {inviteLink && (
              <div className="flex-1 min-w-[280px]">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Lien à copier (inscription) :</p>
                <div className="flex items-center gap-2">
                  <input
                    value={inviteLink}
                    readOnly
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Copier
                  </button>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-3">
            Vos patientèles
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="w-10 h-10 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-2">🌿</p>
              <p className="text-sm">Aucun·e patient·e pour le moment. Invitez une personne par email.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {patients.map((p) => {
                const petalsRecord = petalsArrayToRecord(p.fleurMoyenne?.petals)
                const suiviHref =
                  p.email && String(p.email).trim()
                    ? `${suiviBase}?email=${encodeURIComponent(String(p.email).trim())}`
                    : null
                return (
                  <div
                    key={p.patientUserId}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-5 space-y-3"
                  >
                    {suiviHref ? (
                      <Link
                        href={suiviHref}
                        className="flex items-start gap-4 rounded-xl -m-1 p-1 -mt-1 transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                      >
                        <div className="shrink-0">
                          <FlowerSVG
                            petals={petalsRecord}
                            variant="silhouette"
                            size={92}
                            animate={false}
                            showLabels={false}
                            showScores={false}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.pseudo}</p>
                            <span className="shrink-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              Suivi détaillé →
                            </span>
                          </div>
                          {p.email ? <p className="text-xs text-slate-500 dark:text-slate-400">{p.email}</p> : null}
                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                          <span className="text-[10px] px-2 py-1 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200 border border-violet-200/60 dark:border-violet-800/60 font-semibold">
                            SAP : {p.sapBalance ?? 0}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-1 rounded-full border font-medium ${
                              p.acquisitionChannel === 'direct'
                                ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200'
                                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                            }`}
                            title={
                              p.acquisitionChannel === 'direct'
                                ? 'Arrivée via invitation coach — commission marketplace 0 %'
                                : 'Relation hors invitation — commission marketplace 20 % (indicatif produit)'
                            }
                          >
                            {p.acquisitionChannel === 'direct' ? 'Direct · 0 %' : 'Marketplace · 20 %'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(p.intentionIds ?? []).map((cid) => (
                            <span
                              key={cid}
                              className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                            >
                              {intentionLabel.get(cid) ?? cid}
                            </span>
                          ))}
                        </div>
                        {p.science?.generated_at ? (
                          <p className="text-xs text-violet-600 dark:text-violet-300 mt-2">
                            Profil science généré ({String(p.science.facts?.length ?? 0)} faits,{' '}
                            {String(p.science.hypotheses?.length ?? 0)} hypothèses)
                          </p>
                        ) : (
                          p.science?.facts?.length || p.science?.hypotheses?.length ? (
                            <p className="text-xs text-violet-600 dark:text-violet-300 mt-2">
                              Profil science disponible
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                              Profil science pas encore disponible
                            </p>
                          )
                        )}

                        {p.science?.meta?.has_chat_context === false ? (
                          <p className="text-[10px] mt-2 text-amber-700 dark:text-amber-300">
                            Note : synthèse sans contexte Clairière/coach.
                          </p>
                        ) : null}
                        </div>
                      </Link>
                    ) : (
                      <div
                        className="flex items-start gap-4 rounded-xl opacity-90"
                        title="Email non renseigné — ouverture du suivi détaillé impossible"
                      >
                        <div className="shrink-0">
                          <FlowerSVG
                            petals={petalsRecord}
                            variant="silhouette"
                            size={92}
                            animate={false}
                            showLabels={false}
                            showScores={false}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.pseudo}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Pas d&apos;email — suivi détaillé indisponible
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2 items-center">
                            <span className="text-[10px] px-2 py-1 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200 border border-violet-200/60 dark:border-violet-800/60 font-semibold">
                              SAP : {p.sapBalance ?? 0}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-1 rounded-full border font-medium ${
                                p.acquisitionChannel === 'direct'
                                  ? 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200'
                                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                              }`}
                            >
                              {p.acquisitionChannel === 'direct' ? 'Direct · 0 %' : 'Marketplace · 20 %'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(p.intentionIds ?? []).map((cid) => (
                              <span
                                key={cid}
                                className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                              >
                                {intentionLabel.get(cid) ?? cid}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <Link
                        href={p.channelId ? `/clairiere/${p.channelId}` : '/clairiere'}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                          p.channelId
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        }`}
                        aria-disabled={!p.channelId}
                        onClick={(e) => {
                          if (!p.channelId) e.preventDefault()
                        }}
                      >
                        Ouvrir la Clairière
                      </Link>
                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        <span className="text-[10px] text-slate-400">
                          {p.channelId ? 'Conversation prête' : 'Canal en attente'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRebuildScience(p.patientUserId)}
                          disabled={rebuildPatientId === p.patientUserId}
                          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                            rebuildPatientId === p.patientUserId
                              ? 'bg-violet-400/30 text-violet-900 dark:text-violet-100 cursor-progress'
                              : 'bg-violet-600 text-white hover:bg-violet-700'
                          }`}
                        >
                          {rebuildPatientId === p.patientUserId ? 'Recalcul…' : 'Recalculer la science'}
                        </button>
                        {(isAdmin || isCoach) && (
                          <button
                            type="button"
                            onClick={() => {
                              setRechargePid(p.patientUserId)
                              setRechargeAmt('10')
                            }}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                          >
                            Recharger Sève
                          </button>
                        )}
                      </div>
                    </div>

                    {(p.science?.facts?.length || p.science?.hypotheses?.length) && (
                      <div className="mt-3">
                        {Array.isArray(p.science.facts) && p.science.facts.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Faits
                            </p>
                            <ul className="space-y-1">
                              {p.science.facts.slice(0, 2).map((f: any) => (
                                <li key={f.id || f.text} className="text-xs text-slate-700 dark:text-slate-200">
                                  • {f.text}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {Array.isArray(p.science.hypotheses) && p.science.hypotheses.length > 0 ? (
                          <div className="space-y-2 mt-3">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                              Hypothèses
                            </p>
                            <ul className="space-y-1">
                              {p.science.hypotheses.slice(0, 3).map((h: any) => (
                                <li key={h.id || h.text} className="text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                      h.confidence_label === 'high'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                                        : h.confidence_label === 'medium'
                                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                                          : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                                    }`}
                                  >
                                    {h.confidence_label}
                                  </span>
                                  <span>• {h.text}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-5 space-y-3">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                Conversations d&apos;accompagnement
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Basé sur la messagerie (conversations ouvertes et clôturées).
              </p>
            </div>
            <Link href={chatBase} className="text-xs font-semibold text-violet-700 dark:text-violet-300 hover:underline">
              Ouvrir la messagerie →
            </Link>
          </div>

          {loadingConvs ? (
            <div className="flex items-center justify-center py-10">
              <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Aucune conversation.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: `Ouvertes (${convOpen.length})`, rows: convOpen },
                { title: `Clôturées (${convClosed.length})`, rows: convClosed },
              ].map((g) => (
                <div
                  key={g.title}
                  className="rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/40 dark:bg-slate-950/20 p-4 space-y-2 min-w-0"
                >
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {g.title}
                  </p>
                  {g.rows.length === 0 ? (
                    <p className="text-xs text-slate-400">—</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {g.rows.slice(0, 12).map((c) => {
                        const email = String(c?.user_email ?? '').trim()
                        const convId = String(c?.id ?? '')
                        const coachName = (c?.assigned_coach_display_name ? String(c.assigned_coach_display_name).trim() : '') || ''
                        const assignedCoachId = c?.assigned_coach_id != null ? Number(c.assigned_coach_id) : null
                        const badge =
                          assignedCoachId && coachName
                            ? `Coach: ${coachName}`
                            : assignedCoachId
                              ? `Coach ID: ${assignedCoachId}`
                              : 'Équipe'
                        const href = email ? `${chatBase}?email=${encodeURIComponent(email)}` : `${chatBase}?conv=${encodeURIComponent(convId)}`
                        return (
                          <li key={`${g.title}-${convId}`}>
                            <Link
                              href={href}
                              className="block rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/50 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors min-w-0"
                              title={email || convId}
                            >
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                  {email || `Conversation #${convId}`}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">#{convId}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{badge}</span>
                                {(c?.unread_count ?? 0) > 0 ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shrink-0">
                                    {c.unread_count > 99 ? '99+' : c.unread_count}
                                  </span>
                                ) : null}
                              </div>
                            </Link>
                          </li>
                        )
                      })}
                      {g.rows.length > 12 ? (
                        <li className="text-[11px] text-slate-400">
                          + {g.rows.length - 12} autres… (voir “Ouvrir la messagerie”)
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {rechargePid != null && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recharge-sap-title"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
              <h2 id="recharge-sap-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Bonus SAP
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Crédit manuel sur le compte du patient (transparence coach / client).
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Montant SAP
                </label>
                <input
                  type="number"
                  min={1}
                  max={50000}
                  value={rechargeAmt}
                  onChange={(e) => setRechargeAmt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setRechargePid(null)}
                  disabled={rechargeBusy}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleRechargeSap}
                  disabled={rechargeBusy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {rechargeBusy ? '…' : 'Créditer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

