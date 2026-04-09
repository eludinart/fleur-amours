import { api } from '@/lib/api-client'

export type TelemetryEventItem = {
  id: number
  ts: string
  name: string
  user_id: number | null
  anon_id: string | null
  path?: string | null
  referrer?: string | null
  trace_id?: string | null
  session_id?: string | null
  feature?: string | null
  env?: string | null
  app_host?: string | null
  properties?: Record<string, unknown>
}

export const telemetryApi = {
  list: ({
    from,
    to,
    event,
    user_id,
    anon_id,
    limit = 200,
  }: {
    from?: string
    to?: string
    event?: string
    user_id?: number
    anon_id?: string
    limit?: number
  } = {}) => {
    const p = new URLSearchParams()
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (event) p.set('event', event)
    if (typeof user_id === 'number') p.set('user_id', String(user_id))
    if (anon_id) p.set('anon_id', anon_id)
    p.set('limit', String(limit))
    return api.get(`/api/telemetry/events?${p.toString()}`) as Promise<{ items: TelemetryEventItem[] }>
  },
}

