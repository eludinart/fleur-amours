'use client'

import Link from 'next/link'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

type Variant = 'warning' | 'error' | 'info'

type AlertBoxProps = {
  variant?: Variant
  title?: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
  onDismiss?: () => void
  dismissLabel?: string
  className?: string
}

const variantStyles: Record<Variant, { container: string; title: string; link: string; linkHover: string }> = {
  warning: {
    container: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200',
    title: 'text-amber-800 dark:text-amber-200',
    link: 'bg-amber-600 text-white hover:bg-amber-700',
    linkHover: 'hover:bg-amber-100 dark:hover:bg-amber-900/30',
  },
  error: {
    container: 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-200',
    title: 'text-rose-800 dark:text-rose-200',
    link: 'bg-rose-600 text-white hover:bg-rose-700',
    linkHover: 'hover:bg-rose-100 dark:hover:bg-rose-900/30',
  },
  info: {
    container: 'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-200',
    title: 'text-violet-800 dark:text-violet-200',
    link: 'bg-violet-600 text-white hover:bg-violet-700',
    linkHover: 'hover:bg-violet-100 dark:hover:bg-violet-900/30',
  },
}

/** Bloc d'alerte — warning (ambre), error (rose), info (violet) */
export function AlertBox({
  variant = 'warning',
  title,
  children,
  actions,
  onDismiss,
  dismissLabel = 'Fermer',
  className = '',
}: AlertBoxProps) {
  const styles = variantStyles[variant]
  return (
    <div
      className={`rounded-2xl border-2 ${styles.container} p-4 text-sm space-y-2 ${className}`}
      role="alert"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {title && <p className={`font-semibold ${styles.title}`}>{title}</p>}
          <div className="text-xs mt-0.5">{children}</div>
          {actions && <div className="flex flex-wrap gap-2 pt-2">{actions}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className={`shrink-0 px-2 py-1 rounded-lg border border-current/30 text-xs ${styles.linkHover} opacity-80 hover:opacity-100 transition-opacity`}
            aria-label={dismissLabel}
          >
            {dismissLabel}
          </button>
        )}
      </div>
    </div>
  )
}

/** Lien CTA pour AlertBox (ex: Activer un code promo) */
export function AlertBoxLink({
  href,
  children,
  variant = 'warning',
}: {
  href: string
  children: React.ReactNode
  variant?: Variant
}) {
  const styles = variantStyles[variant]
  const fullHref = href.startsWith('/') ? href : `/${href}`
  return (
    <Link
      href={fullHref}
      className={`inline-block px-3 py-1.5 rounded-xl ${styles.link} text-xs font-bold transition-colors`}
    >
      {children}
    </Link>
  )
}
