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
    this._rec.start()
  }

  stop() {
    this._rec.stop()
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

  useEffect(() => {
    const win = typeof window !== 'undefined' ? (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }) : null
    setSupported(!!(win && (win.SpeechRecognition || win.webkitSpeechRecognition)))
  }, [])

  const start = useCallback(() => {
    setTranscript('')
    setInterimText('')
    setError(null)
    try {
      providerRef.current = new WebSpeechProvider({
        lang,
        onResult: (text) => {
          setTranscript(text)
          setInterimText('')
          onResult?.(text)
        },
        onInterim: (text) => setInterimText(text),
        onError: (err) => {
          setError(String(err))
          setListening(false)
        },
        onStateChange: (s) => setListening(s === 'started'),
      })
      providerRef.current.start()
      setListening(true)
    } catch (e) {
      setError((e as Error).message)
      setSupported(false)
    }
  }, [lang, onResult])

  const stop = useCallback(() => {
    providerRef.current?.stop()
    setListening(false)
    setInterimText('')
  }, [])

  const reset = useCallback(() => {
    stop()
    setTranscript('')
    setInterimText('')
    setError(null)
  }, [stop])

  return { listening, transcript, interimText, supported, error, start, stop, reset }
}
