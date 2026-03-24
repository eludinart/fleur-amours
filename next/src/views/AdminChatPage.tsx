'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { chatApi } from '@/api/chat'

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
  unread_count?: number
  last_message_at?: string
  created_at?: string
}

type Message = {
  id: string | number
  conversation_id?: number
  sender_role?: string
  content?: string
  created_at?: string
  _optimistic?: boolean
}

export default function AdminChatPage() {
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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const loadConversations = useCallback(() => {
    setLoadingConvs(true)
    chatApi.listConversations({ status: statusFilter, per_page: 50 })
      .then((res) => setConversations((res as { items?: Conversation[] })?.items ?? []))
      .catch(() => setConversations([]))
      .finally(() => setLoadingConvs(false))
  }, [statusFilter])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => {
    const t = setInterval(loadConversations, 15000)
    return () => clearInterval(t)
  }, [loadConversations])

  const loadMessages = useCallback(async (convId: number, since: string | null) => {
    try {
      const res = await chatApi.messages(String(convId), since ?? undefined)
      const items = ((res as { items?: Message[] })?.items ?? []) as Message[]
      if (items.length > 0) {
        setMessages((prev) => (since ? [...prev, ...items] : items))
        lastMsgAt.current = items[items.length - 1].created_at ?? null
        await chatApi.markRead(String(convId), 'coach')
        scrollToBottom()
      }
    } catch {
      /* silent */
    }
  }, [scrollToBottom])

  useEffect(() => {
    if (!selected) return
    lastMsgAt.current = null
    setMessages([])
    setConversations((prev) => prev.map((c) => (c.id === selected.id ? { ...c, unread_count: 0 } : c)))
    loadMessages(selected.id, null)
    if (pollTimer.current) clearInterval(pollTimer.current)
    pollTimer.current = setInterval(() => loadMessages(selected.id, lastMsgAt.current), 10000)
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [selected, loadMessages])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !selected || sending) return
    const content = text.trim()
    setText('')
    setSending(true)
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      conversation_id: selected.id,
      sender_role: 'coach',
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
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, status: 'closed' } : c)))
      if (selected?.id === convId) setSelected((prev) => (prev ? { ...prev, status: 'closed' } : null))
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
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Conversations</h2>
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
              return (
                <div key={c.id} className="relative group">
                  <button
                    onClick={() => setSelected(c)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selected?.id === c.id ? 'bg-violet-50 dark:bg-violet-950/20' : ''} ${unread ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2 pr-5">
                      <p className={`text-xs font-medium truncate ${unread ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'}`}>
                        {c.user_email || `User #${c.user_id}`}
                      </p>
                      {unread ? (
                        <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
                          {(c.unread_count ?? 0) > 99 ? '99+' : c.unread_count}
                        </span>
                      ) : (
                        <span className={`shrink-0 w-2 h-2 rounded-full ${convClosed ? 'bg-slate-300 dark:bg-slate-600' : 'bg-emerald-500'}`} />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {c.last_message_at ? formatRelative(c.last_message_at) : formatRelative(c.created_at)}
                    </p>
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
        <div className="hidden md:flex flex-1 items-center justify-center text-sm text-slate-400 p-8 text-center">
          <div className="space-y-3">
            <div className="text-4xl">💬</div>
            <p>Sélectionnez une conversation à gauche</p>
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
              <p className="text-xs text-slate-500">
                {isClosed ? 'Conversation clôturée' : 'Conversation ouverte'}
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

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/30">
            {messages.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400">Aucun message</div>
            )}
            {messages.map((m) => {
              const isCoach = m.sender_role === 'coach'
              return (
                <div key={String(m.id)} className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] sm:max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    isCoach
                      ? 'bg-violet-600 text-white rounded-br-md'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-md'
                  } ${m._optimistic ? 'opacity-70' : ''}`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${isCoach ? 'text-violet-200' : 'text-slate-400'}`}>
                      {isCoach ? 'Coach · ' : ''}{formatTime(m.created_at)}
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
