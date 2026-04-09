/* eslint-disable no-console */
'use client'

import { ApiError, getResolvedApiBase } from '@/lib/api-client'
import { normalizeTelemetryEnv, type TelemetryTier } from '@/lib/telemetry/env'

/** Env télémétrie côté navigateur (build + hostname). */
export function getClientTelemetryEnv(): TelemetryTier {
  const pub = (
    process.env.NEXT_PUBLIC_TELEMETRY_ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    ''
  ).trim()
  if (pub) return normalizeTelemetryEnv(pub)
  if (typeof window !== 'undefined') {
    return normalizeTelemetryEnv(null, { hostname: window.location.hostname })
  }
  return 'development'
}

export type TelemetryEventName =
  | 'page_view'
  | 'page_duration'
  | 'client_exception'
  | 'unhandled_rejection'
  | 'api_request'
  | 'api_response'
  | 'api_error'
  | 'ui_error_shown'
  | 'flow_start'
  | 'flow_step_view'
  | 'flow_step_submit'
  | 'flow_validation_error'
  | 'flow_abandon'
  | 'flow_complete'
  | 'web_vital'

export type TelemetryEvent = {
  name: TelemetryEventName | (string & {})
  ts?: string
  feature?: string
  session_id?: string
  trace_id?: string
  path?: string
  referrer?: string
  properties?: Record<string, unknown>
}

const ANON_KEY = 'telemetry_anon_id'
const SESSION_KEY = 'telemetry_session_id'

function randomId(len = 16): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function getAnonId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    const existing = localStorage.getItem(ANON_KEY)
    if (existing && existing.length >= 8) return existing
    const id = `a_${randomId(16)}`
    localStorage.setItem(ANON_KEY, id)
    return id
  } catch {
    return `a_${randomId(16)}`
  }
}

export function getTelemetrySessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing && existing.length >= 8) return existing
    const id = `s_${randomId(16)}`
    sessionStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    return `s_${randomId(16)}`
  }
}

type QueueItem = Required<Pick<TelemetryEvent, 'name'>> &
  Omit<TelemetryEvent, 'name'> & {
    ts: string
    anon_id: string
    app_host?: string
    env?: string
  }

const queue: QueueItem[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let isFlushing = false

function buildUrl(): string {
  if (typeof window === 'undefined') return '/api/telemetry/event'
  const base = getResolvedApiBase().replace(/\/+$/, '')
  return `${base}/api/telemetry/event`
}

function scheduleFlush(ms = 1500) {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flush()
  }, ms)
}

export function track(ev: TelemetryEvent) {
  if (typeof window === 'undefined') return
  const item: QueueItem = {
    ...ev,
    name: ev.name,
    ts: ev.ts ?? new Date().toISOString(),
    anon_id: getAnonId(),
    session_id: ev.session_id ?? getTelemetrySessionId(),
    path: ev.path ?? window.location.pathname + window.location.search,
    referrer: ev.referrer ?? document.referrer ?? '',
    app_host: window.location.host,
    env: getClientTelemetryEnv(),
    properties: ev.properties ?? {},
  }
  queue.push(item)
  if (queue.length >= 20) {
    void flush()
  } else {
    scheduleFlush()
  }
}

export async function flush() {
  if (typeof window === 'undefined') return
  if (isFlushing) return
  if (queue.length === 0) return
  isFlushing = true

  const batch = queue.splice(0, 50)
  const payload = JSON.stringify({ events: batch })
  const url = buildUrl()

  try {
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))
      if (!ok) {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          credentials: 'include',
          keepalive: true,
        })
      }
    } else {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        credentials: 'include',
        keepalive: true,
      })
    }
  } catch {
    // best-effort : remettre en file (cap à 200)
    queue.unshift(...batch)
    if (queue.length > 200) queue.splice(200)
  } finally {
    isFlushing = false
    if (queue.length > 0) scheduleFlush(2500)
  }
}

export function captureError(err: unknown, extra: Record<string, unknown> = {}) {
  const e = err as any
  const isApi = e instanceof ApiError
  track({
    name: 'client_exception',
    feature: 'global',
    properties: {
      message: String(e?.message ?? 'Erreur'),
      stack: typeof e?.stack === 'string' ? e.stack.slice(0, 4000) : undefined,
      kind: isApi ? 'ApiError' : typeof e?.name === 'string' ? e.name : 'Error',
      api_status: isApi ? (e as ApiError).status : undefined,
      api_code: isApi ? (e as ApiError).code : undefined,
      ...extra,
    },
  })
}

export function initGlobalErrorCapture() {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    captureError(event.error ?? event.message, {
      source: 'window.error',
      filename: (event as any)?.filename,
      lineno: (event as any)?.lineno,
      colno: (event as any)?.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    captureError((event as PromiseRejectionEvent).reason, { source: 'unhandledrejection' })
    track({
      name: 'unhandled_rejection',
      feature: 'global',
      properties: { reason: String((event as PromiseRejectionEvent).reason ?? '') },
    })
  })
}

export function trackWebVital(name: string, value: number, rating?: string, id?: string) {
  track({
    name: 'web_vital',
    feature: 'perf',
    properties: { name, value, rating, id },
  })
}

