'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type WebSpeechProviderOpts = {
  lang: string
  onResult?: (text: string) => void
  onInterim?: (text: string) => void
  onError?: (err: string) => void
  onStateChange?: (state: string) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class WebSpeechProvider {
  private _rec: any
  private _full = ''
  private _lastEmitted = ''
  private _lastFinalIdx = -1

  constructor(opts: WebSpeechProviderOpts) {
    const win = typeof window !== 'undefined' ? (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }) : null
    const SR = win && (win.SpeechRecognition || win.webkitSpeechRecognition) || null
    if (!SR) throw new Error('Web Speech API non supportée sur ce navigateur')

    this._rec = new SR()
    this._rec.lang = opts.lang
    this._rec.continuous = true
    this._rec.interimResults = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const t = (r[0]?.transcript || '').trim()
        if (r.isFinal && i > this._lastFinalIdx) {
          this._lastFinalIdx = i
          if (!t) continue
          const prev = this._full.trim()
          if (t === prev) continue
          if (prev && t.startsWith(prev)) {
            let suffix = t.slice(prev.length).trim()
            if (!suffix) continue
            if (suffix === prev) continue
            if (suffix.startsWith(prev + ' '))
              suffix = suffix.slice(prev.length).trim()
            if (!suffix) continue
            this._full = prev + ' ' + suffix
          } else {
            this._full = prev ? prev + ' ' + t : t
          }
          const out = this._full.trim()
          if (out !== this._lastEmitted) {
            this._lastEmitted = out
            opts.onResult?.(out)
          }
        } else if (!r.isFinal) {
          interim += t
        }
      }
      if (interim) opts.onInterim?.(interim)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._rec.onerror = (e: any) =>
      opts.onError?.(e.error || 'unknown')
    this._rec.onstart = () => opts.onStateChange?.('started')
    this._rec.onend = () => opts.onStateChange?.('stopped')
  }

  start() {
    this._full = ''
    this._lastFinalIdx = -1
    this._lastEmitted = ''
    try {
      this._rec.start()
    } catch (e) {
      // Normalize DOMException / InvalidStateError, etc.
      const msg = (e as { name?: string; message?: string })?.name || (e as Error)?.message || 'start_failed'
      throw new Error(String(msg))
    }
  }

  stop() {
    // Some browsers behave better with abort() before stop() when restarting quickly.
    try { this._rec.abort?.() } catch { /* ignore */ }
    try { this._rec.stop?.() } catch { /* ignore */ }
  }
}

export function useSpeech({
  onResult,
  lang = 'fr-FR',
}: {
  onResult?: (text: string) => void
  lang?: string
} = {}) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const providerRef = useRef<WebSpeechProvider | null>(null)
  const stoppingRef = useRef(false)

  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }) : null
    setSupported(!!(win && (win.SpeechRecognition || win.webkitSpeechRecognition)))
  }, [])

  function humanizeSpeechError(codeOrMsg: string): string {
    const c = String(codeOrMsg || '').toLowerCase().trim()
    if (!c) return 'Erreur micro.'
    if (c.includes('not-allowed') || c.includes('service-not-allowed')) {
      return "Microphone bloqué. Autorise l'accès au micro dans le navigateur, puis réessaie."
    }
    if (c.includes('audio-capture')) return "Aucun micro détecté ou micro occupé par une autre application."
    if (c.includes('network')) return "Erreur réseau du service de dictée (Web Speech). Réessaie dans un instant."
    if (c.includes('aborted')) return "La dictée a été interrompue. Réessaie."
    if (c.includes('invalidstate') || c.includes('invalid_state')) return "Micro déjà en cours/arrêt en cours. Réessaie."
    if (c.includes('web speech api non support')) return "Dictée non supportée sur ce navigateur."
    return `Erreur dictée: ${codeOrMsg}`
  }

  const start = useCallback(() => {
    setTranscript('')
    setInterimText('')
    setError(null)
    try {
      // Best-effort: stop any previous provider before starting a new one.
      providerRef.current?.stop()
      providerRef.current = new WebSpeechProvider({
        lang,
        onResult: (text) => {
          setTranscript(text)
          setInterimText('')
          onResult?.(text)
        },
        onInterim: (text) => setInterimText(text),
        onError: (err) => {
          const code = String(err ?? '')
          // "aborted" is often triggered by our own stop/abort, ignore in that case.
          if (String(code).toLowerCase().includes('aborted') && stoppingRef.current) return
          setError(humanizeSpeechError(code))
          setListening(false)
        },
        onStateChange: (s) => setListening(s === 'started'),
      })
      providerRef.current.start()
      // listening=true will be set by onstart
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e)
      setError(humanizeSpeechError(msg))
      // Don't flip supported to false on transient start errors.
    }
  }, [lang, onResult])

  const stop = useCallback(() => {
    stoppingRef.current = true
    providerRef.current?.stop()
    providerRef.current = null
    setListening(false)
    setInterimText('')
    // Let potential async "aborted" bubble but be ignored.
    window.setTimeout(() => { stoppingRef.current = false }, 250)
  }, [])

  const reset = useCallback(() => {
    stop()
    setTranscript('')
    setInterimText('')
    setError(null)
  }, [stop])

  return { listening, transcript, interimText, supported, error, start, stop, reset }
}
