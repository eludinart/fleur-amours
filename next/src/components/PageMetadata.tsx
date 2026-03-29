'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useStore } from '@/store/useStore'
import { t } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'
const siteName = "Fleur d'AmOurs"

const routeMeta: Record<
  string,
  { titleKey?: string; title?: string; descKey?: string }
> = {
  home: { titleKey: 'dashboard.title', descKey: 'dashboardSubtitle' },
  session: { titleKey: 'nav.session', descKey: 'session.accompanyLight' },
  dreamscape: { title: 'Promenade Onirique', descKey: 'dreamscape' },
  fleur: { titleKey: 'fleur.title', descKey: 'fleur.introDesc' },
  duo: { titleKey: 'duo.title', descKey: 'duo.subtitle' },
  tirage: { titleKey: 'tarot.title', descKey: 'tarot.subtitle' },
  chat: { title: 'Coach Eludein', descKey: 'onboarding.pillarAccompanyDesc' },
  presentation: { title: 'Présentation', descKey: 'presentation.welcomeSubtitle' },
  account: { titleKey: 'accountTitle', descKey: 'sap.desc' },
  coaches: { titleKey: 'coaches.pageTitle', descKey: 'coaches.pageSubtitle' },
  prairie: { titleKey: 'prairie.grandJardin', descKey: 'prairie.optInBody' },
  clairiere: { titleKey: 'social.clairiere', descKey: 'social.clairiereDesc' },
  'mes-fleurs': { titleKey: 'mesFleurs.title', descKey: 'mesFleurs.subtitle' },
  cartes: { title: 'Cartes', descKey: 'mesFleurs.subtitle' },
  boutique: { titleKey: 'prairie.boutique', descKey: 'prairie.boutique' },
  login: { title: 'Connexion', descKey: 'login.subtitleLogin' },
}

function getMeta(route: string) {
  const r = routeMeta[route]
  if (!r) return null
  const title = r.titleKey ? t(r.titleKey) : r.title
  const description = r.descKey ? t(r.descKey) : undefined
  return { title, description }
}

export function PageMetadata() {
  const pathname = usePathname()
  const locale = useStore((s) => s.locale)

  useEffect(() => {
    const path = (pathname || '').replace(basePath, '').replace(/^\/+|\/+$/g, '')
    const route = path.split('/')[0] || 'home'
    const meta = getMeta(route)

    const docTitle = meta?.title
      ? `${meta.title} | ${siteName}`
      : siteName
    document.title = docTitle

    const desc = meta?.description
    const safeDesc = desc ? String(desc).slice(0, 160) : 'Jardin Fleur d\'AmOurs'
    let metaDesc = document.querySelector('meta[name="description"]')
    if (!metaDesc) {
      metaDesc = document.createElement('meta')
      metaDesc.setAttribute('name', 'description')
      document.head.appendChild(metaDesc)
    }
    metaDesc.setAttribute('content', safeDesc)
  }, [pathname, locale])

  return null
}
