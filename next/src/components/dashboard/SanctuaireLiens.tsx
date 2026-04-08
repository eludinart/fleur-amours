// @ts-nocheck
'use client'

import Link from 'next/link'
import { FleurSociale } from '@/components/FleurSociale'
import { t } from '@/i18n'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export function SanctuaireLiens({ prairieFleurs = [], prairieLinks = [], prairieMeFleur, meId }) {
  const uid = Number(meId ?? prairieMeFleur?.user_id) || 0
  const myLinks = prairieLinks.filter((l) => Number(l.user_a) === uid || Number(l.user_b) === uid)
  if (myLinks.length === 0) return null

  const linkedUserIds = new Set()
  myLinks.forEach((l) => {
    const a = Number(l.user_a)
    const b = Number(l.user_b)
    if (a === uid) linkedUserIds.add(b)
    else linkedUserIds.add(a)
  })
  const linkedFleurs = prairieFleurs.filter((f) => linkedUserIds.has(Number(f.user_id)))
  if (linkedFleurs.length === 0) return null

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{t('dashboard.sanctuaireLiensTitle')}</h2>
        <Link href="/prairie" className="text-xs font-medium text-accent hover:underline">
          {t('dashboard.sanctuaireLiensSeePrairie')}
        </Link>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('dashboard.sanctuaireLiensDesc')}</p>
      <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
        {linkedFleurs.map((f) => (
          <Link key={f.user_id} href={`/prairie?profile=${f.user_id}`} className="inline-flex flex-col items-center gap-1.5 group">
            <FleurSociale scores={f.scores} lastActivityAt={f.last_activity_at} avatarEmoji={f.avatar_emoji} pseudo={f.pseudo} size={44} />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center max-w-[80px] truncate group-hover:text-accent">{f.pseudo || '—'}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
