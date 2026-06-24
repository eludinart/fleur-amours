'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from '@/hooks/useToast'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api-client'
import { SortableTh } from '@/components/SortableTh'
import { useTableSort } from '@/hooks/useTableSort'
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

type Channels = {
  inapp: {
    type?: string
    title: string
    body?: string
    action_url?: string
    action_label?: string
    priority?: 'low' | 'normal' | 'high' | 'urgent'
    expires_at?: string | null
  }
}

type BroadcastListItem = { id: number; title: string; status: string; created_at?: string | null }

function maskSample(sample: Array<{ user_id: number; email_masked: string }>) {
  if (!sample?.length) return '—'
  return sample.map((s) => s.email_masked).join(', ')
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

export default function AdminBroadcastsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'list' | 'compose'>('list')
  const [list, setList] = useState<{ items: BroadcastListItem[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)

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

  const [preview, setPreview] = useState<{ count: number; sample: Array<{ user_id: number; email_masked: string }> } | null>(null)
  const [sending, setSending] = useState(false)

  const resolvedAction = useMemo(
    () => resolveAdminNotificationAction(destinationId, customDestPath),
    [destinationId, customDestPath],
  )

  const destinationGroups = useMemo(() => groupAdminNotificationDestinations(), [])

  const canLaunch = useMemo(() => {
    if (!notifTitle.trim()) return false
    if (audienceSeg.audience_type === 'single') {
      const id = audienceSeg.single_user_id.trim()
      const em = audienceSeg.single_user_email.trim()
      if (!id && !em) return false
    }
    return true
  }, [notifTitle, audienceSeg])

  async function refreshList() {
    setLoading(true)
    try {
      const data = (await api.get('/api/admin/broadcasts/list?page=1&per_page=20')) as {
        items?: BroadcastListItem[]
        total?: number
      }
      setList({ items: data.items ?? [], total: data.total ?? 0 })
    } catch {
      toast('Impossible de charger les campagnes', 'error')
    }
    setLoading(false)
  }

  useEffect(() => {
    refreshList()
  }, [])

  async function doPreview() {
    try {
      const res = (await api.post('/api/admin/broadcasts/preview', { audience: audienceToPayload(audienceSeg) })) as {
        count?: number
        sample?: Array<{ user_id: number; email_masked: string }>
      }
      setPreview({ count: Number(res.count ?? 0), sample: res.sample ?? [] })
    } catch {
      toast('Prévisualisation impossible', 'error')
    }
  }

  async function createAndSend() {
    if (!canLaunch) {
      toast('Renseigne le titre de la notification et la cible', 'error')
      return
    }
    setSending(true)
    try {
      const channels: Channels = {
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
      setTab('list')
      refreshList()
    } catch (e: unknown) {
      toast((e as Error)?.message || 'Erreur envoi', 'error')
    }
    setSending(false)
  }

  const broadcastSortAccessors = useMemo(
    () => ({
      id: (b: BroadcastListItem) => b.id,
      title: (b: BroadcastListItem) => (b.title || '').toLowerCase(),
      status: (b: BroadcastListItem) => b.status || '',
      created_at: (b: BroadcastListItem) => b.created_at || '',
    }),
    [],
  )

  const { sortedItems: sortedList, sortKey, sortDir, toggleSort } = useTableSort(
    list?.items,
    broadcastSortAccessors,
    { defaultKey: 'created_at', defaultDir: 'desc' },
  )

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Campagne de notification</h1>
          <p className="text-sm text-slate-500 mt-1">
            Notifications push et in-app ciblées (utilisateurs, coachs, tout le monde ou une personne), avec lien vers une rubrique de l&apos;app. Pour les campagnes e-mail, utilisez{' '}
            <span className="font-medium text-slate-600 dark:text-slate-300">Campagnes e-mail</span>.
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        {[
          { id: 'list', label: 'Historique' },
          { id: 'compose', label: 'Composer' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as 'list' | 'compose')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors
              ${tab === t.id ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="text-sm text-slate-500">{list ? `${list.total} campagne(s)` : '—'}</div>
            <button
              type="button"
              onClick={refreshList}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Rafraîchir
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <SortableTh columnKey="id" label="ID" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh columnKey="title" label="Titre" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh columnKey="status" label="Statut" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh columnKey="created_at" label="Créée" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chargement…</td></tr>
                ) : sortedList.length > 0 ? (
                  sortedList.map((b) => (
                    <tr key={b.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono text-xs">{b.id}</td>
                      <td className="px-4 py-3">{b.title}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{b.status}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{b.created_at ? new Date(b.created_at).toLocaleString('fr-FR') : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">Aucune campagne</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'compose' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Titre interne (historique)</label>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500 mb-2">Qui recevra la notification</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {(
                  [
                    { value: 'single' as const, label: 'Une personne', hint: 'ID WordPress ou e-mail du compte' },
                    { value: 'users' as const, label: 'Tous les utilisateurs', hint: 'sans rôle coach ni admin' },
                    { value: 'coaches' as const, label: 'Tous les coachs', hint: 'rôle coach uniquement' },
                    { value: 'all' as const, label: 'Tout le monde', hint: 'tous les comptes inscrits' },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex flex-col gap-0.5 p-3 rounded-lg border cursor-pointer text-sm transition-colors
                      ${audienceSeg.audience_type === opt.value
                        ? 'border-violet-500 bg-violet-50/80 dark:bg-violet-950/30 dark:border-violet-600'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="aud"
                        checked={audienceSeg.audience_type === opt.value}
                        onChange={() => setAudienceSeg((s) => ({ ...s, audience_type: opt.value }))}
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-100">{opt.label}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 pl-6">{opt.hint}</span>
                  </label>
                ))}
              </div>
            </div>

            {audienceSeg.audience_type === 'single' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">ID utilisateur</label>
                  <input
                    value={audienceSeg.single_user_id}
                    onChange={(e) => setAudienceSeg((s) => ({ ...s, single_user_id: e.target.value }))}
                    placeholder="ex. 42"
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
                <p className="sm:col-span-2 text-[11px] text-slate-500">Au moins l&apos;un des deux champs est requis.</p>
              </div>
            )}

            {audienceSeg.audience_type === 'all' && (
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={audienceSeg.exclude_admins}
                  onChange={(e) => setAudienceSeg((s) => ({ ...s, exclude_admins: e.target.checked }))}
                />
                Exclure les comptes administrateur
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
                  <label className="block text-xs font-medium text-slate-500 mb-1">Activité (segmentation)</label>
                  <select
                    value={audienceSeg.activity}
                    onChange={(e) => setAudienceSeg((s) => ({ ...s, activity: e.target.value as AudienceSegment['activity'] }))}
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
                    onChange={(e) => setAudienceSeg((s) => ({ ...s, coach_listed: e.target.value as AudienceSegment['coach_listed'] }))}
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
              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <div><span className="font-semibold">{preview.count}</span> destinataire(s) pour cette notification</div>
                <div className="mt-1 truncate">Exemples : {maskSample(preview.sample)}</div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Contenu de la notification</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Formulaire ou page ouverte au clic
                </label>
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente (bannière)</option>
                </select>
              </div>
              {destinationId === ADMIN_NOTIFICATION_DEST_CUSTOM && (
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Chemin (ex. /session ou /clairiere)</label>
                  <input
                    value={customDestPath}
                    onChange={(e) => setCustomDestPath(e.target.value)}
                    placeholder="/ma-route"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                  />
                </div>
              )}
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Titre affiché</label>
                <input
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Message personnalisé</label>
                <textarea
                  value={notifBody}
                  onChange={(e) => setNotifBody(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="lg:col-span-2 text-xs text-slate-500">
                {resolvedAction.url ? (
                  <>
                    Au clic, l&apos;utilisateur ouvre{' '}
                    <span className="font-medium text-slate-700 dark:text-slate-300">{resolvedAction.label}</span>
                    {' '}
                    <span className="font-mono text-slate-600 dark:text-slate-400">({resolvedAction.url})</span>
                  </>
                ) : (
                  <>Au clic : aucune redirection</>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={createAndSend}
              disabled={sending || !canLaunch}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50"
            >
              {sending ? 'Envoi…' : 'Envoyer la notification'}
            </button>
            <button
              type="button"
              onClick={() => setTab('list')}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm"
            >
              Retour
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
