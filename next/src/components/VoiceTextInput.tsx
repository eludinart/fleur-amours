'use client'

import { useState, useEffect, useRef } from 'react'
import { useSpeech } from '@/hooks/useSpeech'
import { NoteCard } from '@/components/NoteCard'

type VoiceTextInputProps = {
  value?: string
  onChange?: (text: string) => void
  onSubmit?: () => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  submitLabel?: string
  submitDisabled?: boolean
  loading?: boolean
  loadingText?: string
  className?: string
  lang?: string
  compact?: boolean
  autoStart?: boolean
  onLiveUpdate?: (text: string) => void
}

export function VoiceTextInput({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Écrivez ou dictez votre réponse…',
  rows = 2,
  disabled = false,
  submitLabel,
  submitDisabled = false,
  loading = false,
  loadingText = 'Envoi…',
  className = '',
  lang = 'fr-FR',
  compact = false,
  autoStart = false,
  onLiveUpdate,
}: VoiceTextInputProps) {
  const baseAtStartRef = useRef('')
  const { listening, interimText, supported, error: speechError, start, stop, reset } =
    useSpeech({
      onResult: (t) => {
        if (!t) return
        const base = baseAtStartRef.current
        onChange?.(base.trimEnd() ? `${base.trimEnd()} ${t}`.trim() : t)
      },
      lang,
    })

  const [hasAutoStarted, setHasAutoStarted] = useState(false)
  useEffect(() => {
    if (autoStart && supported && !listening && !hasAutoStarted) {
      const timer = setTimeout(() => {
        baseAtStartRef.current = value ?? ''
        start()
        setHasAutoStarted(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [autoStart, supported, listening, hasAutoStarted, start, value])

  const displayValue = (() => {
    if (!listening || !interimText) return value ?? ''
    const base = (value ?? '').trimEnd()
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    if (norm(base).endsWith(norm(interimText))) return value ?? ''
    return base ? `${base} ${interimText}` : interimText
  })()

  useEffect(() => {
    if (onLiveUpdate) onLiveUpdate(displayValue)
  }, [displayValue, onLiveUpdate])

  function toggleMic() {
    if (listening) stop()
    else {
      baseAtStartRef.current = value ?? ''
      reset()
      start()
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (listening) stop()
    onChange?.(e.target.value)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      onSubmit &&
      !disabled &&
      !loading
    ) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {speechError && (
        <NoteCard className="text-xs py-2 px-3">
          {speechError}
        </NoteCard>
      )}

      <div className="space-y-2">
        <textarea
          value={displayValue}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={
            listening
              ? 'Parlez…'
              : supported
                ? placeholder
                : placeholder.replace('ou dictez ', '')
          }
          rows={rows}
          disabled={disabled || loading}
          className={`w-full px-3 py-2.5 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 resize-none leading-relaxed disabled:opacity-50
            ${
              listening
                ? 'border-rose-400 dark:border-rose-600 bg-rose-50/40 dark:bg-rose-950/20 focus:ring-rose-400/40'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-violet-400/40'
            }`}
        />

        <div className="flex gap-2 items-center">
          {supported && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={disabled}
              className={`relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-all active:scale-95
                ${
                  listening
                    ? 'bg-rose-500 shadow-rose-500/40 scale-105'
                    : disabled
                      ? 'bg-slate-100 dark:bg-slate-800 opacity-40 cursor-not-allowed'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-rose-400'
                }`}
              title={listening ? "Arrêter la dictée" : "Dicter à l'oral"}
            >
              {listening && (
                <span className="absolute inset-0 rounded-xl bg-rose-500 animate-ping opacity-30" />
              )}
              <svg
                viewBox="0 0 24 24"
                className={`w-5 h-5 ${listening ? 'text-white' : 'text-slate-500'}`}
                fill="currentColor"
              >
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm7.07 8.93A7 7 0 0 1 5 12H3a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12h-2a7 7 0 0 1-.93 3.07z" />
              </svg>
            </button>
          )}

          {(submitLabel || compact) && onSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={
                !displayValue.trim() || submitDisabled || loading || disabled
              }
              className={`flex-1 h-11 rounded-xl font-semibold text-sm transition-all active:scale-95 flex items-center justify-center
                ${compact ? 'min-w-[44px]' : 'px-4'}
                ${
                  displayValue.trim() && !submitDisabled && !loading
                    ? 'bg-gradient-to-r from-violet-500 to-rose-500 text-white shadow-md'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              title={submitLabel || 'Envoyer'}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              ) : compact ? (
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="currentColor"
                >
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              ) : (
                submitLabel
              )}
            </button>
          )}
        </div>
      </div>

      {loading && loadingText && (
        <p className="text-xs text-violet-400 italic text-center animate-pulse">
          {loadingText}
        </p>
      )}
    </div>
  )
}
