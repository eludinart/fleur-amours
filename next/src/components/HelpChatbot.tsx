'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { aiApi } from '@/api/ai'
import { t } from '@/i18n'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const SUGGESTION_KEYS = ['s0', 's1', 's2', 's3'] as const

export function HelpChatbot() {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [open, messages])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return
      setError('')
      const userMsg: ChatMsg = { role: 'user', content: trimmed }
      const nextHistory = [...messages, userMsg]
      setMessages(nextHistory)
      setInput('')
      setLoading(true)
      try {
        const res = await aiApi.helpChat({
          message: trimmed,
          history: messages,
          current_page: pathname,
        })
        const reply = String((res as { reply?: string })?.reply ?? '').trim()
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: reply || t('helpChatbot.error') },
        ])
      } catch {
        setError(t('helpChatbot.error'))
      } finally {
        setLoading(false)
      }
    },
    [loading, messages, pathname]
  )

  function handleSuggestion(key: (typeof SUGGESTION_KEYS)[number]) {
    void send(t(`helpChatbot.${key}query`))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[120] flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-rose-500 text-xl text-white shadow-lg shadow-violet-500/30 transition hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        aria-label={t('helpChatbot.label')}
        title={t('helpChatbot.label')}
      >
        {open ? '✕' : '💬'}
      </button>

      {open ? (
        <div
          className="fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.5rem)] right-4 z-[120] flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 md:bottom-[5.5rem] md:right-6"
          role="dialog"
          aria-label={t('helpChatbot.title')}
        >
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-rose-50 px-4 py-3 dark:border-slate-800 dark:from-violet-950/40 dark:to-rose-950/30">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('helpChatbot.title')}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('helpChatbot.label')}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-white/80 dark:hover:bg-slate-800"
            >
              {t('helpChatbot.close')}
            </button>
          </header>

          <div ref={listRef} className="flex max-h-64 min-h-[8rem] flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {t('helpChatbot.suggestionsLabel')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTION_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleSuggestion(k)}
                      className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] text-violet-800 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                    >
                      {t(`helpChatbot.${k}label`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[92%] rounded-xl px-3 py-2 leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-auto bg-violet-600 text-white text-xs'
                    : 'mr-auto border border-slate-100 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 text-ai-prose'
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading ? (
              <p className="text-[11px] italic text-slate-400">{t('common.loading')}</p>
            ) : null}
            {error ? <p className="text-[11px] text-rose-500">{error}</p> : null}
          </div>

          <form
            className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('helpChatbot.placeholder')}
              disabled={loading}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-violet-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              →
            </button>
          </form>
        </div>
      ) : null}
    </>
  )
}
