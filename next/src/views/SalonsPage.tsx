// @ts-nocheck
'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { socialApi } from '@/api/social'
import { PETAL_DEFS, PETAL_BY_ID } from '@/lib/petal-theme'
import { t } from '@/i18n'

function timeAgo(iso) {
  if (!iso) return ''
  const ts = new Date(String(iso).replace(' ', 'T')).getTime()
  if (!Number.isFinite(ts)) return ''
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h`
  return new Date(ts).toLocaleDateString()
}

export default function SalonsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const segments = (pathname || '').replace(/^\/+/, '').split('/').filter(Boolean)
  const activePetal = segments[0] === 'salons' && segments[1] ? segments[1] : PETAL_DEFS[0].id

  const [summaries, setSummaries] = useState([])
  const [messages, setMessages] = useState([])
  const [postStatus, setPostStatus] = useState({ remainingToday: 8, dailyLimit: 8 })
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const loadSummaries = useCallback(async () => {
    try {
      const data = await socialApi.listSalons()
      setSummaries(data?.salons ?? [])
      if (data?.postStatus) setPostStatus(data.postStatus)
    } catch {
      /* ignore */
    }
  }, [])

  const loadSalon = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await socialApi.getSalon(activePetal)
      setMessages(data?.messages ?? [])
      if (data?.postStatus) setPostStatus(data.postStatus)
    } catch (err) {
      setError((err as Error)?.message || '')
    } finally {
      setLoading(false)
    }
  }, [activePetal])

  useEffect(() => {
    loadSummaries()
  }, [loadSummaries])

  useEffect(() => {
    loadSalon()
    const id = setInterval(loadSalon, 45000)
    return () => clearInterval(id)
  }, [loadSalon])

  const handlePost = async () => {
    if (!draft.trim()) return
    setSending(true)
    setError('')
    try {
      await socialApi.postSalonMessage(activePetal, draft.trim())
      setDraft('')
      await loadSalon()
      await loadSummaries()
    } catch (err) {
      setError((err as Error)?.message || '')
    } finally {
      setSending(false)
    }
  }

  const petalDef = PETAL_BY_ID[activePetal]

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <header className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/60">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">🏛️ {t('salons.title')}</h1>
        <p className="text-xs text-slate-500">{t('salons.subtitle')}</p>
      </header>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <aside className="shrink-0 md:w-52 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 p-2 overflow-x-auto md:overflow-y-auto">
          <div className="flex md:flex-col gap-1">
            {PETAL_DEFS.map((p) => {
              const sum = summaries.find((s) => s.salonId === p.id)
              const active = activePetal === p.id
              return (
                <Link
                  key={p.id}
                  href={`/salons/${p.id}`}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span style={active ? undefined : { color: p.color }}>{p.name}</span>
                  {sum?.messagesToday > 0 && (
                    <span className={`text-xs ${active ? 'text-violet-100' : 'text-slate-400'}`}>
                      {sum.messagesToday}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          <div
            className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-700"
            style={{ backgroundColor: petalDef ? `${petalDef.color}12` : undefined }}
          >
            <h2 className="text-base font-semibold" style={{ color: petalDef?.color }}>
              {petalDef?.name ?? activePetal}
            </h2>
            <p className="text-sm text-slate-500">{t('salons.roomHint')}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {loading && messages.length === 0 ? (
              <p className="text-sm text-slate-500 animate-pulse">{t('common.loading')}</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-slate-500">{t('salons.empty')}</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      type="button"
                      onClick={() => router.push(`/lisiere/${msg.userId}`)}
                      className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-violet-600"
                    >
                      {msg.avatarEmoji} {msg.pseudo}
                    </button>
                    <span className="text-xs text-slate-400">{timeAgo(msg.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{msg.body}</p>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 p-3 border-t border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950/80">
            <p className="text-xs text-slate-500 mb-2">
              {t('salons.remaining', { count: postStatus.remainingToday, limit: postStatus.dailyLimit })}
            </p>
            {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={t('salons.placeholder')}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm resize-none"
              />
              <button
                type="button"
                onClick={handlePost}
                disabled={sending || !draft.trim() || postStatus.remainingToday <= 0}
                className="self-end px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {t('salons.post')}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
