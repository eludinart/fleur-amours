'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/contexts/AuthContext'
import { useSocialStore } from '@/store/useSocialStore'
import { useMyceliumAccess } from '@/hooks/useMyceliumAccess'
import { t } from '@/i18n'
import {
  getAvailableViewModes,
  resolveViewMode,
  type ViewMode,
} from '@/lib/view-modes'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

type NavItem = {
  to: string
  label: string
  icon: string
  end?: boolean
  title?: string
}

type ExplorationAccent = 'violet' | 'rose' | 'fuchsia' | 'sky'

type ExplorationNavItem = NavItem & {
  hint: string
  accent: ExplorationAccent
}

type NavGroup = {
  label: string
  collapsible?: boolean
  defaultOpen?: boolean
  items: NavItem[]
}

/**
 * Construit la navigation utilisateur en deux registres distincts :
 * - EXPLORATIONS : les 4 applications guidées par l'IA (Conversation intérieure, Explorer ma Fleur, Faire un tirage, Lire un tirage).
 * - À DEUX : parcours couple (Par une Porte, questionnaire complet, Mes duos).
 *
 * Les sections supplémentaires sont **filtrées par viewMode** :
 *  - 'lambda' : aucune section pro (expérience utilisateur novice).
 *  - 'coach'  : ajoute la section Coach.
 *  - 'rh'     : ajoute la section Mycelium (si accès réel détecté).
 *  - 'admin'  : ajoute toutes les sections (Mycelium + Coach + Outils + Administration).
 *
 * Les droits backend ne sont jamais altérés : le menu est un masque côté UI. Un admin
 * en vue 'lambda' reste admin et peut accéder à `/admin/*` par URL directe.
 */
function buildNavGroups(params: {
  viewMode: ViewMode
  isAdmin: boolean
  isCoach: boolean
  mycelium: { showEspace: boolean; showDashboard: boolean; showAdmin: boolean }
  translate: (k: string) => string
  profilePublic: boolean
}): NavGroup[] {
  const { viewMode, isAdmin, isCoach, mycelium, translate, profilePublic } = params

  // Drapeaux UI dérivés du viewMode (pas des droits réels).
  // Pour qu'une section soit visible, deux conditions : l'utilisateur a le droit ET le mode actuel la révèle.
  const showCoachSection = (isCoach || isAdmin) && (viewMode === 'coach' || viewMode === 'admin')
  const hasMyceliumAccess = mycelium.showEspace || mycelium.showDashboard || mycelium.showAdmin
  const showMyceliumSection =
    (isAdmin || hasMyceliumAccess) && (viewMode === 'rh' || viewMode === 'admin')
  const showAdminTools = isAdmin && viewMode === 'admin'
  // La communauté est exposée à tous les modes sauf RH/Mycélium (silo pro distinct).
  const showCommunitySection = viewMode === 'lambda' || viewMode === 'coach' || viewMode === 'admin'

  const explorationsItems: ExplorationNavItem[] = [
    {
      to: '/dreamscape',
      label: translate('dreamscape'),
      hint: translate('nav.explorationDreamscapeHint'),
      icon: '💬',
      accent: 'violet',
      end: false,
      title: translate('dreamscapeIntro'),
    },
    {
      to: '/session',
      label: translate('nav.session'),
      hint: translate('nav.explorationSessionHint'),
      icon: '🌸',
      accent: 'rose',
      end: false,
      title: translate('home.gardenFeatureDesc'),
    },
    {
      to: '/tirage',
      label: translate('nav.drawTirage'),
      hint: translate('nav.explorationDrawHint'),
      icon: '🎴',
      accent: 'fuchsia',
      end: false,
      title: translate('nav.tiragesFullTooltip'),
    },
    {
      to: '/tirage-papier',
      label: translate('nav.paperDraw'),
      hint: translate('nav.explorationReadHint'),
      icon: '🔍',
      accent: 'sky',
      end: false,
      title: translate('nav.paperDrawTooltip'),
    },
  ]

  const aDeuxItems: NavItem[] = [
    {
      to: '/a-deux',
      label: translate('nav.aDeuxHub'),
      icon: '💞',
      end: true,
      title: translate('nav.aDeuxHubTooltip'),
    },
    {
      to: '/a-deux/par-une-porte',
      label: translate('nav.aDeuxPorte'),
      icon: '🚪',
      title: translate('nav.aDeuxPorteTooltip'),
    },
    {
      to: '/a-deux/complet',
      label: translate('nav.aDeuxComplet'),
      icon: '📋',
      title: translate('nav.aDeuxCompletTooltip'),
    },
    {
      to: '/mes-duos',
      label: translate('nav.mesDuos'),
      icon: '🌸',
      title: translate('nav.mesDuosTooltip'),
    },
  ]

  const groups: NavGroup[] = [
    {
      label: translate('nav.explorationsSection'),
      collapsible: false,
      items: explorationsItems,
    },
    {
      label: translate('nav.aDeuxSection'),
      collapsible: false,
      items: aDeuxItems,
    },
    {
      label: translate('nav.eclosionSection'),
      collapsible: false,
      items: [
        {
          to: '/eclosion',
          label: translate('nav.eclosion'),
          icon: '🌱',
          end: true,
          title: translate('nav.eclosionTooltip'),
        },
        {
          to: '/checkin',
          label: translate('nav.checkin'),
          icon: '📝',
          end: true,
          title: translate('nav.checkinTooltip'),
        },
      ],
    },
  ]

  // ── Section Communauté ─────────────────────────────────────────────────────
  // Toujours visible (sauf vue 'rh' pure, qui a son propre silo Mycélium).
  // Si le profil n'est pas public, le Grand Jardin et la Lisière sont déjà conditionnés
  // côté pages (PrairiePage redirige vers l'activation). On expose quand même les
  // entrées pour donner accès à l'onboarding communautaire.
  if (showCommunitySection) {
    const communityItems: NavItem[] = [
      {
        to: '/prairie',
        label: translate('nav.grandJardin'),
        icon: '🌻',
        end: true,
        title: translate('nav.grandJardinTooltip'),
      },
      {
        to: '/liens',
        label: translate('nav.mesLiens'),
        icon: '🌱',
        end: true,
        title: translate('nav.mesLiensTooltip'),
      },
      {
        to: '/clairiere',
        label: translate('nav.clairiereLabel'),
        icon: '🌿',
        end: false,
        title: translate('nav.clairiereTooltip'),
      },
      {
        to: '/pouls',
        label: translate('pouls.title'),
        icon: '📡',
        end: true,
        title: translate('nav.poulsTooltip'),
      },
      {
        to: '/salons',
        label: translate('salons.title'),
        icon: '🏛️',
        end: false,
        title: translate('nav.salonsTooltip'),
      },
      {
        to: '/constellations',
        label: translate('constellations.title'),
        icon: '✨',
        end: true,
        title: translate('nav.constellationsTooltip'),
      },
    ]
    // Petite étiquette d'aide : si l'utilisateur n'est pas encore visible, l'inviter à l'onboarding.
    if (!profilePublic) {
      communityItems.push({
        to: '/account?tab=community',
        label: '✨ ' + translate('communityOnboarding.step1Cta'),
        icon: '✨',
        end: true,
        title: translate('communityOnboarding.step1Desc'),
      })
    }
    groups.push({
      label: translate('nav.communitySection'),
      collapsible: false,
      items: communityItems,
    })
  }

  // ── Section Mycelium (vue 'rh' ou 'admin') ─────────────────────────────────
  if (showMyceliumSection) {
    const myceliumItems: NavItem[] = []
    if (mycelium.showDashboard || isAdmin) {
      myceliumItems.push({
        to: '/mycelium/dashboard',
        label: translate('nav.myceliumDashboard'),
        icon: '📊',
        title: translate('nav.myceliumDashboardTooltip'),
      })
    }
    if (mycelium.showEspace || isAdmin) {
      myceliumItems.push({
        to: '/mycelium/espace',
        label: translate('nav.myceliumEspace'),
        icon: '🌿',
        title: translate('nav.myceliumEspaceTooltip'),
      })
    }
    if (mycelium.showAdmin || isAdmin) {
      myceliumItems.push({
        to: '/mycelium/admin',
        label: translate('nav.myceliumAdmin'),
        icon: '🍄',
        title: translate('nav.myceliumAdminTooltip'),
      })
    }
    if (myceliumItems.length) {
      groups.push({
        label: translate('nav.myceliumSection'),
        collapsible: true,
        defaultOpen: viewMode === 'rh',
        items: myceliumItems,
      })
    }
  }

  // ── Section Coach (vue 'coach' ou 'admin') ─────────────────────────────────
  if (showCoachSection) {
    groups.push({
      label: translate('nav.coachSection'),
      collapsible: true,
      defaultOpen: viewMode === 'coach',
      items: [
        { to: '/?view=coach', label: translate('nav.coachDashboard'), icon: '💬', title: translate('nav.coachDashboardTooltip') },
        { to: '/coach/analytics', label: translate('nav.coachAnalytics') ?? 'Vue globale', icon: '📊', title: translate('nav.coachAnalyticsTooltip') ?? '' },
        { to: '/coach/suivi', label: translate('nav.coachSuivi') ?? 'Suivi individuel', icon: '🌸', title: translate('nav.coachSuiviTooltip') ?? '' },
        { to: '/coach/chat', label: translate('nav.coachChat'), icon: '💬', title: translate('nav.coachChatTooltip') },
        { to: '/coach/patientele', label: translate('nav.coachPatientele'), icon: '🌿', title: translate('nav.coachPatienteleTooltip') },
      ],
    })
  }

  // ── Outils & Administration (vue 'admin' uniquement) ───────────────────────
  // Prairie + Clairière sont désormais dans la section Communauté (toujours visible),
  // on ne les remet donc pas ici pour éviter le doublon.
  if (showAdminTools) {
    groups.push({
      label: translate('nav.eclosionSection'),
      collapsible: true,
      defaultOpen: false,
      items: [
        { to: '/eclosion', label: translate('nav.eclosion'), icon: '🌱', title: translate('nav.eclosionTooltip') },
        { to: '/checkin', label: translate('nav.checkin'), icon: '📝', title: translate('nav.checkinTooltip') },
        { to: '/onboarding-diagnostic', label: translate('nav.baseline'), icon: '🌼', title: translate('nav.baselineTooltip') },
        { to: '/couple', label: translate('nav.couple'), icon: '💞', title: translate('nav.coupleTooltip') },
        { to: '/cartes', label: translate('nav.cartes'), icon: '🃏', title: translate('nav.cartesTooltip') },
        { to: '/coaches', label: translate('nav.coachesDirectory'), icon: '🌿', title: translate('nav.coachesDirectoryTooltip') },
      ],
    })

    // Administration (replié)
    groups.push({
      label: translate('nav.adminSection'),
      collapsible: true,
      defaultOpen: false,
      items: [
        { to: '/admin', label: translate('nav.adminDashboard'), icon: '📊', end: true },
        { to: '/admin/emails', label: 'Campagnes e-mail', icon: '✉️' },
        { to: '/admin/broadcasts', label: 'Campagne de notification', icon: '📣' },
        { to: '/admin/sessions', label: translate('nav.adminSessions'), icon: '📋' },
        { to: '/admin/tirages', label: translate('nav.adminTirages'), icon: '🎴' },
        { to: '/admin/science', label: translate('nav.adminScience'), icon: '🧬' },
        { to: '/admin/ai', label: 'Intelligence artificielle', icon: '🤖' },
        { to: '/admin/telemetry', label: 'Télémétrie', icon: '🧭' },
        { to: '/admin/users', label: translate('nav.adminUsers'), icon: '👥' },
        { to: '/admin/prompts', label: translate('nav.adminPrompts'), icon: '✏️' },
        { to: '/admin/promo', label: translate('nav.adminPromo'), icon: '🎁' },
        { to: '/admin/notifications', label: translate('nav.adminNotifications'), icon: '🔔' },
        { to: '/diagnostic', label: translate('diagnostic'), icon: '🔍' },
        { to: '/stats', label: translate('statistiques'), icon: '📈' },
        { to: '/campaigns', label: translate('campaigns'), icon: '✉️' },
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

/**
 * Item d'exploration mis en avant : carte colorée avec icône, titre court et sous-titre.
 */
const EXPLORATION_ACCENTS: Record<
  ExplorationAccent,
  {
    card: string
    cardActive: string
    icon: string
    hint: string
    hintActive: string
    hover: string
  }
> = {
  violet: {
    card:
      'bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent border-violet-200/60 dark:border-violet-800/45',
    cardActive:
      'bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 border-violet-400/60 text-white shadow-lg shadow-violet-600/25',
    icon: 'bg-gradient-to-br from-violet-400 to-indigo-500 shadow-md shadow-violet-500/35 ring-2 ring-white/20',
    hint: 'text-violet-700/75 dark:text-violet-300/80',
    hintActive: 'text-white/75',
    hover:
      'hover:border-violet-300/80 hover:shadow-md hover:shadow-violet-500/15 hover:-translate-y-px dark:hover:border-violet-600/60',
  },
  rose: {
    card:
      'bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-transparent border-rose-200/60 dark:border-rose-900/45',
    cardActive:
      'bg-gradient-to-br from-rose-500 via-pink-600 to-rose-600 border-rose-400/60 text-white shadow-lg shadow-rose-500/25',
    icon: 'bg-gradient-to-br from-rose-400 to-pink-500 shadow-md shadow-rose-500/35 ring-2 ring-white/20',
    hint: 'text-rose-700/75 dark:text-rose-300/80',
    hintActive: 'text-white/75',
    hover:
      'hover:border-rose-300/80 hover:shadow-md hover:shadow-rose-500/15 hover:-translate-y-px dark:hover:border-rose-700/60',
  },
  fuchsia: {
    card:
      'bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-transparent border-fuchsia-200/60 dark:border-fuchsia-900/45',
    cardActive:
      'bg-gradient-to-br from-fuchsia-600 via-purple-600 to-fuchsia-700 border-fuchsia-400/60 text-white shadow-lg shadow-fuchsia-600/25',
    icon: 'bg-gradient-to-br from-fuchsia-400 to-purple-500 shadow-md shadow-fuchsia-500/35 ring-2 ring-white/20',
    hint: 'text-fuchsia-700/75 dark:text-fuchsia-300/80',
    hintActive: 'text-white/75',
    hover:
      'hover:border-fuchsia-300/80 hover:shadow-md hover:shadow-fuchsia-500/15 hover:-translate-y-px dark:hover:border-fuchsia-700/60',
  },
  sky: {
    card:
      'bg-gradient-to-br from-sky-500/10 via-cyan-500/5 to-transparent border-sky-200/60 dark:border-sky-900/45',
    cardActive:
      'bg-gradient-to-br from-sky-500 via-cyan-600 to-sky-600 border-sky-400/60 text-white shadow-lg shadow-sky-500/25',
    icon: 'bg-gradient-to-br from-sky-400 to-cyan-500 shadow-md shadow-sky-500/35 ring-2 ring-white/20',
    hint: 'text-sky-700/75 dark:text-sky-300/80',
    hintActive: 'text-white/75',
    hover:
      'hover:border-sky-300/80 hover:shadow-md hover:shadow-sky-500/15 hover:-translate-y-px dark:hover:border-sky-700/60',
  },
}

function ExplorationCard({
  item,
  isActive,
  onClose,
}: {
  item: ExplorationNavItem
  isActive: boolean
  onClose?: () => void
}) {
  const theme = EXPLORATION_ACCENTS[item.accent]
  return (
    <Link
      href={item.to === '/' ? '/' : item.to}
      onClick={onClose}
      title={item.title ?? item.label}
      className={`group flex items-center gap-3 px-2.5 py-2.5 rounded-2xl border transition-all duration-200 ${
        isActive
          ? theme.cardActive
          : `${theme.card} text-slate-800 dark:text-slate-100 ${theme.hover}`
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${
          isActive ? 'bg-white/20 shadow-inner' : theme.icon
        }`}
        aria-hidden
      >
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span
          className={`block text-[12px] font-semibold leading-snug ${
            isActive ? 'text-white' : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {item.label}
        </span>
        <span
          className={`mt-0.5 block text-[10px] font-medium leading-snug ${
            isActive ? theme.hintActive : theme.hint
          }`}
        >
          {item.hint}
        </span>
      </span>
      <span
        className={`shrink-0 text-sm opacity-0 transition-all duration-200 group-hover:opacity-100 ${
          isActive ? 'text-white/90 opacity-100' : 'text-slate-400'
        }`}
        aria-hidden
      >
        →
      </span>
    </Link>
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
            : 'text-slate-500 dark:text-slate-400 cursor-default'
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
  const { user, logout, isAdmin, isCoach, isManager, isRh } = useAuth()
  const router = useRouter()
  const pathname = usePathname() || ''
  useStore((s) => s.locale)
  const viewModeStored = useStore((s) => s.viewMode)
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

  const { access: myceliumAccess } = useMyceliumAccess(!!user)
  const pathWithoutBase = (pathname.replace(basePath, '').replace(/^\/+|\/+$/g, '') || '') as string

  // Résolution du mode actif : on retombe sur le défaut naturel si le mode stocké
  // ne correspond plus aux droits réels de l'utilisateur (ex. perte d'un rôle).
  const availableModes = getAvailableViewModes({
    isAdmin,
    isCoach,
    isManager,
    isRh,
    myceliumAccess: myceliumAccess
      ? {
          showAdmin: myceliumAccess.showAdmin,
          showDashboard: myceliumAccess.showDashboard,
          showEspace: myceliumAccess.showEspace,
        }
      : null,
  })
  const viewMode = resolveViewMode(viewModeStored, availableModes)

  const profilePublic = !!(user && (user as { profile_public?: boolean }).profile_public)
  const navGroups = buildNavGroups({
    viewMode,
    isAdmin,
    isCoach,
    mycelium: {
      showEspace: myceliumAccess?.showEspace ?? false,
      showDashboard: myceliumAccess?.showDashboard ?? false,
      showAdmin: myceliumAccess?.showAdmin ?? false,
    },
    translate: t,
    profilePublic,
  })

  // Première carte : item "Mon Jardin" (home) — toujours visible
  const homeItem: NavItem = {
    to: '/',
    label: t('nav.home') ?? 'Mon Jardin',
    icon: '🏡',
    end: true,
    title: t('nav.homeTooltip'),
  }
  const isHomeActive = pathWithoutBase === ''

  // Extraction du groupe Explorations pour rendu en cards (en haut)
  const explorationsGroup = navGroups[0]
  const restGroups = navGroups.slice(1)

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
          <Link
            href="/cartes"
            onClick={onClose}
            title={t('nav.cartesTooltip')}
            className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border ${
              pathWithoutBase === 'cartes' || pathWithoutBase.startsWith('cartes/')
                ? 'bg-accent text-white border-accent'
                : 'text-accent dark:text-accent-dark bg-accent/10 hover:bg-accent/15 border-accent/25 hover:border-accent/40'
            }`}
          >
            <span aria-hidden>📖</span>
            {t('layout.cardsManager')}
          </Link>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
          {/* Home (Mon Jardin) — accès direct, hors des sections */}
          <div className="shrink-0 px-3 pt-3 pb-2 border-b border-slate-200 dark:border-slate-700">
            <Link
              href="/"
              onClick={onClose}
              title={homeItem.title}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                isHomeActive
                  ? 'bg-accent text-white'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-base" aria-hidden>{homeItem.icon}</span>
              <span>{homeItem.label}</span>
            </Link>
          </div>

          {/* Section EXPLORATIONS — 4 apps phares, en cartes */}
          {explorationsGroup && (
            <div className="shrink-0 px-3 pt-3 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 px-0.5 pb-2.5" title={t('nav.explorationsSectionTooltip')}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-rose-400 to-fuchsia-400">
                  {explorationsGroup.label}
                </p>
                <span className="flex-1 h-px bg-gradient-to-r from-violet-400/40 via-rose-300/25 to-transparent dark:from-violet-600/50 dark:via-rose-500/30" />
              </div>
              <div className="flex flex-col gap-1.5 rounded-2xl p-1.5 bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-800/40 dark:to-transparent">
                {(explorationsGroup.items as ExplorationNavItem[]).map((item) => {
                  const itemPath = item.to.replace(/^\/+/, '')
                  const isActive = pathWithoutBase === itemPath || pathWithoutBase.startsWith(itemPath + '/')
                  return (
                    <ExplorationCard
                      key={item.to}
                      item={item}
                      isActive={isActive}
                      onClose={onClose}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Autres sections */}
          <nav className="px-2 py-3 border-b border-slate-200 dark:border-slate-700 space-y-1">
            {restGroups.map((group) => (
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
            {/* Accès rapide : compte, notifs, boutique */}
            <div className="grid grid-cols-3 gap-1 mb-2">
              <Link
                href="/account"
                onClick={onClose}
                title={t('nav.accountTooltip')}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="text-sm" aria-hidden>👤</span>
                <span>{t('accountTitle')}</span>
              </Link>
              <Link
                href="/notifications"
                onClick={onClose}
                title={t('layout.notifications')}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="text-sm" aria-hidden>🔔</span>
                <span>{t('layout.notifications')}</span>
              </Link>
              <Link
                href="/boutique"
                onClick={onClose}
                title={t('prairie.boutique')}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="text-sm" aria-hidden>🛒</span>
                <span>{t('nav.boutique')}</span>
              </Link>
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
