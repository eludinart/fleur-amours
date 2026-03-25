'use client'

import { useState, useCallback, useRef } from 'react'
import { aiApi } from '@/api/ai'
import { ApiError } from '@/lib/api-client'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2000

type TuteurPayload = {
  card_name: string
  card_group: string
  transcript: string
  history: Array<{ role: string; content: string }>
  current_petals: Record<string, number>
  overridden_petals: Record<string, number>
  locked_doors: string[]
  turn: number
}

type TuteurResponse = {
  petals: Record<string, number>
  petals_deficit: Record<string, number>
  response_a: string
  question: string
  thread_context?: unknown
  suggest_card?: { door: string; card_name?: string; reason?: string }
  turn_complete?: boolean
  shadow_level?: number
  shadow_urgent?: boolean
  resource_card?: string | null
  door_summary_preview?: unknown
  next_door_suggestion?: { door: string; reason?: string }
  explore_petal?: string | null
  shadow_detected?: boolean
  _openrouter_error?: string
}

export type TuteurSendStatus = 'idle' | 'sending' | 'error'

export function useTuteurSend(options: {
  onSuccess: (res: TuteurResponse) => void
  onError: (message: string) => void
}) {
  const { onSuccess, onError } = options
  const [status, setStatus] = useState<TuteurSendStatus>('idle')
  const [retryCount, setRetryCount] = useState(0)
  const lastPayloadRef = useRef<TuteurPayload | null>(null)

  const send = useCallback(
    async (payload: TuteurPayload) => {
      lastPayloadRef.current = payload
      setStatus('sending')

      const attempt = async (attemptNumber: number): Promise<void> => {
        try {
          const res = (await aiApi.tuteur(payload)) as TuteurResponse
          setStatus('idle')
          setRetryCount(0)
          onSuccess(res)
        } catch (e: unknown) {
          if (e instanceof ApiError && e.status === 402) {
            setStatus('error')
            setRetryCount(0)
            onError(e.detail || 'Solde SAP insuffisant.')
            return
          }
          const err = e as { detail?: string; message?: string }
          const rawMessage = err?.detail ?? err?.message ?? ''

          if (attemptNumber < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attemptNumber + 1)))
            return attempt(attemptNumber + 1)
          }

          setStatus('error')
          setRetryCount(attemptNumber)
          onError(rawMessage)
        }
      }

      await attempt(0)
    },
    [onSuccess, onError]
  )

  const retry = useCallback(() => {
    const payload = lastPayloadRef.current
    if (payload) {
      setRetryCount(0)
      send(payload)
    }
  }, [send])

  const clearError = useCallback(() => {
    setStatus('idle')
    setRetryCount(0)
  }, [])

  return { send, status, retry, clearError }
}
