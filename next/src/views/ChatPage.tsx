'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { chatApi } from '@/api/chat'
import { toast } from '@/hooks/useToast'
import { billingApi } from '@/api/billing'
import { AlertBox, AlertBoxLink } from '@/components/AlertBox'
import { t } from '@/i18n'
import {
  type Coach,
  coachPrimaryTitle,
  coachProfileDisplayName,
  coachPseudoHandle,
  coachSubtitleUnderTitle,
  formatCoachLastSeenLabel,
} from '@/lib/coach-profile'

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

type MyConvoSummary = {
  id: string
  status: string
  assigned_coach_id: number | null
  closed_by_role: string | null
  last_message_at: string | null
  created_at: string | null
}

function parseMyConversationsPayload(r: unknown): MyConvoSummary[] {
  const data = r as {
    conversations?: Array<{
      id: string
      status?: string
      assigned_coach_id?: number | null
      closed_by_role?: string | null
      last_message_at?: string | null
      created_at?: string | null
    }>
  }
  const raw = data?.conversations ?? []
  return raw.map((c) => ({
    id: String(c.id),
    status: String(c.status ?? 'open'),
    assigned_coach_id:
      c.assigned_coach_id != null && Number(c.assigned_coach_id) > 0 ? Number(c.assigned_coach_id) : null,
    closed_by_role: c.closed_by_role ?? null,
    last_message_at: c.last_message_at ?? null,
    created_at: c.created_at ?? null,
  }))
}

function formatHistoryRelative(iso: string | null | undefined, tf: typeof t): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return tf('chat.historyJustNow')
  if (diff < 3600000) return tf('chat.historyMinutesAgo', { n: Math.floor(diff / 60000) })
  if (diff < 86400000) return tf('chat.historyHoursAgo', { n: Math.floor(diff / 3600000) })
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
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

const NO_COACH_HEADER = "Accompagnement Fleur d'AmOurs"

export function ChatPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const { fetchUnread } = useNotifications()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [coachesFetched, setCoachesFetched] = useState(false)
  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null)
  const [showCoachPicker, setShowCoachPicker] = useState(false)
  const [activeCoach, setActiveCoach] = useState<Coach | null>(null)
  const [conv, setConv] = useState<{
    id: string
    status?: string
    closed_by_role?: string | null
  } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [quotaBannerDismissed, setQuotaBannerDismissed] = useState(false)
  const [myConvos, setMyConvos] = useState<MyConvoSummary[]>([])
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMsgAt = useRef<string | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const coachesRef = useRef<Coach[]>([])
  coachesRef.current = coaches

  const convFromUrl = searchParams?.get?.('conv') ?? null
  const historyFromUrl = searchParams?.get?.('history') === '1'
  const coachQs = (searchParams?.get?.('coach') ?? '').trim()

  const replaceChatQuery = useCallback(
    (opts: { convId?: string | null; history?: boolean; clearCoach?: boolean }) => {
      const p = new URLSearchParams(searchParams?.toString?.() ?? '')
      if (opts.clearCoach) p.delete('coach')
      if (opts.convId != null) {
        p.set('conv', String(opts.convId))
        p.delete('coach')
      }
      if (opts.convId === null) p.delete('conv')
      if (opts.history === true) p.set('history', '1')
      if (opts.history === false) p.delete('history')
      const q = p.toString()
      const path = pathname || '/chat'
      router.replace(q ? `${path}?${q}` : path, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  useEffect(() => {
    if (historyFromUrl) setShowHistoryPanel(true)
  }, [historyFromUrl])

  const pickerClosedOnlyAutoOpen = useRef(false)
  useEffect(() => {
    if (pickerClosedOnlyAutoOpen.current || historyFromUrl) return
    if (myConvos.length === 0) return
    const openN = myConvos.filter((c) => c.status !== 'closed').length
    const closedN = myConvos.filter((c) => c.status === 'closed').length
    if (openN === 0 && closedN > 0) {
      setShowHistoryPanel(true)
      pickerClosedOnlyAutoOpen.current = true
    }
  }, [myConvos, historyFromUrl])

  const sortedHistory = useMemo(() => {
    return [...myConvos].sort((a, b) => {
      const ta = new Date(a.last_message_at || a.created_at || 0).getTime()
      const tb = new Date(b.last_message_at || b.created_at || 0).getTime()
      if (tb !== ta) return tb - ta
      return Number(b.id) - Number(a.id)
    })
  }, [myConvos])

  const openPickerConvos = useMemo(
    () => sortedHistory.filter((c) => c.status !== 'closed'),
    [sortedHistory]
  )
  const closedPickerConvos = useMemo(
    () => sortedHistory.filter((c) => c.status === 'closed'),
    [sortedHistory]
  )

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /** Aligne l'en-tête coach avec la colonne assigned_coach_id (y compris coach non listé + maj après réponse). */
  const syncAssignedCoach = useCallback(
    async (assignedId: number | null | undefined) => {
      if (assignedId === undefined) return
      if (assignedId == null || assignedId <= 0) {
        setActiveCoach(null)
        return
      }
      const inList = coaches.find((c) => c.id === assignedId)
      if (inList) {
        setActiveCoach(inList)
        return
      }
      try {
        const r = (await chatApi.coachByUserId(assignedId)) as { coach?: Coach }
        if (r?.coach && Number(r.coach.id) === Number(assignedId)) {
          setActiveCoach(r.coach)
        }
      } catch {
        /* ne pas écraser un coach déjà affiché si l'appel échoue */
      }
    },
    [coaches]
  )

  const loadMessages = useCallback(
    async (convId: string, since: string | null) => {
      try {
        const res = (await chatApi.messages(convId, since || undefined)) as {
          items?: Message[]
          assigned_coach_id?: number | null
          status?: string
          closed_by_role?: string | null
        }
        void syncAssignedCoach(res.assigned_coach_id)
        // Ne pas dépendre de `prev` déjà posé : setConv + await peut laisser prev=null (batch React),
        // ce qui empêchait d'appliquer status=closed depuis l'API messages.
        setConv((prev) => {
          const idStr = String(convId)
          const sameId = prev != null && String(prev.id) === idStr
          const hasMeta = res.status !== undefined || res.closed_by_role !== undefined
          if (!hasMeta) return prev

          if (!sameId) {
            return {
              id: idStr,
              status: res.status ?? 'open',
              closed_by_role: res.closed_by_role !== undefined ? res.closed_by_role : null,
            }
          }
          const next = { ...prev }
          if (res.status !== undefined) next.status = res.status
          if (res.closed_by_role !== undefined) next.closed_by_role = res.closed_by_role
          return next
        })
        const items = res?.items ?? []
        if (!since) {
          setMessages(items)
          lastMsgAt.current = items.length > 0 ? items[items.length - 1]?.created_at ?? null : null
          if (items.length > 0) {
            await chatApi.markRead(convId, 'user')
            scrollToBottom()
            fetchUnread?.()
          }
        } else if (items.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id))
            const newItems = items.filter((m) => !existingIds.has(m.id))
            return newItems.length > 0 ? [...prev, ...newItems] : prev
          })
          lastMsgAt.current = items[items.length - 1]?.created_at ?? null
          await chatApi.markRead(convId, 'user')
          scrollToBottom()
          fetchUnread?.()
        }
      } catch {
        /* ignore */
      }
    },
    [scrollToBottom, fetchUnread, syncAssignedCoach]
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

  const refreshCoaches = useCallback(() => {
    return chatApi
      .coaches()
      .then((r) => {
        const data = r as { coaches?: Coach[] }
        const list = data?.coaches ?? []
        setCoaches(list)
        return list
      })
      .catch(() => {
        setCoaches([])
        return [] as Coach[]
      })
  }, [])

  useEffect(() => {
    refreshCoaches().then((list) => {
      setCoachesFetched(true)
      if (list.length > 0) {
        const raw = (searchParams?.get?.('coach') ?? '').trim()
        const cid = raw ? parseInt(raw, 10) : NaN
        const coachOk = Number.isFinite(cid) && list.some((c) => c.id === cid)
        if (!coachOk) setShowCoachPicker(true)
      }
    })
  }, [refreshCoaches, searchParams])

  /** Ouvrir un fil existant depuis l’historique (page de sélection ou lien). */
  const lastBootstrapConv = useRef<string | null>(null)
  const lastBootstrapUrl = useRef<string | null>(null)
  const coachStartDoneRef = useRef<string | null>(null)

  const openExistingConversation = useCallback(
    async (row: MyConvoSummary) => {
      setLoading(true)
      setError('')
      const idStr = String(row.id)
      setConv({
        id: idStr,
        status: row.status,
        closed_by_role: row.closed_by_role ?? null,
      })
      setShowCoachPicker(false)
      replaceChatQuery({ convId: idStr })
      lastBootstrapConv.current = idStr
      lastBootstrapUrl.current = idStr
      try {
        await loadMessages(idStr, null)
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    },
    [loadMessages, replaceChatQuery]
  )

  /**
   * Par défaut : page de sélection d’accompagnant (pas d’ouverture auto du dernier fil).
   * Ouverture directe seulement si ?conv=id valide.
   */
  useEffect(() => {
    if (!coachesFetched) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await chatApi.myConversations()
        if (cancelled) return
        const list = parseMyConversationsPayload(r)
        setMyConvos(list)

        const hasDeepLink = convFromUrl != null && String(convFromUrl).trim() !== ''
        const pick = hasDeepLink ? list.find((c) => String(c.id) === String(convFromUrl)) : null

        if (!hasDeepLink) {
          const coachParamRaw = coachQs
          const coachParamId = coachParamRaw ? parseInt(coachParamRaw, 10) : NaN
          const coachIntentValid =
            Number.isFinite(coachParamId) &&
            coachesRef.current.some((c) => c.id === coachParamId)

          if (coachParamRaw) {
            if (!Number.isFinite(coachParamId) || !coachIntentValid) {
              replaceChatQuery({ clearCoach: true })
            } else {
              setShowCoachPicker(false)
              setLoading(false)
              return
            }
          }

          if (coachesRef.current.length > 0) {
            setShowCoachPicker(true)
            setConv(null)
            setMessages([])
            lastBootstrapConv.current = null
            lastBootstrapUrl.current = null
          }
          setLoading(false)
          return
        }

        if (!pick) {
          replaceChatQuery({ convId: null })
          if (coachesRef.current.length > 0) {
            setShowCoachPicker(true)
            setConv(null)
            setMessages([])
          }
          setLoading(false)
          return
        }

        const idStr = String(pick.id)
        const urlKey = convFromUrl ?? ''
        const needLoad = lastBootstrapConv.current !== idStr || lastBootstrapUrl.current !== urlKey

        setShowCoachPicker(false)
        setConv({
          id: idStr,
          status: pick.status,
          closed_by_role: pick.closed_by_role ?? null,
        })

        if (!needLoad) {
          setLoading(false)
          return
        }
        lastBootstrapConv.current = idStr
        lastBootstrapUrl.current = urlKey
        setLoading(true)
        try {
          await loadMessages(idStr, null)
        } finally {
          if (!cancelled) setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [coachesFetched, convFromUrl, loadMessages, coachQs, replaceChatQuery])

  useEffect(() => {
    if (conv || !showCoachPicker || !coachesFetched) return
    const id = window.setInterval(() => {
      void refreshCoaches()
    }, 25000)
    return () => clearInterval(id)
  }, [conv, showCoachPicker, coachesFetched, refreshCoaches])

  /** En-tête = coach assigné pour la conversation affichée (pas seulement la première ligne). */
  useEffect(() => {
    if (!coachesFetched || !conv?.id) return
    let cancelled = false
    const row = myConvos.find((c) => String(c.id) === String(conv.id))
    const aid = row?.assigned_coach_id
    ;(async () => {
      if (aid == null || aid <= 0) {
        if (!cancelled) setActiveCoach(null)
        return
      }
      const found = coaches.find((c) => c.id === aid)
      if (found) {
        if (!cancelled) setActiveCoach(found)
        return
      }
      try {
        const cr = (await chatApi.coachByUserId(aid)) as { coach?: Coach }
        if (!cancelled && cr?.coach) setActiveCoach(cr.coach)
        else if (!cancelled) setActiveCoach(null)
      } catch {
        if (!cancelled) setActiveCoach(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [coachesFetched, coaches, conv?.id, myConvos])

  /** Filet de sécurité : statut réel en base (clôture côté coach) si l’API messages est en retard ou proxifiée. */
  useEffect(() => {
    const convId = conv?.id
    if (!convId) return
    let cancelled = false
    const pull = () => {
      chatApi
        .myConversations()
        .then((r) => {
          if (cancelled) return
          const list = parseMyConversationsPayload(r)
          setMyConvos(list)
          const row = list.find((c) => String(c.id) === String(convId))
          if (!row?.id) return
          setConv((prev) => {
            if (!prev || String(prev.id) !== String(row.id)) return prev
            const next = { ...prev }
            if (row.status !== undefined) next.status = row.status
            if (row.closed_by_role !== undefined) next.closed_by_role = row.closed_by_role
            return next
          })
        })
        .catch(() => {})
    }
    pull()
    const timer = window.setInterval(pull, 12000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [conv?.id])

  const startConv = useCallback(
    async (coachId?: number | null) => {
      setLoading(true)
      setError('')
      try {
        const c = (await chatApi.startConversation(coachId ?? undefined)) as {
          id: string
          status?: string
          closed_by_role?: string | null
        }
        setConv({
          id: c.id,
          status: c.status,
          closed_by_role: c.closed_by_role ?? null,
        })
        if (coachId != null) {
          const selected = coaches.find((x) => x.id === coachId) || null
          setActiveCoach(selected)
        } else {
          setActiveCoach(null)
        }
        setShowCoachPicker(false)
        await loadMessages(c.id, null)
        try {
          const r = await chatApi.myConversations()
          setMyConvos(parseMyConversationsPayload(r))
        } catch {
          /* ignore */
        }
        replaceChatQuery({ convId: c.id })
        lastBootstrapConv.current = c.id
        lastBootstrapUrl.current = c.id
      } catch (err) {
        const ex = err as { status?: number; message?: string }
        setError(ex?.message || 'Impossible de démarrer le chat.')
      } finally {
        setLoading(false)
      }
    },
    [loadMessages, coaches, replaceChatQuery]
  )

  /** Lien depuis l’annuaire : `/chat?coach=<wp_user_id>` démarre le fil avec ce coach. */
  useEffect(() => {
    if (!coachesFetched) return
    if (convFromUrl != null && String(convFromUrl).trim() !== '') return
    const raw = (searchParams?.get?.('coach') ?? '').trim()
    if (!raw) {
      coachStartDoneRef.current = null
      return
    }
    const id = parseInt(raw, 10)
    if (!Number.isFinite(id) || !coachesRef.current.some((c) => c.id === id)) return
    if (coachStartDoneRef.current === raw) return
    coachStartDoneRef.current = raw
    void startConv(id).catch(() => {
      coachStartDoneRef.current = null
    })
  }, [coachesFetched, coaches.length, convFromUrl, searchParams, startConv])

  useEffect(() => {
    if (!coachesFetched || conv) return
    if (showCoachPicker && coaches.length > 0) {
      setLoading(false)
      return
    }
    if (coaches.length === 0) {
      startConv(null)
    }
  }, [coachesFetched, showCoachPicker, coaches.length, conv, startConv])

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

  const doSend = useCallback(
    async (content: string, retryAfterRefresh = false) => {
      if (!content.trim() || !conv || conv.status === 'closed' || sending || quotaExceeded) return
      setText('')
      setSending(true)
      setError('')
      const optimistic: Message = {
        id: `opt-${Date.now()}`,
        conversation_id: conv.id,
        sender_role: 'user',
        content: content.trim(),
        created_at: new Date().toISOString(),
        _optimistic: true,
      }
      setMessages((prev) => [...prev, optimistic])
      scrollToBottom()
      try {
        let convId = conv.id
        const saved = (await chatApi.send(convId, content.trim(), 'user')) as Message
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? saved : m))
        )
        lastMsgAt.current = saved.created_at
        toast(t('chat.messageSent'), 'success')
      } catch (err) {
        const ex = err as { status?: number; message?: string }
        if (ex?.status === 404 && !retryAfterRefresh) {
          try {
            const c = (await chatApi.startConversation()) as {
              id: string
              status?: string
              closed_by_role?: string | null
            }
            setConv({
              id: c.id,
              status: c.status,
              closed_by_role: c.closed_by_role ?? null,
            })
            await loadMessages(c.id, null)
            setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
            const saved = (await chatApi.send(c.id, content.trim(), 'user')) as Message
            setMessages((prev) => [...prev, { ...saved, _optimistic: false }])
            lastMsgAt.current = saved.created_at
            toast(t('chat.messageSent'), 'success')
            scrollToBottom()
            return
          } catch {
            /* fall through to show error */
          }
        }
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setText(content.trim())
        if (ex?.status === 402) {
          setQuotaExceeded(true)
        } else {
          setError(ex?.message || t('chat.sendErrorSoft'))
        }
      } finally {
        setSending(false)
      }
    },
    [conv, sending, quotaExceeded, scrollToBottom, loadMessages]
  )

  function handleRetrySend() {
    if (!text.trim()) return
    setError('')
    doSend(text.trim())
  }

  function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    doSend(text.trim())
  }

  if (showCoachPicker && coaches.length > 0 && !conv) {
    const onlineCount = coaches.filter((c) => c.is_online).length
    return (
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 sm:p-6">
        <div className="w-full max-w-3xl mx-auto space-y-5">
          <header className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {t('chat.pickerTitle')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
              {t('chat.pickerSubtitle')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('chat.coachCount', { n: coaches.length, online: onlineCount })}
            </p>
          </header>

          {myConvos.length > 0 && (
            <div className="space-y-4">
              {openPickerConvos.length > 0 && (
                <section className="relative overflow-hidden rounded-2xl border-[3px] border-emerald-500 dark:border-emerald-400 bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-50 dark:from-emerald-950/90 dark:via-teal-950/70 dark:to-slate-900 shadow-xl shadow-emerald-600/20 dark:shadow-emerald-900/45 ring-4 ring-emerald-400/25 dark:ring-emerald-500/30">
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/30 dark:bg-emerald-400/10 blur-2xl pointer-events-none" />
                  <div className="relative p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-xl text-white shadow-lg shadow-emerald-900/30"
                        aria-hidden
                      >
                        💬
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-45" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                          </span>
                          {t('chat.pickerOngoingEyebrow')}
                        </p>
                        <h3 className="text-lg sm:text-xl font-extrabold leading-tight text-emerald-950 dark:text-emerald-50">
                          {openPickerConvos.length === 1
                            ? t('chat.pickerOngoingTitleOne')
                            : t('chat.pickerOngoingTitleMany', { n: openPickerConvos.length })}
                        </h3>
                        <p className="text-xs sm:text-sm font-medium text-emerald-900/90 dark:text-emerald-100/90">
                          {t('chat.pickerOngoingHint')}
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-2.5" role="list">
                      {openPickerConvos.map((row) => {
                        const labelTime = formatHistoryRelative(row.last_message_at || row.created_at, t)
                        return (
                          <li key={`open-${row.id}`}>
                            <button
                              type="button"
                              onClick={() => {
                                void openExistingConversation(row)
                                setShowHistoryPanel(false)
                              }}
                              className="w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border-2 border-emerald-600/40 dark:border-emerald-500/55 bg-white/95 dark:bg-slate-950/70 px-3.5 py-3 text-emerald-950 dark:text-emerald-50 shadow-md hover:bg-white dark:hover:bg-slate-900/85 hover:border-emerald-500 dark:hover:border-emerald-400 transition-all"
                            >
                              <span className="text-sm font-bold truncate">
                                {t('chat.conversationHistoryItemLabel', { n: row.id })}
                              </span>
                              <span className="flex flex-wrap items-center gap-2 shrink-0">
                                <span className="text-[11px] font-semibold text-emerald-800/85 dark:text-emerald-200/90">
                                  {labelTime}
                                </span>
                                <span className="text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-600 text-white">
                                  {t('chat.pickerResumeConversation')}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </section>
              )}

              {closedPickerConvos.length > 0 && (
                <div className="rounded-2xl border-2 border-violet-400/50 dark:border-violet-500/40 bg-violet-50/80 dark:bg-violet-950/25 px-3 py-2.5 shadow-md shadow-violet-500/10">
                  <button
                    type="button"
                    onClick={() => {
                      if (showHistoryPanel) {
                        replaceChatQuery({ history: false })
                      }
                      setShowHistoryPanel((open) => !open)
                    }}
                    className="text-sm font-bold text-violet-800 dark:text-violet-200 hover:text-violet-950 dark:hover:text-violet-50 flex items-center gap-2 touch-manipulation w-full text-left"
                    aria-expanded={showHistoryPanel}
                  >
                    <span className="text-base" aria-hidden>
                      {showHistoryPanel ? '▾' : '▸'}
                    </span>
                    {openPickerConvos.length > 0
                      ? t('chat.pickerClosedHistoryToggle', { n: closedPickerConvos.length })
                      : t('chat.conversationHistoryToggle')}
                    <span className="font-semibold text-violet-600 dark:text-violet-300">
                      {openPickerConvos.length > 0 ? '' : `(${closedPickerConvos.length})`}
                    </span>
                  </button>
                  {showHistoryPanel && (
                    <ul
                      className="mt-2 max-h-52 overflow-y-auto rounded-xl border-2 border-violet-200/80 dark:border-violet-800/80 bg-white dark:bg-slate-900/80 divide-y divide-slate-100 dark:divide-slate-700/80"
                      role="listbox"
                    >
                      {closedPickerConvos.map((row) => {
                        const labelTime = formatHistoryRelative(row.last_message_at || row.created_at, t)
                        return (
                          <li key={row.id}>
                            <button
                              type="button"
                              role="option"
                              onClick={() => {
                                void openExistingConversation(row)
                                setShowHistoryPanel(false)
                              }}
                              className="w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-violet-50 dark:hover:bg-violet-950/40 text-slate-800 dark:text-slate-200"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold truncate">
                                  {t('chat.conversationHistoryItemLabel', { n: row.id })}
                                </span>
                                <span className="shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                                  {t('chat.closedConversationBadge')}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{labelTime}</p>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div
              className={`rounded-2xl border transition-colors ${
                selectedCoachId === null
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-2 ring-violet-400/30'
                  : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedCoachId(null)}
                className="w-full px-4 py-4 text-left rounded-2xl"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl shrink-0" aria-hidden>
                    🌿
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{t('chat.teamOptionTitle')}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{t('chat.teamOptionDesc')}</p>
                  </div>
                </div>
              </button>
              {selectedCoachId === null && (
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => startConv(null)}
                    disabled={loading}
                    className="w-full py-3 rounded-2xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-lg shadow-violet-600/25 text-sm"
                  >
                    {loading ? '…' : t('chat.startConversation')}
                  </button>
                </div>
              )}
            </div>

            {coaches.map((c, idx) => {
              const selected = selectedCoachId === c.id
              const handle = (c.pseudo || '').trim().replace(/^@+/, '').toLowerCase()
              const title = handle ? `@${handle}` : c.name || c.email
              return (
                <div
                  key={`coach-${idx}-${c.id}`}
                  className={`rounded-2xl border transition-colors ${
                    selected
                      ? 'border-violet-500 bg-violet-50/80 dark:bg-violet-950/30 ring-2 ring-violet-400/25'
                      : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCoachId(c.id)}
                    className="w-full px-4 py-4 text-left rounded-2xl"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        {c.avatar ? (
                          <img
                            src={c.avatar}
                            alt=""
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-600"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                            {c.avatar_emoji || '🌿'}
                          </div>
                        )}
                        {c.is_online ? (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800"
                            title={t('chat.online')}
                            aria-label={t('chat.online')}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 gap-y-1">
                          <span
                            className={`font-bold text-base text-slate-950 dark:text-white truncate ${handle ? 'font-mono' : ''}`}
                          >
                            {title}
                          </span>
                          {c.coach_verified ? (
                            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm ring-1 ring-white/80 shrink-0">
                              Vérifié
                            </span>
                          ) : null}
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                              c.is_online
                                ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {c.is_online ? t('chat.online') : t('chat.offline')}
                          </span>
                        </div>
                        {handle && (c.name || '').trim() ? (
                          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{c.name}</p>
                        ) : null}
                        {!c.is_online ? (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatCoachLastSeenLabel(c.last_seen_at ?? null, t)}
                          </p>
                        ) : (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-200 font-medium">
                            {t('chat.presenceActiveHint')}
                          </p>
                        )}
                        {c.coach_headline ? (
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">
                            {c.coach_headline}
                          </p>
                        ) : null}
                        {c.coach_short_bio ? (
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                            {c.coach_short_bio}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {c.coach_years_experience != null && c.coach_years_experience > 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-amber-50 dark:bg-amber-500/15 text-amber-950 dark:text-amber-50 border-amber-300 dark:border-amber-400/60">
                              {t('chat.yearsExp', { n: c.coach_years_experience })}
                            </span>
                          ) : null}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-900 dark:text-violet-100 border border-violet-200 dark:border-violet-700">
                            {c.coach_response_time_label || '—'}
                          </span>
                          {(c.coach_languages?.length ?? 0) > 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600">
                              {c.coach_languages!.join(' · ')}
                            </span>
                          ) : null}
                          {(c.coach_specialties ?? []).slice(0, 4).map((s, i) => (
                            <span
                              key={`spec-${c.id}-${i}`}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-violet-600/10 dark:bg-violet-400/15 text-violet-950 dark:text-violet-100 border border-violet-300 dark:border-violet-500/40"
                            >
                              {s}
                            </span>
                          ))}
                          {(c.coach_specialties?.length ?? 0) > 4 ? (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              +{(c.coach_specialties!.length ?? 0) - 4}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>

                  <details
                    className="group border-t border-slate-200 dark:border-slate-600 px-4 pb-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <summary className="cursor-pointer list-none py-2 text-sm font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1">
                      <span className="group-open:hidden">{t('chat.seeFullProfile')}</span>
                      <span className="hidden group-open:inline">{t('chat.hideFullProfile')}</span>
                      <span className="transition-transform group-open:rotate-180 text-xs">▾</span>
                    </summary>
                    <div className="pt-2 pb-1 space-y-3 text-sm text-slate-800 dark:text-slate-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-600">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t('chat.responseTime')}
                          </p>
                          <p className="font-semibold mt-0.5">{c.coach_response_time_label || '—'}</p>
                          {c.coach_response_time_hours != null ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              ~{c.coach_response_time_hours} h
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-600">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t('chat.experience')}
                          </p>
                          <p className="font-semibold mt-0.5">
                            {c.coach_years_experience != null && c.coach_years_experience > 0
                              ? t('chat.yearsExp', { n: c.coach_years_experience })
                              : '—'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-600 sm:col-span-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t('chat.languages')}
                          </p>
                          <p className="font-medium mt-0.5">
                            {(c.coach_languages?.length ?? 0) > 0 ? c.coach_languages!.join(', ') : '—'}
                          </p>
                        </div>
                      </div>
                      {(c.coach_specialties?.length ?? 0) > 0 ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                            {t('chat.specialties')}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {c.coach_specialties!.map((s, i) => (
                              <span
                                key={`spec-full-${c.id}-${i}`}
                                className="text-[11px] px-2.5 py-1 rounded-lg bg-violet-600/10 dark:bg-violet-400/15 text-violet-950 dark:text-violet-100 border border-violet-300 dark:border-violet-500/40"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {c.coach_reviews_label ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                            {t('chat.reviews')}
                          </p>
                          <p className="text-sm">{c.coach_reviews_label}</p>
                        </div>
                      ) : null}
                      {c.coach_long_bio ? (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                            {t('chat.longBioLabel')}
                          </p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.coach_long_bio}</p>
                        </div>
                      ) : null}
                    </div>
                  </details>

                  {selected && (
                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        onClick={() => startConv(c.id)}
                        disabled={loading}
                        className="w-full py-3 rounded-2xl bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-lg shadow-violet-600/25 text-sm"
                      >
                        {loading ? '…' : t('chat.startConversation')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </div>
    )
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
  /** Avant `closed_by_role`, seuls coach/admin clôturaient — on affiche le même libellé. */
  const closedByCoachOrLegacy =
    isClosed && (conv?.closed_by_role === 'coach' || conv?.closed_by_role == null || conv?.closed_by_role === '')

  const headerMainTitle = activeCoach
    ? coachPrimaryTitle(activeCoach) ||
      coachProfileDisplayName(activeCoach) ||
      NO_COACH_HEADER
    : coaches.length === 0
      ? NO_COACH_HEADER
      : 'Votre accompagnant'
  const headerSub = activeCoach ? coachSubtitleUnderTitle(activeCoach) : ''
  const coachAriaLabel =
    coachPseudoHandle(activeCoach)
      ? `${coachPrimaryTitle(activeCoach)} · ${coachProfileDisplayName(activeCoach) || 'coach'}`
      : headerMainTitle

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 -mx-4 md:mx-0 md:w-auto">
      <div className="shrink-0 px-4 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-start gap-3">
        {activeCoach?.avatar ? (
          <img
            src={activeCoach.avatar}
            alt={coachAriaLabel}
            className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-600 shrink-0 shadow-sm"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-rose-500 flex items-center justify-center text-white text-lg shrink-0 shadow-sm border border-white/10">
            {activeCoach?.avatar_emoji || '🌿'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2
            className={`text-base sm:text-lg font-bold text-slate-950 dark:!text-white leading-snug tracking-tight truncate ${
              coachPseudoHandle(activeCoach) ? 'font-mono' : ''
            }`}
          >
            {headerMainTitle}
          </h2>
          {headerSub ? (
            <p className="text-xs sm:text-[13px] text-violet-700 dark:text-violet-200 mt-0.5 line-clamp-2 leading-snug">
              {headerSub}
            </p>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Accompagnement personnalisé
            </p>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            {isClosed
              ? closedByCoachOrLegacy
                ? t('chat.closedByCoachHeaderHint')
                : t('chat.closedGenericHeaderHint')
              : `En ligne · ${activeCoach?.coach_response_time_label || 'repond sous 24h'}`}
          </p>
          {!isClosed && (
            <details className="mt-2 group w-full max-w-xl">
              <summary className="text-[12px] text-violet-700 dark:text-violet-300 cursor-pointer list-none inline-flex items-center gap-1 font-medium hover:text-violet-800 dark:hover:text-violet-200">
                {activeCoach ? 'En savoir plus sur ce profil' : "Comment fonctionne l'accompagnement ?"}
                <span className="transition-transform group-open:rotate-180">▾</span>
              </summary>
              {!activeCoach ? (
                <div className="mt-2 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-4 text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed antialiased [text-rendering:optimizeLegibility]">
                  <p className="antialiased">
                    Vous échangez avec <strong className="text-slate-800 dark:text-slate-100">l&apos;équipe Fleur d&apos;AmOurs</strong>.
                    Un accompagnant vous répondra selon les disponibilités. Même cadre : confidentiel, non médical et non juridique.
                  </p>
                </div>
              ) : (
              <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white text-[12px] leading-relaxed shadow-lg ring-1 ring-slate-200/80 dark:border-slate-600 dark:bg-slate-800 dark:ring-slate-600/50 dark:text-slate-100 dark:shadow-slate-950/40">
                <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500" aria-hidden />
                <div className="px-4 py-4 space-y-4 text-slate-800 dark:text-slate-100">
                <div className="flex items-start gap-3 pb-4 border-b border-slate-200 dark:border-slate-600">
                  {activeCoach?.avatar ? (
                    <img
                      src={activeCoach.avatar}
                      alt={coachAriaLabel}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-violet-200 dark:border-violet-500/50 shrink-0 shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl border-2 border-violet-200 dark:border-violet-500/50 bg-gradient-to-br from-violet-500/15 to-rose-500/15 dark:from-violet-900/40 dark:to-rose-900/25 flex items-center justify-center text-3xl shrink-0">
                      {activeCoach?.avatar_emoji || '🌿'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <p
                        className={`font-bold text-base sm:text-lg leading-tight text-slate-950 dark:!text-white ${coachPseudoHandle(activeCoach) ? 'font-mono' : ''}`}
                      >
                        {headerMainTitle}
                      </p>
                      {activeCoach?.coach_verified && (
                        <span className="inline-flex items-center shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-md ring-2 ring-white/90">
                          Vérifié
                        </span>
                      )}
                    </div>
                    {coachPseudoHandle(activeCoach) && coachProfileDisplayName(activeCoach) && (
                      <p className="text-slate-700 dark:text-slate-200 text-[11px] mt-0.5">
                        Nom affiché :{' '}
                        <span className="text-slate-950 dark:!text-white font-semibold">{coachProfileDisplayName(activeCoach)}</span>
                      </p>
                    )}
                    {activeCoach?.coach_headline && (
                      <p className="text-slate-800 dark:text-slate-100 font-medium mt-1 text-[13px] leading-snug">
                        {activeCoach.coach_headline}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {activeCoach?.coach_years_experience != null && activeCoach.coach_years_experience > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-amber-50 dark:bg-amber-500/15 text-amber-950 dark:text-amber-50 border-amber-300 dark:border-amber-400/60">
                          {activeCoach.coach_years_experience}+ ans d&apos;experience
                        </span>
                      )}
                      {activeCoach?.coach_reviews_label && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-violet-50 dark:bg-violet-500/15 text-violet-950 dark:text-violet-50 border-violet-300 dark:border-violet-400/50">
                          {activeCoach.coach_reviews_label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-600 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Délai</p>
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50 mt-0.5">
                      {activeCoach?.coach_response_time_label || 'Sous 24 h'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-600 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Langues</p>
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50 mt-0.5">
                      {(activeCoach?.coach_languages?.length ?? 0) > 0
                        ? activeCoach?.coach_languages?.join(', ')
                        : 'Non renseigné'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-600 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Expérience</p>
                    <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50 mt-0.5">
                      {activeCoach?.coach_years_experience != null && activeCoach.coach_years_experience > 0
                        ? `${activeCoach.coach_years_experience} ans+`
                        : '—'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    À propos
                  </p>
                  <p className="whitespace-pre-wrap text-slate-900 dark:text-slate-100 text-[13px] leading-relaxed">
                    {activeCoach?.coach_short_bio ||
                      "Accompagnement sensible sur les dynamiques relationnelles, la communication et les phases de transition. Espace confidentiel, sans jugement, avec des retours concrets et progressifs."}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Spécialités
                  </p>
                  {(activeCoach?.coach_specialties?.length ?? 0) > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {activeCoach?.coach_specialties?.slice(0, 10).map((s, i) => (
                        <span
                          key={`coach-chip-${i}`}
                          className="px-2.5 py-1 rounded-lg bg-violet-600/10 dark:bg-violet-400/15 border border-violet-300 dark:border-violet-500/40 text-[11px] font-medium text-violet-950 dark:text-violet-100"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-600 dark:text-slate-400 italic">
                      Pas encore renseigné — complétez la section Spécialités dans Mon compte, onglet Profil coach.
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-600 px-3 py-2.5 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Cadre & confidentialité
                  </p>
                  <p className="text-[11px] text-slate-800 dark:text-slate-200 leading-snug">
                    Echanges confidentiels. Accompagnement{' '}
                    <strong className="text-slate-950 dark:text-white">non médical</strong> et{' '}
                    <strong className="text-slate-950 dark:text-white">non juridique</strong>.
                  </p>
                </div>

                {activeCoach?.coach_long_bio && (
                  <details className="group/sub border-t border-slate-200 dark:border-slate-600 pt-3">
                    <summary className="cursor-pointer list-none inline-flex items-center gap-1 text-violet-700 dark:text-violet-300 font-semibold text-[12px]">
                      Voir le profil complet
                      <span className="transition-transform group-open/sub:rotate-180">▾</span>
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-slate-800 dark:text-slate-200 text-[13px] leading-relaxed">
                      {activeCoach.coach_long_bio}
                    </p>
                  </details>
                )}
                </div>
              </div>
              )}
            </details>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 bg-slate-100 dark:bg-slate-900">
        {closedByCoachOrLegacy && (
          <div
            role="status"
            className="rounded-xl border border-amber-200/90 dark:border-amber-700/60 bg-amber-50/95 dark:bg-amber-950/40 px-3.5 py-3 text-sm text-amber-950 dark:text-amber-100 shadow-sm"
          >
            {t('chat.closedByCoachBanner')}
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <div className="text-4xl">💬</div>
            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium max-w-sm mx-auto leading-relaxed">
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
              key={`chat-msg-${i}`}
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
          <AlertBox
            variant="warning"
            onDismiss={() => setError('')}
            dismissLabel={t('chat.close')}
            actions={
              <>
                {error.includes('Session') || error.includes('expirée') ? (
                  <AlertBoxLink href="/login?from=/chat">
                    Se reconnecter
                  </AlertBoxLink>
                ) : (
                  <button
                    type="button"
                    onClick={handleRetrySend}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                  >
                    {t('chat.retrySend')}
                  </button>
                )}
              </>
            }
          >
            {error}
          </AlertBox>
        </div>
      )}

      {isClosed ? (
        <div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-500 dark:text-slate-400">
          {closedByCoachOrLegacy ? t('chat.closedByCoachFooter') : t('chat.closedGenericFooter')}
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
              placeholder={t('chat.placeholder')}
              rows={2}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-none"
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
