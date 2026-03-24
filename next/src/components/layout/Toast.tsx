'use client'

import { useToasts } from '@/hooks/useToast'

const STYLES: Record<string, string> = {
  info: 'bg-slate-800 text-white',
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
}

export function ToastContainer() {
  const { toasts, remove } = useToasts()
  return (
    <div
      className="fixed right-4 z-50 flex flex-col gap-2 pointer-events-none"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom, 48px))' }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium cursor-pointer transition-all ${
            STYLES[t.type] ?? STYLES.info
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
