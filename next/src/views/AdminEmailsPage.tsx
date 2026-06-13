'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { EditorRef } from 'react-email-editor'
import { toast } from '@/hooks/useToast'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api-client'

const EmailEditor = dynamic(() => import('react-email-editor'), { ssr: false })

type AudienceMode = 'all' | 'users' | 'coaches' | 'admins' | 'selected'

type UserRow = { id: number; email: string; name: string; app_role: string }

type BroadcastRow = { id: number; title: string; status: string; created_at?: string | null }

const ROLE_OPTIONS: Array<{ value: AudienceMode; label: string; hint: string }> = [
  { value: 'all', label: 'Tous les utilisateurs', hint: 'Tous les comptes avec une adresse e-mail' },
  { value: 'users', label: 'Utilisateurs', hint: 'Sans rôle coach ni admin' },
  { value: 'coaches', label: 'Coachs', hint: 'Rôle accompagnant uniquement' },
  { value: 'admins', label: 'Administrateurs', hint: 'Rôle admin uniquement' },
  { value: 'selected', label: 'Sélection individuelle', hint: 'Choisir une ou plusieurs personnes' },
]

function audiencePayload(mode: AudienceMode, selectedIds: number[]) {
  if (mode === 'selected') {
    return {
      audience_type: 'selected' as const,
      selected_user_ids: selectedIds,
      activity: 'any' as const,
      coach_listed: 'any' as const,
      exclude_admins: false,
      exclude_emails: [] as string[],
      respect_email_optout: true,
    }
  }
  return {
    audience_type: mode,
    activity: 'any' as const,
    coach_listed: 'any' as const,
    exclude_admins: mode === 'all',
    exclude_emails: [] as string[],
    respect_email_optout: true,
  }
}

export default function AdminEmailsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'compose' | 'history'>('compose')
  const [smtpOk, setSmtpOk] = useState<boolean | null>(null)
  const [smtpFrom, setSmtpFrom] = useState<string | null>(null)
  const [testBusy, setTestBusy] = useState(false)

  const [draftTitle, setDraftTitle] = useState('Campagne e-mail')
  const [subject, setSubject] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [preheader, setPreheader] = useState('')
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('users')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<UserRow[]>([])
  const [searchBusy, setSearchBusy] = useState(false)

  const [preview, setPreview] = useState<{ count: number; sample: Array<{ user_id: number; email_masked: string }> } | null>(null)
  const [sending, setSending] = useState(false)

  const [history, setHistory] = useState<{ items: BroadcastRow[]; total: number } | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const emailEditorRef = useRef<EditorRef>(null)
  const [editorReady, setEditorReady] = useState(false)

  const loadSmtpStatus = useCallback(async () => {
    try {
      const data = (await api.get('/api/admin/system-status')) as { smtp?: { configured?: boolean; from?: string | null } }
      setSmtpOk(!!data.smtp?.configured)
      setSmtpFrom(data.smtp?.from ?? null)
    } catch {
      setSmtpOk(false)
    }
  }, [])

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = (await api.get('/api/admin/broadcasts/list?page=1&per_page=30')) as {
        items?: BroadcastRow[]
        total?: number
      }
      setHistory({ items: data.items ?? [], total: data.total ?? 0 })
    } catch {
      toast('Impossible de charger l\'historique', 'error')
    }
    setHistoryLoading(false)
  }, [])

  useEffect(() => {
    loadSmtpStatus()
    refreshHistory()
  }, [loadSmtpStatus, refreshHistory])

  const searchUsers = useCallback(async (q: string) => {
    setSearchBusy(true)
    try {
      const params = new URLSearchParams({ limit: '60' })
      if (q.trim()) params.set('q', q.trim())
      const data = (await api.get(`/api/admin/users/search?${params}`)) as { items?: UserRow[] }
      setUserResults(data.items ?? [])
    } catch {
      setUserResults([])
    }
    setSearchBusy(false)
  }, [])

  useEffect(() => {
    if (audienceMode !== 'selected') return
    const t = setTimeout(() => searchUsers(userSearch), 300)
    return () => clearTimeout(t)
  }, [audienceMode, userSearch, searchUsers])

  const selectedUsers = useMemo(() => {
    const map = new Map(userResults.map((u) => [u.id, u]))
    return selectedIds.map((id) => map.get(id) ?? { id, email: `#${id}`, name: '', app_role: '' })
  }, [selectedIds, userResults])

  const canSend = useMemo(() => {
    if (!subject.trim()) return false
    if (!smtpOk) return false
    if (audienceMode === 'selected' && selectedIds.length === 0) return false
    return true
  }, [subject, smtpOk, audienceMode, selectedIds])

  async function exportHtml(): Promise<{ design: unknown | null; html: string | null }> {
    const editor = emailEditorRef.current?.editor
    if (!editor?.exportHtml) return { design: null, html: null }
    return new Promise((resolve) => {
      editor.exportHtml((data: { design?: unknown; html?: string }) => {
        resolve({ design: data?.design ?? null, html: data?.html ?? null })
      })
    })
  }

  async function doPreview() {
    try {
      const res = (await api.post('/api/admin/broadcasts/preview', {
        audience: audiencePayload(audienceMode, selectedIds),
      })) as { count?: number; sample?: Array<{ user_id: number; email_masked: string }> }
      setPreview({ count: Number(res.count ?? 0), sample: res.sample ?? [] })
    } catch {
      toast('Prévisualisation impossible', 'error')
    }
  }

  async function sendTestEmail() {
    setTestBusy(true)
    try {
      await api.post('/api/admin/smtp-test', {})
      toast('E-mail de test envoyé à votre adresse admin', 'success')
    } catch (e: unknown) {
      toast((e as Error)?.message || 'Échec du test SMTP', 'error')
    }
    setTestBusy(false)
  }

  function toggleUser(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function sendCampaign() {
    if (!canSend) {
      if (!smtpOk) toast('Configurez SMTP dans docker-compose.env puis redémarrez le serveur', 'error')
      else toast('Renseignez le sujet et la cible', 'error')
      return
    }
    setSending(true)
    try {
      const exported = await exportHtml()
      if (!exported.html?.trim()) {
        toast(
          editorReady
            ? 'Le contenu HTML est vide — complétez l\'éditeur'
            : 'Éditeur non prêt — attendez le chargement complet puis réessayez',
          'error'
        )
        setSending(false)
        return
      }

      const channels: Record<string, unknown> = {
        email: {
          subject: subject.trim(),
          preheader: preheader.trim() || undefined,
          reply_to: replyTo.trim() || undefined,
          design_json: exported.design,
          html: exported.html,
        },
      }

      const created = (await api.post('/api/admin/broadcasts/create', {
        title: draftTitle,
        audience: audiencePayload(audienceMode, selectedIds),
        channels,
        created_by: (user as { id?: number })?.id,
      })) as { id?: number }

      const id = Number(created.id ?? 0)
      if (!id) throw new Error('Création impossible')

      const result = (await api.post('/api/admin/broadcasts/send', { id, batchSize: 100 })) as {
        processed?: number
        status?: string
        errors?: string[]
      }

      const processed = Number(result.processed ?? 0)
      const status = result.status ?? ''
      if (status === 'failed' || processed === 0) {
        toast(result.errors?.[0] || 'Aucun e-mail envoyé — vérifiez SMTP et la cible', 'error')
      } else {
        toast(`${processed} envoi(s) traité(s) — statut : ${status}`, 'success')
        setTab('history')
        refreshHistory()
      }
    } catch (e: unknown) {
      toast((e as Error)?.message || 'Erreur lors de l\'envoi', 'error')
    }
    setSending(false)
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Campagnes e-mail</h1>
        <p className="text-sm text-slate-500 mt-1">
          Un e-mail HTML par destinataire, plus une notification in-app avec aperçu et lien « Voir le message ».
        </p>
      </div>

      <div
        className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${
          smtpOk
            ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/30'
            : 'border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30'
        }`}
      >
        <div className="text-sm">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            SMTP : {smtpOk === null ? '…' : smtpOk ? 'configuré' : 'non configuré'}
          </span>
          {smtpFrom ? (
            <span className="block text-xs text-slate-500 mt-0.5">Expéditeur : {smtpFrom}</span>
          ) : null}
          {!smtpOk && smtpOk !== null ? (
            <p className="text-xs text-amber-800 dark:text-amber-200 mt-1 max-w-xl">
              Ajoutez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS et SMTP_FROM dans{' '}
              <code className="font-mono">docker-compose.env</code> (ou <code className="font-mono">.env</code> en
              local), puis redémarrez le serveur (<code className="font-mono">npm run dev.vps</code> ou le conteneur
              Next.js).
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadSmtpStatus}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
          >
            Rafraîchir
          </button>
          <button
            type="button"
            disabled={!smtpOk || testBusy}
            onClick={sendTestEmail}
            className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white disabled:opacity-50"
          >
            {testBusy ? 'Envoi…' : 'Test SMTP (mon e-mail)'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        {[
          { id: 'compose' as const, label: 'Composer' },
          { id: 'history' as const, label: 'Historique' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors
              ${tab === t.id ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <span className="text-sm text-slate-500">{history ? `${history.total} campagne(s)` : '—'}</span>
            <button type="button" onClick={refreshHistory} className="text-xs px-3 py-1.5 rounded-lg border">
              Rafraîchir
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Titre</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Créée</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chargement…</td></tr>
              ) : (history?.items.length ?? 0) > 0 ? (
                history!.items.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-mono text-xs">{b.id}</td>
                    <td className="px-4 py-3">{b.title}</td>
                    <td className="px-4 py-3 text-xs">{b.status}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {b.created_at ? new Date(b.created_at).toLocaleString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">Aucune campagne</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'compose' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 rounded-xl border p-5 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Titre interne (historique)</label>
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Sujet de l&apos;e-mail *</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Pré-en-tête (optionnel)</label>
                <input
                  value={preheader}
                  onChange={(e) => setPreheader(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Reply-to (optionnel)</label>
                <input
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="contact@votredomaine.com"
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Destinataires</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex flex-col gap-0.5 p-3 rounded-lg border cursor-pointer text-sm transition-colors
                    ${audienceMode === opt.value
                      ? 'border-violet-500 bg-violet-50/80 dark:bg-violet-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="audience"
                      checked={audienceMode === opt.value}
                      onChange={() => {
                        setAudienceMode(opt.value)
                        setPreview(null)
                      }}
                    />
                    <span className="font-medium">{opt.label}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 pl-6">{opt.hint}</span>
                </label>
              ))}
            </div>

            {audienceMode === 'selected' && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Rechercher par nom ou e-mail…"
                  className="w-full px-3 py-2 text-sm rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                {selectedIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleUser(u.id)}
                        className="text-xs px-2 py-1 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200"
                      >
                        {u.name || u.email} ×
                      </button>
                    ))}
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto rounded-lg border dark:border-slate-700 divide-y dark:divide-slate-800">
                  {searchBusy ? (
                    <p className="p-3 text-xs text-slate-400">Recherche…</p>
                  ) : userResults.length === 0 ? (
                    <p className="p-3 text-xs text-slate-400">Aucun utilisateur</p>
                  ) : (
                    userResults.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(u.id)}
                          onChange={() => toggleUser(u.id)}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="font-medium block truncate">{u.name || u.email}</span>
                          <span className="text-xs text-slate-500">{u.email} · {u.app_role}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 items-center">
              <button type="button" onClick={doPreview} className="px-3 py-1.5 text-sm rounded-lg border">
                Estimer le nombre de destinataires
              </button>
            </div>
            {preview && (
              <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-lg p-3 border">
                <strong>{preview.count}</strong> destinataire(s)
                {preview.sample.length > 0 && (
                  <> — ex. {preview.sample.map((s) => s.email_masked).join(', ')}</>
                )}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border overflow-hidden">
            <div className="p-3 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 border-b">
              Éditeur visuel HTML — glissez des blocs, images et textes.
            </div>
            <div className="h-[480px] lg:h-[min(640px,calc(100vh-14rem))] bg-white">
              <EmailEditor
                ref={emailEditorRef}
                minHeight="100%"
                onReady={() => setEditorReady(true)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={sendCampaign}
              disabled={sending || !canSend}
              className="px-6 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              {sending ? 'Envoi en cours…' : 'Envoyer la campagne'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
