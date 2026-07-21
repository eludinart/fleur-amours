'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { MaturityBadges } from '@/components/social/MaturityBadges'
import { t } from '@/i18n'

/**
 * Badges de maturité communautaire sur la Zen home : rend la progression sociale
 * visible hors Prairie, et invite à rejoindre la communauté si aucun badge.
 */
export function ZenHomeBadges() {
  const [badges, setBadges] = useState<string[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(api.get('/api/social/my_badges') as Promise<{ badges?: string[] }>)
      .then((r) => {
        if (!cancelled) setBadges(Array.isArray(r?.badges) ? r.badges : [])
      })
      .catch(() => {
        if (!cancelled) setBadges([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (badges === null) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wider text-white/60 mb-2">
        {t('fleurZen.badgesLabel')}
      </p>
      {badges.length > 0 ? (
        <>
          <MaturityBadges badges={badges} />
          <Link
            href="/prairie"
            className="mt-2 inline-block text-xs text-teal-200/90 hover:text-teal-100 underline-offset-2 hover:underline"
          >
            {t('fleurZen.badgesMore')} →
          </Link>
        </>
      ) : (
        <>
          <p className="text-xs text-white/70 leading-relaxed">{t('fleurZen.badgesEmpty')}</p>
          <Link
            href="/prairie"
            className="mt-2 inline-block text-xs text-teal-200/90 hover:text-teal-100 underline-offset-2 hover:underline"
          >
            {t('fleurZen.badgesEmptyCta')} →
          </Link>
        </>
      )}
    </div>
  )
}
