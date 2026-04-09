// @ts-nocheck
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTuteurSend } from '@/hooks/useTuteurSend'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

type Msg = { role: 'user' | 'assistant'; content: string }

function buildOpeningTranscript(petals: Record<string, number>, locale: string): string {
  const blob = JSON.stringify(petals ?? {})
  if (locale === 'en') {
    return `[Dashboard] I'm opening the Tutor from my garden view. My petal snapshot (0–1) is roughly: ${blob}. Please welcome me warmly in 2–3 short sentences — you already have this context, don't ask me to repeat it — then offer one gentle question.`
  }
  if (locale === 'es') {
    return `[Panel] Abro al Tutor desde mi jardín. Mi instantánea de pétalos (0–1) es aproximadamente: ${blob}. Acógeme con calor en 2–3 frases cortas (ya tienes este contexto) y luego una sola pregunta suave.`
  }
  return `[Tableau de bord] J'ouvre le Tuteur depuis mon jardin. Mon instantané des pétales (0–1) est environ : ${blob}. Accueille-moi avec chaleur en 2–3 phrases courtes — tu as déjà ce contexte, ne me demande pas de tout répéter — puis une seule question douce.`
}

export function DashboardTuteurFab({
  petals,
  className = '',
}: {
  petals: Record<string, number>
  className?: string
}) {
  const locale = useStore((s) => s.locale)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [turn, setTurn] = useState(0)
  const [fabMounted, setFabMounted] = useState(false)
  const sentOpeningRef = useRef(false)
  const petalsRef = useRef(petals)
  petalsRef.current = petals

  useEffect(() => {
    setFabMounted(true)
  }, [])

  const { send, status, retry } = useTuteurSend({
    onSuccess: (res) => {
      const a = String(res.response_a ?? '').trim()
      const q = String(res.question ?? '').trim()
      const block = [a, q].filter(Boolean).join('\n\n')
      setMessages((m) => [...m, { role: 'assistant', content: block || t('session.tuteurWelcoming') }])
      setTurn((t) => t + 1)
    },
    onError: (msg) => {
      setMessages((m) => [...m, { role: 'assistant', content: msg || t('insight.error') }])
    },
  })

  const runOpening = useCallback(() => {
    const opening = buildOpeningTranscript(petalsRef.current, locale)
    void send({
      transcript: opening,
      history: [],
      current_petals: petalsRef.current,
      card_name: '',
      card_group: 'love',
      turn: 0,
      locked_doors: [],
      overridden_petals: {},
    })
  }, [send, locale])

  useEffect(() => {
    if (!open) {
      sentOpeningRef.current = false
      return
    }
    if (sentOpeningRef.current) return
    sentOpeningRef.current = true
    runOpening()
  }, [open, runOpening])

  const handleClose = () => {
    setOpen(false)
  }

  const handleSendUser = () => {
    const text = input.trim()
    if (!text || status === 'sending') return
    setInput('')
    const hist: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(hist)
    void send({
      transcript: text,
      history: hist.map((x) => ({ role: x.role, content: x.content })),
      current_petals: petalsRef.current,
      card_name: '',
      card_group: 'love',
      turn: turn + 1,
      locked_doors: [],
      overridden_petals: {},
    })
  }

  const fabButton = (
    <button
      type="button"
      onClick={() => {
        setMessages([])
        setTurn(0)
        setOpen(true)
      }}
      className={`fixed z-[200] flex items-center gap-2 px-4 py-3 rounded-full shadow-lg shadow-violet-500/30 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold hover:opacity-95 transition-opacity bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] md:right-[max(1.75rem,env(safe-area-inset-right,0px))] ${className}`}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <span className="text-lg" aria-hidden>
        ✦
      </span>
      {t('dashboard.tuteurFab')}
    </button>
  )

  return (
    <>
      {fabMounted && typeof document !== 'undefined' ? createPortal(fabButton, document.body) : null}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-label={t('dashboard.tuteurFab')}
                onClick={(e) => e.target === e.currentTarget && handleClose()}
              >
                <motion.div
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 16, opacity: 0 }}
                  className="w-full max-w-md max-h-[min(70vh,520px)] flex flex-col rounded-2xl border border-violet-200/40 dark:border-violet-800/50 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/80">
                    <p className="text-sm font-bold text-violet-600 dark:text-violet-300 uppercase tracking-widest">
                      ✦ {t('session.tuteur')}
                    </p>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm px-2 py-1 rounded-lg"
                    >
                      {t('common.close')}
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
                    {messages.map((m, i) => (
                      <div
                        key={i}
                        className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                          m.role === 'user'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 ml-6'
                            : 'bg-violet-50/90 dark:bg-violet-950/40 text-slate-800 dark:text-slate-100 mr-4 border border-violet-100/80 dark:border-violet-900/50'
                        }`}
                      >
                        {m.content}
                      </div>
                    ))}
                    {status === 'sending' && (
                      <p className="text-xs text-violet-500 dark:text-violet-400 italic text-center animate-pulse">
                        {t('session.tuteurListening')}
                      </p>
                    )}
                  </div>
                  <div className="p-3 border-t border-slate-200/80 dark:border-slate-700/80 flex gap-2">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendUser())}
                      placeholder={t('dashboard.tuteurInputPlaceholder')}
                      className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      disabled={status === 'sending'}
                    />
                    <button
                      type="button"
                      onClick={handleSendUser}
                      disabled={status === 'sending' || !input.trim()}
                      className="shrink-0 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium disabled:opacity-40"
                    >
                      →
                    </button>
                  </div>
                  {status === 'error' && (
                    <div className="px-3 pb-2">
                      <button type="button" onClick={() => retry()} className="text-xs text-amber-600 underline">
                        {t('common.retry')}
                      </button>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}
