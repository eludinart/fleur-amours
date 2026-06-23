// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import { CLAIRIERE_REACTION_EMOJIS } from '@/lib/clairiere-reactions'
import { t } from '@/i18n'

/**
 * Réactions emoji sur un message Clairière (style réseaux sociaux).
 */
export function MessageReactions({
  messageId,
  reactions = [],
  isMe,
  onToggle,
  disabled = false,
  className = '',
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [toggling, setToggling] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!pickerOpen) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [pickerOpen])

  const handleToggle = async (emoji) => {
    if (disabled || toggling || !messageId || String(messageId).startsWith('tmp-')) return
    setToggling(true)
    try {
      await onToggle?.(messageId, emoji)
    } finally {
      setToggling(false)
      setPickerOpen(false)
    }
  }

  const canReact = messageId && !String(messageId).startsWith('tmp-')

  const emojiFont =
    'Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji, sans-serif'

  return (
    <div
      ref={wrapRef}
      className={`relative flex flex-wrap items-center gap-1.5 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'} ${className}`}
    >
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={disabled || toggling || !canReact}
          onClick={() => handleToggle(r.emoji)}
          className={`inline-flex items-center gap-1 min-h-[2rem] px-2.5 py-1 rounded-full transition-colors shadow-sm ${
            r.mine
              ? 'bg-violet-100 dark:bg-violet-900/70 border-2 border-violet-400/70 dark:border-violet-400/80'
              : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
          } disabled:opacity-50`}
          title={t('social.reactionToggle') ?? 'Ajouter ou retirer cette réaction'}
        >
          <span
            aria-hidden
            className="text-[1.35rem] leading-none select-none"
            style={{ fontFamily: emojiFont }}
          >
            {r.emoji}
          </span>
          {r.count > 1 && (
            <span className="text-xs tabular-nums font-semibold text-slate-600 dark:text-slate-300">
              {r.count}
            </span>
          )}
        </button>
      ))}

      {canReact && (
        <div className="relative">
          <button
            type="button"
            disabled={disabled || toggling}
            onClick={() => setPickerOpen((v) => !v)}
            className={`inline-flex items-center justify-center min-w-[2rem] min-h-[2rem] px-2 rounded-full border-2 shadow-sm transition-colors disabled:opacity-50 ${
              pickerOpen
                ? 'bg-violet-100 dark:bg-violet-900/60 border-violet-400/70 text-violet-700 dark:text-violet-200'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title={t('social.reactionAdd') ?? 'Réagir'}
            aria-label={t('social.reactionAdd') ?? 'Réagir'}
          >
            {pickerOpen ? (
              <span className="text-lg font-bold leading-none">×</span>
            ) : (
              <span
                className="text-[1.25rem] leading-none select-none"
                style={{ fontFamily: emojiFont }}
                aria-hidden
              >
                🙂
              </span>
            )}
          </button>

          {pickerOpen && (
            <div
              className={`absolute z-30 bottom-full mb-2 flex flex-wrap gap-1 p-2 rounded-2xl border-2 border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10 max-w-[min(100vw-2rem,18rem)] ${
                isMe ? 'right-0' : 'left-0'
              }`}
              role="listbox"
              aria-label={t('social.reactionPicker') ?? 'Choisir une réaction'}
            >
              {CLAIRIERE_REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="option"
                  disabled={toggling}
                  onClick={() => handleToggle(emoji)}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:bg-violet-50 dark:hover:bg-violet-950/50 hover:border-violet-300 dark:hover:border-violet-600 hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                  title={emoji}
                >
                  <span
                    className="text-[1.75rem] leading-none select-none"
                    style={{ fontFamily: emojiFont }}
                    aria-hidden
                  >
                    {emoji}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
