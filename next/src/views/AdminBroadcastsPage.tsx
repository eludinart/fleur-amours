'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { toast } from '@/hooks/useToast'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api-client'

const EmailEditor = dynamic(() => import('react-email-editor').then((m) => m.EmailEditor as unknown as React.ComponentType<any>), {
  ssr: false,
})

type Audience = {
  audience_type: 'users' | 'coaches' | 'all'
  activity: 'any' | 'active_7d' | 'active_30d' | 'active_90d' | 'inactive_30d' | 'inactive_90d' | 'never'
  coach_listed: 'any' | 'listed' | 'not_listed'
  exclude_admins: boolean
  exclude_emails: string[]
  respect_email_optout: boolean
}

type Channels = {
  email?: {
    subject: string
    preheader?: string
    from_name?: string
    from_email?: string
    reply_to?: string
    design_json?: unknown
    html?: string
    text?: string
  }
  inapp?: {
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

export default function AdminBroadcastsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'list' | 'compose'>('list')
  const [list, setList] = useState<{ items: BroadcastListItem[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const [draftTitle, setDraftTitle] = useState('Nouvelle diffusion')
  const [audience, setAudience] = useState<Audience>({
    audience_type: 'all',
    activity: 'any',
    coach_listed: 'any',
    exclude_admins: true,
    exclude_emails: [],
    respect_email_optout: true,
  })
  const [channels, setChannels] = useState<Channels>({
    email: { subject: '' },
    inapp: { title: '', priority: 'normal' },
  })
  const [preview, setPreview] = useState<{ count: number; sample: Array<{ user_id: number; email_masked: string }> } | null>(null)
  const [sending, setSending] = useState(false)

  const [editorRef, setEditorRef] = useState<any>(null)

  const canSend = useMemo(() => {
    const hasEmail = !!channels.email?.subject?.trim()
    const hasInapp = !!channels.inapp?.title?.trim()
    return hasEmail || hasInapp
  }, [channels])

  async function refreshList() {
    setLoading(true)
    try {
      const data = (await api.get('/api/admin/broadcasts/list?page=1&per_page=20')) as {
        items?: BroadcastListItem[]
        total?: number
      }
      setList({ items: data.items ?? [], total: data.total ?? 0 })
    } catch (e) {
      toast('Impossible de charger les diffusions', 'error')
    }
    setLoading(false)
  }

  useEffect(() => {
    refreshList()
  }, [])

  async function doPreview() {
    try {
      const res = (await api.post('/api/admin/broadcasts/preview', { audience })) as any
      setPreview({ count: Number(res.count ?? 0), sample: (res.sample ?? []) as any[] })
    } catch {
      toast('Preview impossible', 'error')
    }
  }

  async function exportEmailHtml(): Promise<{ design: unknown | null; html: string | null }> {
    if (!editorRef) return { design: null, html: null }
    const editor = editorRef.editor
    if (!editor?.exportHtml) return { design: null, html: null }
    return await new Promise((resolve) => {
      editor.exportHtml((data: any) => {
        resolve({ design: data?.design ?? null, html: data?.html ?? null })
      })
    })
  }

  async function createAndSend() {
    if (!canSend) {
      toast('Active au moins un canal (Email ou In-app)', 'error')
      return
    }
    setSending(true)
    try {
      const emailExport = await exportEmailHtml()
      const payloadChannels: Channels = {
        ...channels,
        email: channels.email
          ? {
              ...channels.email,
              design_json: emailExport.design ?? channels.email.design_json,
              html: emailExport.html ?? channels.email.html,
            }
          : undefined,
      }
      const created = (await api.post('/api/admin/broadcasts/create', {
        title: draftTitle,
        audience,
        channels: payloadChannels,
        created_by: (user as any)?.id,
      })) as { id?: number }
      const id = Number(created.id ?? 0)
      if (!id) throw new Error('Création impossible')

      await api.post('/api/admin/broadcasts/enqueue', { id })
      // Process a few batches right away (simple UX)
      await api.post('/api/admin/broadcasts/worker', { id, limit: 80 })
      await api.post('/api/admin/broadcasts/worker', { id, limit: 80 })

      toast('Diffusion lancée', 'success')
      setTab('list')
      refreshList()
    } catch (e: any) {
      toast(e?.message || 'Erreur envoi', 'error')
    }
    setSending(false)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Diffusions</h1>
          <p className="text-sm text-slate-500 mt-1">Envoyer emails et notifications aux utilisateurs et coachs.</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        {[
          { id: 'list', label: 'Historique' },
          { id: 'compose', label: 'Composer' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors
              ${tab === (t.id as any) ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="text-sm text-slate-500">{list ? `${list.total} diffusion(s)` : '—'}</div>
            <button
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
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">ID</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Titre</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Créée</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chargement…</td></tr>
                ) : (list?.items?.length ?? 0) > 0 ? (
                  list!.items.map((b) => (
                    <tr key={b.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-mono text-xs">{b.id}</td>
                      <td className="px-4 py-3">{b.title}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{b.status}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{b.created_at ? new Date(b.created_at).toLocaleString('fr-FR') : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">Aucune diffusion</td></tr>
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
              <label className="block text-xs font-medium text-slate-500 mb-1">Titre (interne)</label>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Cible</label>
                <select
                  value={audience.audience_type}
                  onChange={(e) => setAudience((a) => ({ ...a, audience_type: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="all">Tous</option>
                  <option value="users">Utilisateurs</option>
                  <option value="coaches">Coachs</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Activité</label>
                <select
                  value={audience.activity}
                  onChange={(e) => setAudience((a) => ({ ...a, activity: e.target.value as any }))}
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
                  value={audience.coach_listed}
                  onChange={(e) => setAudience((a) => ({ ...a, coach_listed: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="any">Indifférent</option>
                  <option value="listed">Listés</option>
                  <option value="not_listed">Non listés</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={audience.exclude_admins}
                  onChange={(e) => setAudience((a) => ({ ...a, exclude_admins: e.target.checked }))}
                />
                Exclure admins
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={audience.respect_email_optout}
                  onChange={(e) => setAudience((a) => ({ ...a, respect_email_optout: e.target.checked }))}
                />
                Respecter désinscription email
              </label>
              <button
                onClick={doPreview}
                className="ml-auto px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Prévisualiser la cible
              </button>
            </div>
            {preview && (
              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <div><span className="font-semibold">{preview.count}</span> destinataire(s)</div>
                <div className="mt-1 truncate">Exemples: {maskSample(preview.sample)}</div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Email (SMTP)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Sujet</label>
                <input
                  value={channels.email?.subject ?? ''}
                  onChange={(e) => setChannels((c) => ({ ...c, email: { ...(c.email ?? { subject: '' }), subject: e.target.value } }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Reply-to (optionnel)</label>
                <input
                  value={channels.email?.reply_to ?? ''}
                  onChange={(e) => setChannels((c) => ({ ...c, email: { ...(c.email ?? { subject: '' }), reply_to: e.target.value } }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                Éditeur blocs (WYSIWYG) — le HTML généré sera envoyé via SMTP Hostinger.
              </div>
              <div className="h-[520px] bg-white">
                <EmailEditor
                  onLoad={(editor: any) => setEditorRef(editor)}
                  minHeight="520px"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notification in‑app (bannière + centre)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Titre</label>
                <input
                  value={channels.inapp?.title ?? ''}
                  onChange={(e) => setChannels((c) => ({ ...c, inapp: { ...(c.inapp ?? { title: '' }), title: e.target.value } }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Priorité</label>
                <select
                  value={channels.inapp?.priority ?? 'normal'}
                  onChange={(e) => setChannels((c) => ({ ...c, inapp: { ...(c.inapp ?? { title: '' }), priority: e.target.value as any } }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente (bannière)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Message</label>
              <textarea
                value={channels.inapp?.body ?? ''}
                onChange={(e) => setChannels((c) => ({ ...c, inapp: { ...(c.inapp ?? { title: '' }), body: e.target.value } }))}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Lien (optionnel)</label>
                <input
                  value={channels.inapp?.action_url ?? ''}
                  onChange={(e) => setChannels((c) => ({ ...c, inapp: { ...(c.inapp ?? { title: '' }), action_url: e.target.value } }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Libellé bouton</label>
                <input
                  value={channels.inapp?.action_label ?? ''}
                  onChange={(e) => setChannels((c) => ({ ...c, inapp: { ...(c.inapp ?? { title: '' }), action_label: e.target.value } }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={createAndSend}
              disabled={sending}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50"
            >
              {sending ? 'Envoi…' : 'Lancer la diffusion'}
            </button>
            <button
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

