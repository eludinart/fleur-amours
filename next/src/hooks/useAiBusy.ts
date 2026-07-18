'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * État « IA en réflexion » partagé : verrouillage formulaire + chronomètre.
 * Utiliser pour tout appel modèle qui peut durer plusieurs secondes.
 */
export function useAiBusy(active: boolean): {
  busy: boolean
  elapsedSec: number
  /** À passer à aria-busy / pointer-events */
  lockProps: { 'aria-busy': boolean; 'aria-live': 'polite' }
} {
  const [elapsedSec, setElapsedSec] = useState(0)
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      startedAtRef.current = null
      setElapsedSec(0)
      return
    }
    startedAtRef.current = Date.now()
    setElapsedSec(0)
    const id = window.setInterval(() => {
      const start = startedAtRef.current
      if (start == null) return
      setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    }, 250)
    return () => window.clearInterval(id)
  }, [active])

  return {
    busy: active,
    elapsedSec,
    lockProps: {
      'aria-busy': active,
      'aria-live': 'polite',
    },
  }
}

/** Formate 0 → "", 5 → "5 s", 75 → "1 min 15 s" */
export function formatAiElapsed(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return ''
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m} min ${s} s` : `${m} min`
}

export function useAiBusyControls(): {
  busy: boolean
  elapsedSec: number
  start: () => void
  stop: () => void
  lockProps: { 'aria-busy': boolean; 'aria-live': 'polite' }
} {
  const [busy, setBusy] = useState(false)
  const { elapsedSec, lockProps } = useAiBusy(busy)
  const start = useCallback(() => setBusy(true), [])
  const stop = useCallback(() => setBusy(false), [])
  return { busy, elapsedSec, start, stop, lockProps }
}
