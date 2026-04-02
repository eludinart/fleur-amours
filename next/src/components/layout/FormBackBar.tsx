'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  pathWithoutBase,
  isImmersiveParcoursPath,
  recordFormNavigationStep,
  popFormBackTarget,
  getFormBackStackDepth,
} from '@/lib/form-back-stack'
import { t } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export function FormBackBar() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const prevSegRef = useRef<string | null>(null)
  const [depth, setDepth] = useState(0)

  const seg = pathWithoutBase(pathname, basePath)

  const refreshDepth = useCallback(() => {
    setDepth(getFormBackStackDepth())
  }, [])

  useEffect(() => {
    const fromSeg = prevSegRef.current
    prevSegRef.current = seg

    if (fromSeg === null) {
      refreshDepth()
      return
    }

    recordFormNavigationStep(fromSeg, seg, { emit: refreshDepth })
  }, [seg, refreshDepth])

  const onBack = () => {
    const target = popFormBackTarget()
    refreshDepth()
    if (target === null) return
    const href = target === '' ? '/' : `/${target}`
    router.push(href)
  }

  if (isImmersiveParcoursPath(seg)) return null
  if (depth <= 0) return null

  return (
    <div className="shrink-0 flex items-center gap-2 mb-3 -mt-1">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/90 dark:hover:bg-slate-700/90 border border-slate-200/80 dark:border-slate-600/80 transition-colors"
        aria-label={t('layout.formBackAria')}
        title={t('layout.formBackAria')}
      >
        <span className="text-lg leading-none" aria-hidden>
          ←
        </span>
        <span>{t('layout.formBack')}</span>
      </button>
    </div>
  )
}
