'use client'

import { useMemo, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api-client'
import {
  ADMIN_NOTIFICATION_DEST_CUSTOM,
  groupAdminNotificationDestinations,
  resolveAdminNotificationAction,
} from '@/lib/admin-notification-destinations'

type AudienceSegment = {
  audience_type: 'single' | 'users' | 'coaches' | 'all'
  single_user_id: string
  single_user_email: string
  activity: 'any' | 'active_7d' | 'active_30d' | 'active_90d' | 'inactive_30d' | 'inactive_90d' | 'never'
  coach_listed: 'any' | 'listed' | 'not_listed'
  exclude_admins: boolean
  exclude_emails: string[]
  respect_email_optout: boolean
}

function audienceToPayload(seg: AudienceSegment): Record<string, unknown> {
  const singleId = parseInt(seg.single_user_id.trim(), 10)
  return {
    audience_type: seg.audience_type,
    single_user_id: seg.audience_type === 'single' && Number.isFinite(singleId) && singleId > 0 ? singleId : null,
    single_user_email: seg.audience_type === 'single' ? seg.single_user_email.trim() || null : null,
    activity: seg.activity,
    coach_listed: seg.coach_listed,
    exclude_admins: seg.exclude_admins,
    exclude_emails: seg.exclude_emails,
    respect_email_optout: seg.respect_email_optout,
  }
}

function maskSample(sample: Array<{ user_id: number; email_masked: string }>) {
  if (!sample?.length) return '—'
  return sample.map((s) => s.email_masked).join(', ')
}

type Props = {
  onSent?: () => void
}

export function CommsComposeNotification({ onSent }: Props) {
  const { user } = useAuth()
  const [draftTitle, setDraftTitle] = useState('Notification ciblée')
  const [audienceSeg, setAudienceSeg] = useState<AudienceSegment>({
    audience_type: 'users',
    single_user_id: '',
    single_user_email: '',
    activity: 'any',
    coach_listed: 'any',
    exclude_admins: false,
    exclude_emails: [],
    respect_email_optout: false,
  })
  const [destinationId, setDestinationId] = useState<string>('home')
  const [customDestPath, setCustomDestPath] = useState('')
  const [notifTitle, setNotifTitle] = useState('')
  const [notifBody, setNotifBody] = useState('')
  const [notifPriority, setNotifPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [preview, setPreview] = useState<{
    count: number
    sample: Array<{ user_id: number; email_masked: string }>
  } | null>(null)
  const [sending, setSending] = useState(false)

  const resolvedAction = useMemo(
    () => resolveAdminNotificationAction(destinationId, customDestPath),
    [destinationId, customDestPath],
  )
  const destinationGroups = useMemo(() => groupAdminNotificationDestinations(), [])

  const canLaunch = useMemo(() => {
    if (!notifTitle.trim()) return false
    if (audienceSeg.audience_type === 'single') {
      if (!audienceSeg.single_user_id.trim() && !audienceSeg.single_user_email.trim()) return false
    }
    return true
  }, [notifTitle, audienceSeg])

  async function doPreview() {
    try {
      const res = (await api.post('/api/admin/broadcasts/preview', {
        audience: audienceToPayload(audienceSeg),
      })) as { count?: number; sample?: Array<{ user_id: number; email_masked: string }> }
      setPreview({ count: Number(res.count ?? 0), sample: res.sample ?? [] })
    } catch {
      toast('Prévisualisation impossible', 'error')
    }
  }

  async function createAndSend() {
    if (!canLaunch) {
      toast('Renseignez le titre et la cible', 'error')
      return
    }
    setSending(true)
    try {
      const channels = {
        inapp: {
          type: 'admin_announcement',
          title: notifTitle.trim(),
          body: notifBody.trim() || undefined,
          action_url: resolvedAction.url ?? undefined,
          action_label: resolvedAction.url ? resolvedAction.label || 'Ouvrir' : undefined,
          priority: notifPriority,
        },
      }
      const created = (await api.post('/api/admin/broadcasts/create', {
        title: draftTitle,
        audience: audienceToPayload(audienceSeg),
        channels,
        created_by: (user as { id?: number })?.id,
      })) as { id?: number }
      const id = Number(created.id ?? 0)
      if (!id) throw new Error('Création impossible')
      await api.post('/api/admin/broadcasts/send', { id, batchSize: 100 })
      toast('Notifications envoyées', 'success')
      setNotifTitle('')
      setNotifBody('')
      onSent?.()
    } catch (e: unknown) {
      toast((e as Error)?.message || 'Erreur envoi', 'error')
    }
    setSending(false)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-sm" aria-hidden>
                📝
              </span>
              Contenu
            </h2>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Titre affiché dans la cloche *</label>
              <input
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="Ex. Nouvelle fonctionnalité disponible"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Message (optionnel)</label>
              <textarea
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
                rows={3}
                placeholder="Texte complémentaire visible dans le centre de notifications"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 resize-y focus:ring-2 focus:ring-violet-500/30 outline-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Destination au clic</label>
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {destinationGroups.map(({ group, items }) => (
                    <optgroup key={group} label={group}>
                      {items.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value={ADMIN_NOTIFICATION_DEST_CUSTOM}>Chemin personnalisé…</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Priorité</label>
                <select
                  value={notifPriority}
                  onChange={(e) => setNotifPriority(e.target.value as typeof notifPriority)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente (bannière)</option>
                </select>
              </div>
              {destinationId === ADMIN_NOTIFICATION_DEST_CUSTOM && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Chemin personnalisé</label>
                  <input
                    value={customDestPath}
                    onChange={(e) => setCustomDestPath(e.target.value)}
                    placeholder="/session"
                    className="w-full px-3 py-2.5 text-sm rounded-xl border font-mono border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sm" aria-hidden>
                👥
              </span>
              Destinataires
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(
                [
                  { value: 'single' as const, label: 'Une personne', hint: 'ID ou e-mail' },
                  { value: 'users' as const, label: 'Utilisateurs', hint: 'sans coach ni admin' },
                  { value: 'coaches' as const, label: 'Coachs', hint: 'rôle accompagnant' },
                  { value: 'all' as const, label: 'Tout le monde', hint: 'tous les comptes' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex flex-col gap-0.5 p-3 rounded-xl border cursor-pointer text-sm transition-all
                    ${audienceSeg.audience_type === opt.value
                      ? 'border-violet-500 bg-violet-50/80 dark:bg-violet-950/30 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="notif-aud"
                      checked={audienceSeg.audience_type === opt.value}
                      onChange={() => {
                        setAudienceSeg((s) => ({ ...s, audience_type: opt.value }))
                        setPreview(null)
                      }}
                    />
                    <span className="font-medium">{opt.label}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 pl-6">{opt.hint}</span>
                </label>
              ))}
            </div>

            {audienceSeg.audience_type === 'single' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">ID utilisateur</label>
                  <input
                    value={audienceSeg.single_user_id}
                    onChange={(e) => setAudienceSeg((s) => ({ ...s, single_user_id: e.target.value }))}
                    placeholder="42"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Ou e-mail</label>
                  <input
                    type="email"
                    value={audienceSeg.single_user_email}
                    onChange={(e) => setAudienceSeg((s) => ({ ...s, single_user_email: e.target.value }))}
                    placeholder="user@exemple.org"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            )}

            {audienceSeg.audience_type === 'all' && (
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={audienceSeg.exclude_admins}
                  onChange={(e) => setAudienceSeg((s) => ({ ...s, exclude_admins: e.target.checked }))}
                />
                Exclure les administrateurs
              </label>
            )}

            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              {advancedOpen ? '▼ Masquer filtres avancés' : '▶ Filtres avancés (activité, coach listé)'}
            </button>

            {advancedOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Activité</label>
                  <select
                    value={audienceSeg.activity}
                    onChange={(e) =>
                      setAudienceSeg((s) => ({ ...s, activity: e.target.value as AudienceSegment['activity'] }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="any">Tous</option>
                    <option value="active_7d">Actifs &lt; 7j</option>
                    <option value="active_30d">Actifs &lt; 30j</option>
                    <option value="active_90d">Actifs &lt; 90j</option>
                    <option value="inactive_30d">Inactifs &gt; 30j</option>
                    <option value="inactive_90d">Inactifs &gt; 90j</option>
                    <option value="never">Jamais connecté</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Coach listé</label>
                  <select
                    value={audienceSeg.coach_listed}
                    onChange={(e) =>
                      setAudienceSeg((s) => ({ ...s, coach_listed: e.target.value as AudienceSegment['coach_listed'] }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="any">Indifférent</option>
                    <option value="listed">Listés</option>
                    <option value="not_listed">Non listés</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 items-center">
              <button
                type="button"
                onClick={doPreview}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Estimer la cible
              </button>
            </div>
            {preview && (
              <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                <strong>{preview.count}</strong> destinataire(s) — ex. {maskSample(preview.sample)}
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-4 sticky top-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Aperçu cloche</p>
            <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
              <div className="flex gap-3 items-start">
                <span className="text-lg shrink-0" aria-hidden>
                  🔔
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {notifTitle || 'Titre de la notification'}
                  </p>
                  {notifBody ? (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-3">{notifBody}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1 italic">Message optionnel</p>
                  )}
                  {resolvedAction.url ? (
                    <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 font-medium">
                      → {resolvedAction.label || 'Ouvrir'}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-500 mb-1">Titre interne (historique)</label>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <button
              type="button"
              onClick={createAndSend}
              disabled={sending || !canLaunch}
              className="mt-4 w-full px-4 py-3 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Envoi…' : 'Envoyer la notification'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
