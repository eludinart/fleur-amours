// @ts-nocheck
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { coachPatientsApi } from '@/api/coachPatients'
import { INTENTIONS } from '@/api/social'
import { FlowerSVG } from '@/components/FlowerSVG'
import { useStore } from '@/store/useStore'

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
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [email, setEmail] = useState('')
  const [intentionId, setIntentionId] = useState(INTENTIONS[0]?.id ?? 'resonance')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [rebuildPatientId, setRebuildPatientId] = useState<number | null>(null)
  const locale = useStore((s) => s.locale) || 'fr'

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
                return (
                  <div
                    key={p.patientUserId}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-5 space-y-3"
                  >
                    <div className="flex items-start gap-4">
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
                        {p.email ? <p className="text-xs text-slate-500 dark:text-slate-400">{p.email}</p> : null}
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
                    </div>

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
      </div>
    </div>
  )
}

