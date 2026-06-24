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

const ROLE_OPTIONS: Array<{ value: AudienceMode; label: string; hint: string }> = [
  { value: 'all', label: 'Tous', hint: 'Comptes avec e-mail' },
  { value: 'users', label: 'Utilisateurs', hint: 'Sans coach ni admin' },
  { value: 'coaches', label: 'Coachs', hint: 'Accompagnants' },
  { value: 'admins', label: 'Admins', hint: 'Administrateurs' },
  { value: 'selected', label: 'Sélection', hint: 'Personnes choisies' },
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

type Props = {
  smtpOk: boolean | null
  onSent?: () => void
}

export function CommsComposeEmail({ smtpOk, onSent }: Props) {
  const { user } = useAuth()
  const [draftTitle, setDraftTitle] = useState('Campagne e-mail')
  const [subject, setSubject] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [preheader, setPreheader] = useState('')
  const [audienceMode, setAudienceMode] = useState<AudienceMode>('users')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<UserRow[]>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [preview, setPreview] = useState<{
    count: number
    sample: Array<{ user_id: number; email_masked: string }>
  } | null>(null)
  const [sending, setSending] = useState(false)
  const emailEditorRef = useRef<EditorRef>(null)
  const [editorReady, setEditorReady] = useState(false)

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
    if (!subject.trim() || !smtpOk) return false
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

  function toggleUser(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function sendCampaign() {
    if (!canSend) {
      if (!smtpOk) toast('SMTP non configuré', 'error')
      else toast('Renseignez le sujet et la cible', 'error')
      return
    }
    setSending(true)
    try {
      const exported = await exportHtml()
      if (!exported.html?.trim()) {
        toast(
          editorReady ? 'Contenu HTML vide' : 'Éditeur non prêt — patientez puis réessayez',
          'error',
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
        toast(result.errors?.[0] || 'Aucun e-mail envoyé', 'error')
      } else {
        toast(`${processed} envoi(s) — ${status}`, 'success')
        setSubject('')
        onSent?.()
      }
    } catch (e: unknown) {
      toast((e as Error)?.message || 'Erreur lors de l\'envoi', 'error')
    }
    setSending(false)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-sm" aria-hidden>
              ✉️
            </span>
            En-tête e-mail
          </h2>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Sujet *</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Pré-en-tête</label>
              <input
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reply-to</label>
              <input
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="contact@…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Titre interne (historique)</label>
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sm" aria-hidden>
              👥
            </span>
            Destinataires
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setAudienceMode(opt.value)
                  setPreview(null)
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                  ${audienceMode === opt.value
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                title={opt.hint}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {audienceMode === 'selected' && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className="text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200"
                    >
                      {u.name || u.email} ×
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-36 overflow-y-auto rounded-lg border dark:border-slate-700 divide-y dark:divide-slate-800 text-sm">
                {searchBusy ? (
                  <p className="p-2 text-xs text-slate-400">Recherche…</p>
                ) : (
                  userResults.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleUser(u.id)} />
                      <span className="truncate text-xs">{u.name || u.email}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button type="button" onClick={doPreview} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              Estimer
            </button>
            {preview && (
              <span className="text-xs text-slate-500">
                <strong>{preview.count}</strong> destinataire(s)
              </span>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span>Éditeur visuel HTML — une notification in-app accompagne chaque e-mail</span>
          {!editorReady && <span className="text-amber-600 animate-pulse">Chargement éditeur…</span>}
        </div>
        <div className="h-[420px] lg:h-[min(560px,calc(100vh-16rem))] bg-white">
          <EmailEditor ref={emailEditorRef} minHeight="100%" onReady={() => setEditorReady(true)} />
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={sendCampaign}
          disabled={sending || !canSend}
          className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {sending ? 'Envoi en cours…' : 'Envoyer la campagne e-mail'}
        </button>
      </div>
    </div>
  )
}
