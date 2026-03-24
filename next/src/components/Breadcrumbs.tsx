'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

const LABELS: Record<string, string> = {
  [basePath]: 'nav.home',
  [`${basePath}/session`]: 'nav.session',
  [`${basePath}/fleur`]: 'nav.fleur',
  [`${basePath}/duo`]: 'nav.duo',
  [`${basePath}/mes-fleurs`]: 'nav.mesFleurs',
  [`${basePath}/tirage`]: 'nav.tirages',
  [`${basePath}/dreamscape`]: 'dreamscape',
  [`${basePath}/dreamscape/historique`]: 'dreamscapeHistorique.history',
  [`${basePath}/contact`]: 'contact',
  [`${basePath}/chat`]: 'chat',
  [`${basePath}/account`]: 'account',
  [`${basePath}/presentation`]: 'presentation',
}

const FALLBACK: Record<string, string> = {
  dreamscape: 'Promenade Onirique',
  contact: 'Contact',
  chat: 'Chat coach',
  account: 'Mon compte',
  presentation: 'Présentation',
}

function pathToLabel(path: string): string {
  const key = LABELS[path]
  if (key) {
    const val = t(key)
    if (val !== key) return val
    return FALLBACK[key] ?? key
  }
  if (path.includes('/session/')) return t('nav.session')
  return path.split('/').filter(Boolean).pop() || t('detail')
}

type BreadcrumbsProps = {
  extra?: string[]
}

export function Breadcrumbs({ extra = [] }: BreadcrumbsProps) {
  const pathname = usePathname()
  useStore((s) => s.locale)
  const pathnames = (pathname || '').replace(basePath, '').split('/').filter(Boolean)

  const segments = pathnames.map((seg, i) => ({
    path: basePath + '/' + pathnames.slice(0, i + 1).join('/'),
    label:
      i === 0
        ? pathToLabel(basePath + '/' + seg)
        : pathToLabel(basePath + '/' + pathnames.slice(0, i + 1).join('/')),
  }))

  if (segments.length === 0 && extra.length === 0) return null

  return (
    <nav
      aria-label="Fil d'Ariane"
      className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap"
    >
      <Link
        href="/"
        className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        {t('nav.home')}
      </Link>
      {segments.map((s, i) => (
        <span key={s.path} className="flex items-center gap-1.5">
          <span className="text-slate-300 dark:text-slate-600">/</span>
          {i < segments.length - 1 ? (
            <Link
              href={s.path}
              className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors truncate max-w-[120px]"
            >
              {s.label}
            </Link>
          ) : (
            <span className="text-slate-700 dark:text-slate-200 font-medium truncate max-w-[120px]">
              {s.label}
            </span>
          )}
        </span>
      ))}
      {extra.map((e, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-slate-700 dark:text-slate-200 font-medium truncate max-w-[120px]">
            {e}
          </span>
        </span>
      ))}
    </nav>
  )
}
