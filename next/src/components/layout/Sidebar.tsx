'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/contexts/AuthContext'
import { useSocialStore } from '@/store/useSocialStore'
import { t } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
  title?: string
}

type NavGroup = {
  label: string
  collapsible?: boolean
  defaultOpen?: boolean
  items: NavItem[]
}

function buildNavGroups(
  isAdmin: boolean,
  isCoach: boolean,
  translate: (k: string) => string
): NavGroup[] {
  const accueilItems: NavItem[] = [
    { to: '/', label: translate('nav.home'), icon: '🏡', end: true, title: translate('nav.homeTooltip') },
    { to: '/prairie', label: translate('nav.grandJardin'), icon: '🌻', end: true, title: translate('prairie.grandJardin') },
    { to: '/clairiere', label: translate('social.clairiere'), icon: '🌿', end: false, title: translate('social.clairiereDesc') },
    { to: '/boutique', label: translate('nav.boutique'), icon: '🛒', end: true, title: translate('prairie.boutique') },
  ]

  const decouvrirItems: NavItem[] = [
    { to: '/fleur', label: translate('nav.fleur'), icon: '🌸', title: translate('nav.fleurTooltip') },
    {
      to: '/fleur-beta',
      label: translate('nav.fleurBeta'),
      icon: '🧪',
      title: translate('nav.fleurBetaTooltip'),
    },
    { to: '/duo', label: translate('nav.duo'), icon: '💕', title: translate('nav.duoTooltip') },
    { to: '/mes-fleurs', label: translate('nav.mesFleurs'), icon: '📄', title: translate('nav.mesFleursTooltip') },
  ]

  const pratiqueItems: NavItem[] = [
    { to: '/tirage', label: translate('nav.tirages'), icon: '🎴', end: false, title: translate('nav.tiragesFullTooltip') },
    { to: '/cartes', label: translate('nav.cartes'), icon: '🃏', end: false, title: translate('nav.cartesTooltip') },
  ]

  const accompagnerItems: NavItem[] = [
    { to: '/chat', label: translate('nav.chat'), icon: '💬', end: false, title: translate('nav.chatTooltip') },
    { to: '/coaches', label: translate('nav.coachesDirectory'), icon: '🌿', end: false, title: translate('nav.coachesDirectoryTooltip') },
  ]

  const compteItems: NavItem[] = [
    { to: '/account', label: translate('accountTitle'), icon: '👤', end: false, title: translate('nav.accountTooltip') },
    { to: '/notifications', label: translate('notifications') ?? 'Notifications', icon: '🔔', end: false, title: 'Voir vos notifications' },
  ]

  const groups: NavGroup[] = [
    { label: "Fleur d'AmOurs", items: accueilItems },
    { label: translate('decouvrir'), items: decouvrirItems },
    {
      label: translate('nav.pratique'),
      collapsible: true,
      defaultOpen: true,
      items: pratiqueItems,
    },
    { label: translate('accompagnement'), items: accompagnerItems },
    { label: translate('compte'), items: compteItems },
  ]

  if (isAdmin) {
    groups.push({
      label: translate('campaigns'),
      collapsible: true,
      defaultOpen: false,
      items: [
        { to: '/diagnostic', label: translate('diagnostic'), icon: '🔍' },
        { to: '/stats', label: translate('statistiques'), icon: '📈' },
        { to: '/campaigns', label: translate('campaigns'), icon: '✉️' },
      ],
    })
  }

  if (isCoach || isAdmin) {
    const coachNavItems: NavItem[] = [
      { to: '/?view=coach', label: translate('nav.coachDashboard'), icon: '💬', title: translate('nav.coachDashboardTooltip') },
    ]
    // Pour coach ET admin : les éléments "accompagnement coach" vivent dans le sous-menu COACH.
    coachNavItems.push(
      { to: '/coach/analytics', label: translate('nav.coachAnalytics') ?? 'Vue globale', icon: '📊', title: translate('nav.coachAnalyticsTooltip') ?? 'Synthèse et tendances sur votre patientèle.' },
      { to: '/coach/suivi', label: translate('nav.coachSuivi') ?? 'Suivi individuel', icon: '🌸', title: translate('nav.coachSuiviTooltip') ?? 'Détail utilisateur par utilisateur.' },
      { to: '/coach/chat', label: translate('nav.coachChat'), icon: '💬', title: translate('nav.coachChatTooltip') },
      { to: '/coach/patientele', label: translate('nav.coachPatientele'), icon: '🌿', title: translate('nav.coachPatienteleTooltip') }
    )
    groups.push({
      label: translate('nav.coachSection'),
      collapsible: true,
      defaultOpen: isCoach || isAdmin,
      items: coachNavItems,
    })
  }

  if (isAdmin) {
    groups.push({
      label: translate('nav.adminSection'),
      collapsible: true,
      defaultOpen: false,
      items: [
        { to: '/admin', label: translate('nav.adminDashboard'), icon: '📊', end: true },
        { to: '/admin/broadcasts', label: 'Diffusions', icon: '📣' },
        { to: '/admin/sessions', label: translate('nav.adminSessions'), icon: '📋' },
        { to: '/admin/tirages', label: translate('nav.adminTirages'), icon: '🎴' },
        { to: '/admin/science', label: translate('nav.adminScience'), icon: '🧬' },
        { to: '/admin/telemetry', label: 'Télémétrie', icon: '🧭' },
        { to: '/admin/users', label: translate('nav.adminUsers'), icon: '👥' },
        { to: '/admin/prompts', label: translate('nav.adminPrompts'), icon: '✏️' },
        { to: '/admin/promo', label: translate('nav.adminPromo'), icon: '🎁' },
        { to: '/admin/notifications', label: translate('nav.adminNotifications'), icon: '🔔' },
      ],
    })
  }

  return groups
}

function NavItemWithTooltip({
  to,
  label,
  icon,
  end,
  title,
  onClose,
  isActive,
  badge,
}: {
  to: string
  label: string
  icon: string
  end?: boolean
  title?: string
  onClose?: () => void
  isActive: boolean
  badge?: number
}) {
  const [hovered, setHovered] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hovered || !triggerRef.current) return
    const TOOLTIP_WIDTH = 256
    const GAP = 8
    const updatePos = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const rightSpace = window.innerWidth - rect.right - GAP
        setCoords({
          top: rect.top + rect.height / 2,
          left:
            rightSpace >= TOOLTIP_WIDTH
              ? rect.right + GAP
              : Math.max(GAP, rect.left - TOOLTIP_WIDTH),
        })
      }
    }
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [hovered])

  const href = to === '/' ? '/' : to
  const pathWithoutBase = to === '/' ? '' : to

  return (
    <div
      ref={triggerRef}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={href}
        onClick={onClose}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          isActive
            ? 'bg-accent/10 text-accent dark:text-accent-dark'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <span>{icon}</span>
        {label}
        {badge != null && badge > 0 && (
          <span className="ml-auto min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
      {hovered &&
        title &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[9999] hidden md:block px-3 py-2.5 rounded-xl w-64 min-w-0 max-w-[min(16rem,calc(100vw-2rem))] bg-slate-800 dark:bg-slate-700 text-slate-100 text-xs leading-relaxed shadow-xl ring-1 ring-slate-700/50 dark:ring-slate-600/50 pointer-events-none whitespace-normal break-words -translate-y-1/2"
            style={{ top: coords.top, left: coords.left }}
          >
            {title}
          </div>,
          document.body
        )}
    </div>
  )
}

function NavGroup({
  group,
  onClose,
  pathname,
  badges = {},
}: {
  group: NavGroup
  onClose?: () => void
  pathname: string
  badges?: Record<string, number>
}) {
  const currentPath = (pathname.replace(basePath, '').replace(/^\/+|\/+$/g, '') || '') as string
  const isPathInGroup = group.items.some((item) => {
    const itemPath = item.to === '/' ? '' : item.to.replace(/^\/+/, '')
    return itemPath ? currentPath === itemPath || currentPath.startsWith(itemPath + '/') : false
  })
  const [open, setOpen] = useState(
    isPathInGroup || (group.defaultOpen ?? !group.collapsible)
  )

  return (
    <div>
      <button
        onClick={() => group.collapsible && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest ${
          group.collapsible
            ? 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer'
            : 'text-slate-400 cursor-default'
        }`}
      >
        <span>{group.label}</span>
        {group.collapsible && (
          <span className={`transition-transform duration-200 text-slate-300 ${open ? 'rotate-180' : ''}`}>▾</span>
        )}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1 px-1 pb-2 overflow-visible">
          {group.items.map(({ to, label, icon, end, title }) => {
            const itemPath = to === '/' ? '' : to.replace(/^\/+/, '')
            const isExact = end !== false
            const isActive = isExact
              ? currentPath === itemPath
              : itemPath ? currentPath === itemPath || currentPath.startsWith(itemPath + '/') : false
            const badge = badges[to]
            return (
              <NavItemWithTooltip
                key={to}
                to={to}
                label={label}
                icon={icon}
                end={end}
                title={title}
                onClose={onClose}
                isActive={isActive}
                badge={badge}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout, isAdmin, isCoach } = useAuth()
  const router = useRouter()
  const pathname = usePathname() || ''
  useStore((s) => s.locale)
  const openCoachRequestModal = useStore((s) => s.openCoachRequestModal)

  const clairiereUnreadCount = useSocialStore((s) => s.clairiereUnreadCount)
  const fetchClairiereUnread = useSocialStore((s) => s.fetchClairiereUnread)

  useEffect(() => {
    if (!user) return
    fetchClairiereUnread()
    const t = setInterval(fetchClairiereUnread, 60_000)
    return () => clearInterval(t)
  }, [user, fetchClairiereUnread])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchClairiereUnread()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [fetchClairiereUnread])

  const pathWithoutBase = (pathname.replace(basePath, '').replace(/^\/+|\/+$/g, '') || '') as string
  const navGroups = buildNavGroups(isAdmin, isCoach, t)

  function handleLogout() {
    logout()
    router.push('/login')
    onClose?.()
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-30 flex flex-col w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="shrink-0 px-4 py-4 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-base font-bold text-accent">Fleur d&apos;AmOurs</h1>
          <p className="text-xs text-slate-400 mt-0.5">{t('layout.cardsManager')}</p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
          <div className="shrink-0 px-3 pt-3 pb-1 border-b border-slate-200 dark:border-slate-700">
            <Link
              href="/dreamscape"
              onClick={onClose}
              className={`group/cta flex items-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                pathWithoutBase.startsWith('dreamscape')
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white hover:shadow-lg hover:shadow-indigo-500/20'
              }`}
            >
              <span className="text-lg">🌙</span>
              <span>{t('dreamscape')}</span>
            </Link>
          </div>
          <div className="shrink-0 px-3 py-3 border-b border-slate-200 dark:border-slate-700">
            <Link
              href="/session"
              onClick={onClose}
              className={`group/cta flex items-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                pathWithoutBase.startsWith('session')
                  ? 'bg-accent text-white shadow-lg shadow-accent/25'
                  : 'bg-accent/10 text-accent dark:text-accent-dark hover:bg-accent hover:text-white hover:shadow-lg hover:shadow-accent/20'
              }`}
            >
              <span className="text-lg">🌿</span>
              <span>{t('nav.session')}</span>
              <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider opacity-90">
                {t('layout.phare')}
              </span>
            </Link>
          </div>

          <div className="shrink-0 px-3 py-3 border-b border-slate-200 dark:border-slate-700">
            <Link
              href="/tirage"
              onClick={onClose}
              className={`group/cta flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all shadow-md ${
                pathWithoutBase.startsWith('tirage')
                  ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
                  : 'bg-teal-500/15 text-teal-800 dark:text-teal-200 border border-teal-400/40 hover:bg-teal-500 hover:text-white hover:border-teal-500 hover:shadow-teal-500/25'
              }`}
            >
              <span className="text-xl">🎴</span>
              <span>{t('nav.drawTirage')}</span>
            </Link>
          </div>

          <nav className="px-2 py-3 border-b border-slate-200 dark:border-slate-700 space-y-1">
            {navGroups.map((group) => (
              <NavGroup
                key={group.label}
                group={group}
                onClose={onClose}
                pathname={pathname}
                badges={{ '/clairiere': clairiereUnreadCount }}
              />
            ))}
          </nav>

          {user && !isCoach && !isAdmin && (
            <div className="shrink-0 px-3 py-3 border-b border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  openCoachRequestModal()
                  onClose?.()
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-800/60 hover:bg-violet-100 dark:hover:bg-violet-950/70 transition-colors text-left"
              >
                <span className="text-base shrink-0">💬</span>
                <span className="leading-snug">{t('account.coachRequestTrigger')}</span>
              </button>
            </div>
          )}
        </div>

        {user && (
          <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 px-3 py-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-violet-400 to-rose-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {(user as { avatar?: string }).avatar ? (
                  <img src={(user as { avatar: string }).avatar} alt="" className="w-full h-full object-cover" />
                ) : (user as { avatar_emoji?: string }).avatar_emoji ? (
                  <span className="text-base">{(user as { avatar_emoji: string }).avatar_emoji}</span>
                ) : (
                  ((user as { name?: string }).name || (user as { login?: string }).login || '?')[0].toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                  {(user as { name?: string }).name || (user as { login?: string }).login}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{(user as { email?: string }).email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            >
              {t('logout')}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
