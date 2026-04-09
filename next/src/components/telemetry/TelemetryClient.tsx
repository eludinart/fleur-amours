'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { initGlobalErrorCapture, track, flush, trackWebVital } from '@/lib/telemetry/client'

function useWebVitals() {
  useEffect(() => {
    // Best-effort: `web-vitals` is not a dependency; use Next.js built-in global if present.
    // If you later add `web-vitals`, wire it here without changing callers.
    const anyWin = window as any
    const report = anyWin?.__NEXT_REPORT_WEB_VITALS__
    if (typeof report === 'function') {
      report((metric: any) => {
        if (!metric) return
        trackWebVital(metric.name, metric.value, metric.rating, metric.id)
      })
    }
  }, [])
}

export function TelemetryClient() {
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const lastPathRef = useRef<string>('')
  const lastTsRef = useRef<number>(Date.now())

  useWebVitals()

  useEffect(() => {
    initGlobalErrorCapture()

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        const durationMs = Date.now() - lastTsRef.current
        track({
          name: 'page_duration',
          feature: 'nav',
          properties: { path: lastPathRef.current || window.location.pathname, duration_ms: durationMs },
        })
        void flush()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', () => void flush())
    return () => {
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    const qs = searchParams?.toString() || ''
    const fullPath = `${pathname}${qs ? `?${qs}` : ''}`
    const prev = lastPathRef.current

    if (prev) {
      const durationMs = Date.now() - lastTsRef.current
      track({
        name: 'page_duration',
        feature: 'nav',
        properties: { path: prev, duration_ms: durationMs, to: fullPath },
      })
    }

    lastPathRef.current = fullPath
    lastTsRef.current = Date.now()

    track({
      name: 'page_view',
      feature: 'nav',
      properties: { path: fullPath },
    })
  }, [pathname, searchParams])

  return null
}

