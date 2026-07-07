'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '@/lib/api-client'
import { toast } from '@/hooks/useToast'

type AudienceData = {
  generatedAt: string
  config?: { enabled: boolean; cooldownHours: number; cooldownPreset: string }
  params: { limit: number; cooldownHours: number; inactiveDays: number; activityDays: number }
  candidates: number
  pilotAdded: number
  wouldSend: number
  byCampaign: Record<string, number>
  devRestricted: boolean
  allowlistActive: boolean
  smtpConfigured: boolean
  allowlistNotFound: string[]
  diagnostics: {
    recentlyNudgedCooldown: number
    inactiveUsersTotal: number
    comebackInQueue: number
  }
  recipients: Recipient[]
}

type Recipient = {
  userId: number
  email: string
  displayName: string | null
  locale: string
  campaignId: string
  source: 'natural' | 'pilot'
  inApp: boolean
  willSendEmail: boolean
  wouldDeliver: boolean
  skipReasons: string[]
  emailSkipReasons: string[]
  notification: {
    type: string
    title: string
    body: string
    action_label: string
    action_url: string
  }
  emailPreview: { subject: string }
}

const CAMPAIGN_LABELS: Record<string, string> = {
  plan14j: 'Plan 14 jours',
  checkin: 'Check-in',
  tirage: 'Tirage carte',
  fleur: "Fleur d'AmOurs",
  session: 'Session porte',
  dreamscape: 'Conversation intérieure',
  comeback: 'Retour au jardin',
}

const EMAIL_SKIP_LABELS: Record<string, string> = {
  smtp_non_configure: 'SMTP non configuré',
  preferences_email_desactivees: 'E-mail désactivé dans les préférences',
  preferences_digest_daily: 'Préférence digest quotidien',
  preferences_digest_weekly: 'Préférence digest hebdomadaire',
}

const SKIP_LABELS: Record<string, string> = {
  ...EMAIL_SKIP_LABELS,
  mode_dev_envoi_restreint: 'Mode dev — envoi limité à l’adresse de test',
  hors_allowlist: 'Hors allowlist engagement (ENGAGEMENT_REMIND_ALLOWLIST)',
  compte_virtuel: 'Compte virtuel / démo',
  compte_demo: 'Compte démo Mycelium',
  pas_email: 'Pas d’e-mail en base',
  filtre_envoi: 'Filtre d’envoi actif',
}

type DeliveryFilter = 'all' | 'would_send' | 'simulation'

type Props = {
  open: boolean
  onClose: () => void
}

export function CommsEngagementAudienceModal({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AudienceData | null>(null)
  const [filterCampaign, setFilterCampaign] = useState('all')
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const loadSeq = useRef(0)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const seq = ++loadSeq.current
    setLoading(true)
    setData(null)
    void api
      .get('/api/engagement/audience')
      .then((res) => {
        if (seq !== loadSeq.current) return
        setData(res as AudienceData)
        setExpandedId(null)
      })
      .catch((err: unknown) => {
        if (seq !== loadSeq.current) return
        const msg = (err as { message?: string })?.message
        toast(msg || 'Impossible de charger les destinataires', 'error')
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoading(false)
      })
  }, [open])

  const reload = () => {
    const seq = ++loadSeq.current
    setLoading(true)
    void api
      .get('/api/engagement/audience')
      .then((res) => {
        if (seq !== loadSeq.current) return
        setData(res as AudienceData)
        setExpandedId(null)
      })
      .catch((err: unknown) => {
        if (seq !== loadSeq.current) return
        const msg = (err as { message?: string })?.message
        toast(msg || 'Impossible de charger les destinataires', 'error')
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoading(false)
      })
  }

  const filtered = useMemo(() => {
    if (!data) return []
    let list = data.recipients
    if (filterCampaign !== 'all') list = list.filter((r) => r.campaignId === filterCampaign)
    if (deliveryFilter === 'would_send') list = list.filter((r) => r.wouldDeliver)
    if (deliveryFilter === 'simulation') list = list.filter((r) => !r.wouldDeliver)
    return list
  }, [data, filterCampaign, deliveryFilter])

  if (!mounted || !open) return null

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-8 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="engagement-audience-title"
    >
      <div
        className="rounded-2xl shadow-xl w-full max-w-4xl mb-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 id="engagement-audience-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Prochaine relance automatique
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Simulation au moment du prochain passage cron — contenu personnalisé par destinataire.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? '…' : 'Actualiser'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {loading && !data && <p className="text-sm text-slate-500">Calcul des destinataires…</p>}

          {data && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Envois réels (cet env)" value={String(data.wouldSend)} highlight />
                <Stat label="Candidats file cron" value={String(data.candidates)} />
                <Stat label="Inactifs 15 j+ (base)" value={String(data.diagnostics.inactiveUsersTotal)} />
                <Stat label={`Cooldown ${data.params.cooldownHours} h`} value={String(data.diagnostics.recentlyNudgedCooldown)} />
              </div>

              {data.config?.enabled === false && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-800 dark:text-rose-200">
                  <p className="font-medium">Relances automatiques suspendues</p>
                  <p className="mt-1">
                    Aperçu informatif uniquement — la cron n&apos;enverra rien tant que les relances ne sont pas
                    réactivées dans Planification.
                  </p>
                </div>
              )}

              {data.candidates > 0 && data.wouldSend === 0 && (data.devRestricted || data.allowlistActive) && (
                <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-3 text-xs text-violet-900 dark:text-violet-200">
                  <p className="font-medium">Candidats trouvés, mais aucun envoi dans cet environnement</p>
                  <p className="mt-1 text-violet-800 dark:text-violet-300">
                    La file cron contient {data.candidates} personne(s) — affichées ci-dessous en mode{' '}
                    <strong>simulation</strong>. En production (sans allowlist,{' '}
                    <code className="text-[10px]">NOTIFICATIONS_DEV_ONLY=false</code>), les envois réels
                    correspondraient à ces profils.
                  </p>
                </div>
              )}

              {data.candidates === 0 && data.diagnostics.inactiveUsersTotal > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-600 dark:text-slate-300">
                  <p>
                    {data.diagnostics.inactiveUsersTotal} utilisateur(s) inactif(s) depuis {data.params.inactiveDays}{' '}
                    jours en base, mais aucun dans la file : probablement déjà relancé dans les{' '}
                    {data.params.cooldownHours} h (cooldown global) ou comeback déjà envoyé dans les{' '}
                    {data.params.inactiveDays} derniers jours.
                  </p>
                </div>
              )}

              {(data.devRestricted || data.allowlistActive || !data.smtpConfigured) && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  {data.devRestricted && (
                    <p>
                      <strong>Mode dev actif</strong> — seul{' '}
                      <code className="text-[10px]">DEV_NOTIFICATION_EMAIL</code> (défaut eludinart@gmail.com) reçoit
                      un envoi réel. Les autres candidats restent visibles en simulation.
                    </p>
                  )}
                  {data.allowlistActive && (
                    <p>
                      <strong>Allowlist engagement</strong> — seules les adresses listées dans{' '}
                      <code className="text-[10px]">ENGAGEMENT_REMIND_ALLOWLIST</code> sont ciblées.
                    </p>
                  )}
                  {!data.smtpConfigured && <p>SMTP non configuré — notifications in-app uniquement.</p>}
                  {data.allowlistNotFound.length > 0 && (
                    <p>Adresses allowlist introuvables en base : {data.allowlistNotFound.join(', ')}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['all', `Tous (${data.recipients.length})`],
                    ['would_send', `Envois réels (${data.wouldSend})`],
                    ['simulation', `Simulation (${data.recipients.length - data.wouldSend})`],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDeliveryFilter(id)}
                    className={`px-2.5 py-1 text-xs rounded-lg border ${
                      deliveryFilter === id
                        ? 'bg-slate-200 dark:bg-slate-700 border-slate-400 text-slate-800 dark:text-slate-100'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {Object.keys(data.byCampaign).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterCampaign('all')}
                    className={`px-2.5 py-1 text-xs rounded-lg border ${
                      filterCampaign === 'all'
                        ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-300 text-violet-700 dark:text-violet-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    Tous ({data.wouldSend})
                  </button>
                  {Object.entries(data.byCampaign).map(([id, count]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFilterCampaign(id)}
                      className={`px-2.5 py-1 text-xs rounded-lg border ${
                        filterCampaign === id
                          ? 'bg-violet-100 dark:bg-violet-900/40 border-violet-300 text-violet-700 dark:text-violet-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      {CAMPAIGN_LABELS[id] ?? id} ({count})
                    </button>
                  ))}
                </div>
              )}

              {filtered.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  {data.candidates === 0
                    ? 'Aucun candidat dans la file cron pour le prochain passage (cooldown, critères ou allowlist).'
                    : 'Aucun résultat pour ce filtre.'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  {filtered.map((r) => {
                    const open = expandedId === r.userId
                    return (
                      <li key={r.userId} className="bg-white dark:bg-slate-900">
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : r.userId)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                              {r.displayName ? `${r.displayName} — ` : ''}
                              {r.email}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">{r.locale}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                              {CAMPAIGN_LABELS[r.campaignId] ?? r.campaignId}
                            </span>
                            {r.wouldDeliver ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                envoi réel
                              </span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                simulation
                              </span>
                            )}
                            {r.wouldDeliver && r.inApp && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">🔔 in-app</span>
                            )}
                            {r.wouldDeliver && r.willSendEmail ? (
                              <span className="text-[10px] text-sky-600 dark:text-sky-400">✉️ e-mail</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">pas d&apos;e-mail</span>
                            )}
                            <span className="ml-auto text-slate-400 text-xs">{open ? '▲' : '▼'}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 truncate">{r.notification.title}</p>
                          {!r.wouldDeliver && r.skipReasons.length > 0 && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                              {r.skipReasons.map((c) => SKIP_LABELS[c] ?? c).join(' · ')}
                            </p>
                          )}
                        </button>

                        {open && (
                          <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/80 dark:bg-slate-800/30">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
                              <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">
                                Notification in-app
                              </p>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                {r.notification.title}
                              </p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-line">
                                {r.notification.body}
                              </p>
                              {r.notification.action_label && (
                                <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 font-medium">
                                  → {r.notification.action_label}
                                </p>
                              )}
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
                              <p className="text-[10px] font-semibold uppercase text-slate-400 mb-2">E-mail</p>
                              {r.willSendEmail ? (
                                <>
                                  <p className="text-xs text-slate-500">
                                    Objet :{' '}
                                    <span className="text-slate-700 dark:text-slate-200">{r.emailPreview.subject}</span>
                                  </p>
                                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-line">
                                    {r.notification.body}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-2">
                                    Mise en page HTML Jardin (pétales, CTA) identique aux modèles de la section
                                    ci-dessous.
                                  </p>
                                </>
                              ) : (
                                <ul className="text-xs text-slate-500 space-y-1">
                                  {[...r.skipReasons, ...r.emailSkipReasons]
                                    .filter((c, i, a) => a.indexOf(c) === i)
                                    .map((code) => (
                                      <li key={code}>• {SKIP_LABELS[code] ?? code}</li>
                                    ))}
                                  {r.skipReasons.length === 0 && r.emailSkipReasons.length === 0 && (
                                    <li>• E-mail non envoyé pour ce profil</li>
                                  )}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {data.generatedAt && (
                <p className="text-[10px] text-slate-400 text-right">
                  Calculé le {new Date(data.generatedAt).toLocaleString('fr-FR')}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`text-lg font-semibold ${
          highlight ? 'text-violet-700 dark:text-violet-300' : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
