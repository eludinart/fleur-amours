'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { chatApi } from '@/api/chat'
import { toast } from '@/hooks/useToast'
import { billingApi } from '@/api/billing'
import { AlertBox, AlertBoxLink } from '@/components/AlertBox'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function formatTime(iso: string | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso: string | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

type Message = {
  id: string
  conversation_id?: string
  sender_role: string
  content: string
  created_at: string
  _optimistic?: boolean
}

function groupByDate(messages: Message[]) {
  const groups: Array<{ type: 'date'; date: string } | (Message & { type: 'msg' })> = []
  let lastDate: string | null = null
  for (const m of messages) {
    const date = formatDate(m.created_at)
    if (date !== lastDate) {
      groups.push({ type: 'date', date })
      lastDate = date
    }
    groups.push({ type: 'msg', ...m })
  }
  return groups
}

export function ChatPage() {
  const { user } = useAuth()
  const { fetchUnread } = useNotifications()
  const [conv, setConv] = useState<{ id: string; status?: string } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [quotaBannerDismissed, setQuotaBannerDismissed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMsgAt = useRef<string | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const loadMessages = useCallback(
    async (convId: string, since: string | null) => {
      try {
        const res = (await chatApi.messages(convId, since || undefined)) as {
          items?: Message[]
        }
        const items = res?.items ?? []
        if (items.length > 0) {
          setMessages((prev) => (since ? [...prev, ...items] : items))
          lastMsgAt.current = items[items.length - 1]?.created_at ?? null
          await chatApi.markRead(convId, 'user')
          scrollToBottom()
          fetchUnread?.()
        }
      } catch {
        /* ignore */
      }
    },
    [scrollToBottom, fetchUnread]
  )

  const SAP_PER_MESSAGE = 2
  useEffect(() => {
    const u = user as { id?: string } | null
    if (!u?.id) return
    billingApi
      .getAccess()
      .then((data) => {
        const d = data as {
          free_access?: boolean
          has_subscription?: boolean
          usage?: { chat_messages_count?: number }
          limits?: { chat_messages_per_month?: number }
          token_balance?: number
          eternal_sap?: number
        }
        if (d?.free_access || d?.has_subscription) return
        const used = d?.usage?.chat_messages_count ?? 0
        const limit = d?.limits?.chat_messages_per_month ?? 10
        const totalSap = (d?.token_balance ?? 0) + (d?.eternal_sap ?? 0)
        if (used >= limit && totalSap < SAP_PER_MESSAGE) {
          setQuotaExceeded(true)
        }
      })
      .catch(() => {})
  }, [(user as { id?: string })?.id])

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const c = (await chatApi.startConversation()) as { id: string }
        setConv(c)
        await loadMessages(c.id, null)
      } catch (err) {
        setError(
          (err as Error)?.message || 'Impossible de démarrer le chat.'
        )
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [loadMessages])

  useEffect(() => {
    if (!conv) return
    pollTimer.current = setInterval(() => {
      loadMessages(conv.id, lastMsgAt.current)
    }, 10000)
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [conv, loadMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !conv || sending || quotaExceeded) return
    const content = text.trim()
    setText('')
    setSending(true)
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      conversation_id: conv.id,
      sender_role: 'user',
      content,
      created_at: new Date().toISOString(),
      _optimistic: true,
    }
    setMessages((prev) => [...prev, optimistic])
    scrollToBottom()
    try {
      const saved = (await chatApi.send(conv.id, content, 'user')) as Message
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? saved : m))
      )
      lastMsgAt.current = saved.created_at
      toast('Message envoyé', 'success')
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setText(content)
      const ex = err as { code?: string; status?: number }
      if (ex?.code === 'quota_exceeded' || ex?.status === 402) {
        setQuotaExceeded(true)
      } else {
        setError("Erreur lors de l'envoi. Veuillez réessayer.")
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !conv) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <p className="text-rose-600 dark:text-rose-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  const grouped = groupByDate(messages)
  const isClosed = conv?.status === 'closed'

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 -mx-4 md:mx-0 md:w-auto">
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
          🌿
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
            Coach Eludein
          </p>
          <p className="text-xs text-slate-500">
            {isClosed
              ? 'Conversation terminée'
              : 'En ligne · répond sous 24h'}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 bg-slate-100 dark:bg-slate-900">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <div className="text-4xl">💬</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Commencez la conversation. Le coach vous répondra dans les
              meilleurs délais.
            </p>
          </div>
        )}

        {grouped.map((item, i) => {
          if (item.type === 'date') {
            return (
              <div
                key={`date-${i}`}
                className="flex items-center gap-3 py-2"
              >
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium uppercase tracking-wider">
                  {item.date}
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
              </div>
            )
          }
          const isUser = item.sender_role === 'user'
          return (
            <div
              key={item.id ?? `msg-${i}`}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                  isUser
                    ? 'bg-violet-600 text-white rounded-br-md'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-bl-md'
                } ${item._optimistic ? 'opacity-70' : ''}`}
              >
                <p className={`whitespace-pre-wrap ${isUser ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{item.content}</p>
                <p
                  className={`text-[10px] mt-1 ${
                    isUser ? 'text-violet-200' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {formatTime(item.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {quotaExceeded && !quotaBannerDismissed && (
        <div className="shrink-0 mx-4 mb-2">
          <AlertBox
            variant="warning"
            title="💬 Limite mensuelle atteinte"
            onDismiss={() => setQuotaBannerDismissed(true)}
            actions={<AlertBoxLink href="/account">Activer un code promo →</AlertBoxLink>}
          >
            Vous avez utilisé tous vos messages gratuits ce mois-ci.
          </AlertBox>
        </div>
      )}

      {error && error !== 'quota_exceeded' && (
        <div className="shrink-0 px-4 py-2">
          <AlertBox variant="error" onDismiss={() => setError('')}>
            {error}
          </AlertBox>
        </div>
      )}

      {isClosed ? (
        <div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-400">
          Cette conversation a été clôturée par le coach.
        </div>
      ) : (
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          {quotaExceeded && quotaBannerDismissed && (
            <p className="px-4 py-2 text-xs text-amber-600 dark:text-amber-400 text-center">
              Limite atteinte ·{' '}
              <Link
                href="/account"
                className="underline hover:no-underline font-medium"
              >
                Activer un code promo
              </Link>{' '}
              pour continuer
            </p>
          )}
          <form
            onSubmit={sendMessage}
            className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,48px))] flex gap-2"
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(e)
                }
              }}
              placeholder="Écrivez votre message… (Entrée pour envoyer)"
              rows={2}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-none"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending || quotaExceeded}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:opacity-40 transition-colors shrink-0 self-end"
            >
              {sending ? '…' : '→'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
