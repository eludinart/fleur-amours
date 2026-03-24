'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

type InfoBubbleProps = {
  title?: string
  content: string
  placement?: 'bottom' | 'top'
}

export function InfoBubble({ title, content, placement = 'bottom' }: InfoBubbleProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [open])

  return (
    <span ref={triggerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors"
        aria-label="Info"
      >
        ?
      </button>
      {open &&
        createPortal(
          <div
            className="fixed z-[9999] px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs max-w-[220px] shadow-xl"
            style={
              triggerRef.current
                ? placement === 'bottom'
                  ? {
                      top: triggerRef.current.getBoundingClientRect().bottom + 6,
                      left: triggerRef.current.getBoundingClientRect().left,
                    }
                  : {
                      bottom:
                        window.innerHeight - triggerRef.current.getBoundingClientRect().top + 6,
                      left: triggerRef.current.getBoundingClientRect().left,
                    }
                : {}
            }
          >
            {title && <p className="font-semibold mb-1">{title}</p>}
            <p className="text-slate-200 leading-relaxed">{content}</p>
          </div>,
          document.body
        )}
    </span>
  )
}
