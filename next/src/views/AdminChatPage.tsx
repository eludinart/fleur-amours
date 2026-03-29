'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { chatApi } from '@/api/chat'
import { t } from '@/i18n'
import { useAuth } from '@/contexts/AuthContext'

function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return "à l'instant"
  if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`
  if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type Conversation = {
  id: number
  user_id?: number
  user_email?: string
  status?: string
  closed_by_role?: string | null
  assigned_coach_id?: number | null
  /** display_name WordPress du coach assigné (LEFT JOIN users) */
  assigned_coach_display_name?: string | null
  unread_count?: number
  last_message_at?: string
  created_at?: string
}

type StaffKind = 'user' | 'assigned_coach' | 'admin' | 'coach_other'

type Message = {
  id: string | number
  conversation_id?: number
  sender_id?: number
  sender_role?: string
  sender_display_name?: string | null
  staff_kind?: StaffKind
  content?: string
  created_at?: string
  _optimistic?: boolean
}

function effectiveStaffKind(m: Message): StaffKind {
  if (m.staff_kind) return m.staff_kind
  if (m.sender_role === 'user') return 'user'
  return 'assigned_coach'
}

function staffBubbleClasses(kind: StaffKind, isStaff: boolean): string {
  if (!isStaff) {
    return 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-md'
  }
  if (kind === 'admin') {
    return 'bg-amber-600 dark:bg-amber-700 text-white rounded-br-md border border-amber-700/40'
  }
  if (kind === 'coach_other') {
    return 'bg-indigo-600 dark:bg-indigo-700 text-white rounded-br-md border border-indigo-700/40'
  }
  return 'bg-violet-600 text-white rounded-br-md'
}

function staffFooterText(kind: StaffKind, m: Message): string {
  const name = (m.sender_display_name ?? '').trim() || t('chat.staffBubbleCoachNoName')
  if (kind === 'admin') return `${t('chat.staffBubbleAdmin', { name })} · `
  if (kind === 'coach_other') return `${t('chat.staffBubbleCoachOther', { name })} · `
  return `${t('chat.staffBubbleAssignedCoach', { name })} · `
}

export default function AdminChatPage() {
  const searchParams = useSearchParams()
  const emailParam = searchParams?.get('email') ?? null
  const { isAdmin, isCoach, user } = useAuth()
  const myUserId = user && typeof user.id === 'number' ? user.id : Number(user?.id ?? 0)
  const myName =
    user && typeof user.name === 'string'
      ? user.name
      : typeof user?.display_name === 'string'
        ? user.display_name
        : ''
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [sending, setSending] = useState(false)
  const [statusFilter, setStatusFilter] = useState('open')
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMsgAt = useRef<string | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const listPollSlowRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshListAfterSendRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (refreshListAfterSendRef.current) clearTimeout(refreshListAfterSendRef.current)
    }
  }, [])
  const initReadDoneRef = useRef(false)
  /** Conversation ouverte : le poll liste ne doit pas réinjecter un badge « non lu » serveur (course markRead / timing). */
  const selectedIdRef = useRef<number | null>(null)
  /** Ignore les réponses API messages si l’utilisateur a changé de conversation entre-temps. */
  const messagesTargetConvRef = useRef<number | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const effectiveStatus = emailParam ? '' : statusFilter
  const listPerPage = emailParam ? 500 : 50
  /** Une tentative ensure_for_patient par navigation email (évite boucles). */
  const ensurePatientAttemptedRef = useRef(false)

  const loadConversations = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoadingConvs(true)
    chatApi
      .listConversations({ status: effectiveStatus, per_page: listPerPage })
      .then((res) => {
        const items = (res as { items?: Conversation[] })?.items ?? []
        const openId = selectedIdRef.current
        const merged =
          openId != null
            ? items.map((c) => (c.id === openId ? { ...c, unread_count: 0 } : c))
            : items
        setConversations(merged)
        setSelected((prev) => {
          if (!prev) return prev
          const row = merged.find((c) => c.id === prev.id)
          return row ? { ...prev, ...row } : prev
        })
      })
      .catch(() => {
        if (!opts?.silent) setConversations([])
      })
      .finally(() => {
        if (!opts?.silent) setLoadingConvs(false)
      })
  }, [effectiveStatus, listPerPage])

  useEffect(() => {
    ensurePatientAttemptedRef.current = false
  }, [emailParam])

  // Patient depuis le suivi : créer / rattacher la conv si absente de la liste (jamais ouverte côté patient, ou autre coach).
  useEffect(() => {
    if (!emailParam?.trim()) return
    if (loadingConvs) return
    if (!isAdmin && !isCoach) return
    const email = emailParam.toLowerCase().trim()
    const hasMatch = conversations.some((c) => (c.user_email ?? '').toLowerCase() === email)
    if (hasMatch) return
    if (ensurePatientAttemptedRef.current) return
    ensurePatientAttemptedRef.current = true
    setError('')
    void chatApi
      .ensureForPatient(emailParam.trim())
      .then(() => loadConversations({ silent: true }))
      .catch((err: unknown) => {
        const ex = err as { detail?: string; message?: string }
        setError(
          (ex.detail || ex.message || '').trim() ||
            'Impossible d’ouvrir le chat pour ce patient.'
        )
      })
  }, [
    emailParam,
    loadingConvs,
    conversations,
    isAdmin,
    isCoach,
    loadConversations,
  ])

  // Init : pour éviter d'afficher d'anciens messages comme "non lus"
  // après mise en place du suivi (coach_last_read_at == NULL).
  useEffect(() => {
    if (initReadDoneRef.current) return
    if (emailParam) return
    if (!user) return
    if (!isAdmin && !isCoach) return

    initReadDoneRef.current = true
    void chatApi
      .markAllRead()
      .then(() => loadConversations())
      .catch(() => {
        /* ignore */
      })
  }, [emailParam, isAdmin, isCoach, user, loadConversations])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (listPollSlowRef.current) clearInterval(listPollSlowRef.current)
    const ms = selected?.id ? 30000 : 20000
    listPollSlowRef.current = setInterval(() => loadConversations({ silent: true }), ms)
    return () => {
      if (listPollSlowRef.current) clearInterval(listPollSlowRef.current)
    }
  }, [loadConversations, selected?.id])

  // Ne pas setSelected(match) si l’id est déjà le bon : une nouvelle référence relançait l’effet
  // [selected] → setConversations → conversations → boucle "Maximum update depth".
  useEffect(() => {
    if (!emailParam || conversations.length === 0) return
    const email = emailParam.toLowerCase().trim()
    const match = conversations.find((c) => (c.user_email ?? '').toLowerCase() === email)
    if (!match) return
    setSelected((prev) => (prev?.id === match.id ? prev : match))
  }, [emailParam, conversations])

  const loadMessages = useCallback(async (convId: number, since: string | null) => {
    try {
      const res = await chatApi.messages(String(convId), since ?? undefined)
      if (messagesTargetConvRef.current !== convId) return
      const items = ((res as { items?: Message[] })?.items ?? []) as Message[]
      if (items.length > 0) {
        setMessages((prev) => {
          if (!since) return items
          const existingIds = new Set(prev.map((m) => String(m.id)))
          const newItems = items.filter((m) => !existingIds.has(String(m.id)))
          return newItems.length > 0 ? [...prev, ...newItems] : prev
        })
        lastMsgAt.current = items[items.length - 1].created_at ?? null
        scrollToBottom()
      }
      if (messagesTargetConvRef.current !== convId) return
      // markRead seulement si chargement initial ou nouveaux messages : moins de charge DB / réseau
      if (!since || items.length > 0) {
        await chatApi.markRead(String(convId), 'coach')
      }
    } catch {
      /* silent */
    }
  }, [scrollToBottom])

  // IMPORTANT : dépendre uniquement de l’id, pas de l’objet `selected` — sinon chaque poll liste
  // qui fait { ...prev, ...row } relançait cet effet, vidait les messages et rechargeait tout le fil.
  const selectedConvId = selected?.id ?? null

  useEffect(() => {
    if (!selectedConvId) {
      selectedIdRef.current = null
      messagesTargetConvRef.current = null
      return
    }
    selectedIdRef.current = selectedConvId
    messagesTargetConvRef.current = selectedConvId
    lastMsgAt.current = null
    setMessages([])
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConvId ? { ...c, unread_count: 0 } : c))
    )
    void chatApi.markRead(String(selectedConvId), 'coach').catch(() => {})
    void loadMessages(selectedConvId, null)
    if (pollTimer.current) clearInterval(pollTimer.current)
    pollTimer.current = setInterval(() => {
      void loadMessages(selectedConvId, lastMsgAt.current)
    }, 8000)
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [selectedConvId, loadMessages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !selected || sending) return
    const content = text.trim()
    setText('')
    setSending(true)
    const optimisticAssigned =
      selected.assigned_coach_id != null && selected.assigned_coach_id > 0
        ? Number(selected.assigned_coach_id)
        : null
    let optimisticKind: StaffKind = 'assigned_coach'
    if (isAdmin) optimisticKind = 'admin'
    else if (optimisticAssigned != null && myUserId !== optimisticAssigned) optimisticKind = 'coach_other'
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      conversation_id: selected.id,
      sender_id: myUserId || undefined,
      sender_role: 'coach',
      sender_display_name: myName.trim() || null,
      staff_kind: optimisticKind,
      content,
      created_at: new Date().toISOString(),
      _optimistic: true,
    }
    setMessages((prev) => [...prev, optimistic])
    scrollToBottom()
    try {
      const saved = await chatApi.send(String(selected.id), content, 'coach') as Message
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)))
      lastMsgAt.current = saved.created_at ?? null
      setConversations((prev) => prev.map((c) => (c.id === selected.id ? { ...c, last_message_at: saved.created_at } : c)))
      if (refreshListAfterSendRef.current) clearTimeout(refreshListAfterSendRef.current)
      refreshListAfterSendRef.current = setTimeout(() => {
        refreshListAfterSendRef.current = null
        void loadConversations({ silent: true })
      }, 600)
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setText(content)
      setError("Erreur lors de l'envoi.")
    } finally {
      setSending(false)
    }
  }

  async function closeConversation(convId: number) {
    try {
      await chatApi.closeConversation(String(convId))
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, status: 'closed', closed_by_role: 'coach' } : c))
      )
      if (selected?.id === convId) {
        setSelected((prev) => (prev ? { ...prev, status: 'closed', closed_by_role: 'coach' } : null))
      }
    } catch {
      /* silent */
    }
  }

  async function deleteConversation(convId: number) {
    if (!window.confirm('Supprimer définitivement cette conversation et tous ses messages ?')) return
    try {
      await chatApi.deleteConversation(String(convId))
      setConversations((prev) => prev.filter((c) => c.id !== convId))
      if (selected?.id === convId) { setSelected(null); setMessages([]) }
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e?.message || 'Erreur lors de la suppression.')
    }
  }

  const isClosed = selected?.status === 'closed'
  const showList = !selected
  const showConv = !!selected

  return (
    <div className="relative flex h-full min-h-0 gap-0 overflow-hidden -mx-4 md:mx-0 md:w-auto">
      <div className={`${showList ? 'flex' : 'hidden'} md:flex w-full md:w-64 lg:w-72 shrink-0 border-r border-slate-200 dark:border-slate-700 flex-col min-h-0 absolute md:relative inset-0 z-10 md:z-auto bg-white dark:bg-slate-900`}>
        <div className="shrink-0 p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
            {t('chat.adminInboxTitle')}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 mb-3 leading-snug">
            {t('chat.adminInboxSubtitle')}
          </p>
          <div className="flex gap-1">
            {[['open', 'Ouvertes'], ['closed', 'Clôturées'], ['', 'Toutes']].map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => { setStatusFilter(val); setSelected(null) }}
                className={`flex-1 px-2 py-2 md:py-1 rounded-lg text-xs font-medium transition-all touch-manipulation ${
                  statusFilter === val
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-8">
              <span className="w-5 h-5 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8 px-4">Aucune conversation</p>
          ) : (
            conversations.map((c) => {
              const unread = (c.unread_count ?? 0) > 0
              const convClosed = c.status === 'closed'
              const closedByTeam =
                convClosed &&
                (c.closed_by_role === 'coach' ||
                  c.closed_by_role == null ||
                  String(c.closed_by_role).trim() === '')
              return (
                <div key={c.id} className="relative group">
                  <button
                    onClick={() => setSelected(c)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selected?.id === c.id ? 'bg-violet-50 dark:bg-violet-950/20' : ''} ${unread ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 pr-5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <p className={`text-xs font-medium truncate ${unread ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'}`}>
                          {c.user_email || `User #${c.user_id}`}
                        </p>
                        {unread ? (
                          <span
                            className="shrink-0 min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1"
                            title={`${c.unread_count} message${(c.unread_count ?? 0) > 1 ? 's' : ''} non lu${(c.unread_count ?? 0) > 1 ? 's' : ''}`}
                          >
                            {(c.unread_count ?? 0) > 99 ? '99+' : c.unread_count}
                          </span>
                        ) : null}
                      </div>
                      <span className={`shrink-0 w-2 h-2 rounded-full ${convClosed ? 'bg-slate-300 dark:bg-slate-600' : 'bg-emerald-500'}`} />
                    </div>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {(c.assigned_coach_id != null && c.assigned_coach_id > 0) ? (
                        (c.assigned_coach_display_name ?? '').trim() ? (
                          <p className="text-[10px] font-medium text-violet-600 dark:text-violet-400 truncate pr-1">
                            {t('chat.adminHeaderCoachAssigned', { name: (c.assigned_coach_display_name ?? '').trim() })}
                          </p>
                        ) : (
                          <p className="text-[10px] font-medium text-violet-600/80 dark:text-violet-400/80 truncate pr-1">
                            {t('chat.adminHeaderCoachAssignedNoName', { id: c.assigned_coach_id })}
                          </p>
                        )
                      ) : (
                        <p className="text-[10px] text-slate-500 dark:text-slate-500 truncate pr-1">
                          {t('chat.adminHeaderCoachPool')}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[10px] text-slate-400">
                        {c.last_message_at ? formatRelative(c.last_message_at) : formatRelative(c.created_at)}
                      </p>
                      {closedByTeam ? (
                        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-200/90 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {t('chat.listClosedByTeam')}
                        </span>
                      ) : null}
                      </div>
                    </div>
                  </button>
                  {convClosed && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(c.id) }}
                      title="Supprimer"
                      className="absolute right-2 top-1/2 -translate-y-1/2 md:opacity-0 md:group-hover:opacity-100 w-9 h-9 md:w-6 md:h-6 flex items-center justify-center rounded-full hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-400 hover:text-rose-600 transition-all touch-manipulation"
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {!selected ? (
        <div className="hidden md:flex flex-1 items-center justify-center text-slate-500 dark:text-slate-400 p-8 text-center">
          <div className="space-y-3 max-w-sm">
            <div className="text-4xl">💬</div>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
              {t('chat.adminEmptyStateTitle')}
            </p>
            <p className="text-sm leading-relaxed">{t('chat.adminEmptyStateHint')}</p>
          </div>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${showConv ? 'flex' : 'hidden md:flex'}`}>
          <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-3">
            <button
              onClick={() => setSelected(null)}
              className="md:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 -ml-1"
              aria-label="Retour à la liste"
            >
              ←
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                {selected.user_email || `Utilisateur #${selected.user_id}`}
              </p>
              {(selected.assigned_coach_id != null && selected.assigned_coach_id > 0) ? (
                (selected.assigned_coach_display_name ?? '').trim() ? (
                  <p className="text-[11px] font-medium text-violet-600 dark:text-violet-400 truncate mt-0.5">
                    {t('chat.adminHeaderCoachAssigned', { name: (selected.assigned_coach_display_name ?? '').trim() })}
                  </p>
                ) : (
                  <p className="text-[11px] font-medium text-violet-600/85 dark:text-violet-400/85 truncate mt-0.5">
                    {t('chat.adminHeaderCoachAssignedNoName', { id: selected.assigned_coach_id })}
                  </p>
                )
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {t('chat.adminHeaderCoachPool')}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-0.5">
                {isClosed
                  ? selected.closed_by_role === 'coach' ||
                    selected.closed_by_role == null ||
                    String(selected.closed_by_role).trim() === ''
                    ? t('chat.adminHeaderClosedByTeam')
                    : t('chat.adminHeaderClosed')
                  : t('chat.adminHeaderOpen')}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {!isClosed && (
                <button
                  onClick={() => closeConversation(selected.id)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-rose-400 dark:hover:border-rose-600 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                >
                  Clôturer
                </button>
              )}
              {isClosed && (
                <button
                  onClick={() => deleteConversation(selected.id)}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-xs text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 bg-slate-100 dark:bg-slate-900">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
                <span className="text-4xl mb-3 text-slate-300 dark:text-slate-600">💬</span>
                <p className="text-sm text-slate-500 dark:text-slate-400">Aucun message</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">La conversation commencera ici</p>
              </div>
            )}
            {messages.map((m, i) => {
              const isStaff = m.sender_role === 'coach'
              const kind = effectiveStaffKind(m)
              const bubble = staffBubbleClasses(kind, isStaff)
              const footerMuted =
                kind === 'admin'
                  ? 'text-amber-100'
                  : kind === 'coach_other'
                    ? 'text-indigo-100'
                    : isStaff
                      ? 'text-violet-200'
                      : 'text-slate-400'
              return (
                <div key={m._optimistic ? `opt-${i}-${m.id}` : `msg-${i}-${m.id}`} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] sm:max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${bubble} ${m._optimistic ? 'opacity-70' : ''}`}>
                    <p className={`whitespace-pre-wrap ${isStaff && kind !== 'user' ? 'text-white' : ''}`}>{m.content}</p>
                    <p className={`text-[10px] mt-1 ${footerMuted}`}>
                      {isStaff ? staffFooterText(kind, m) : ''}{formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="shrink-0 px-4 py-2 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-600 dark:text-rose-400 text-center">
              {error}
              <button onClick={() => setError('')} className="ml-2 underline">Fermer</button>
            </div>
          )}

          {isClosed ? (
            <div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-400">
              Conversation clôturée.
            </div>
          ) : (
            <form onSubmit={sendMessage} className="shrink-0 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,48px))] border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as unknown as React.FormEvent) } }}
                placeholder="Répondre… (Entrée pour envoyer)"
                rows={2}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-none"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:opacity-40 transition-colors shrink-0 self-end"
              >
                {sending ? '…' : '→'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
