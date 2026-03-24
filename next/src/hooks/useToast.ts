'use client'

import { useState, useCallback } from 'react'

let _globalAdd: ((t: { message: string; type: string; id: number }) => void) | null = null
export function _setGlobalToastAdd(fn: (t: { message: string; type: string; id: number }) => void) {
  _globalAdd = fn
}

export function toast(message: string, type: 'info' | 'success' | 'error' = 'info') {
  _globalAdd?.({ message, type, id: Date.now() + Math.random() })
}

type ToastItem = { message: string; type: string; id: number }

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const add = useCallback((t: ToastItem) => {
    setToasts((prev) => [...prev, t])
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000)
  }, [])

  if (typeof window !== 'undefined') {
    _setGlobalToastAdd(add)
  }

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  return { toasts, remove }
}
