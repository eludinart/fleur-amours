'use client'

import { useRouter } from 'next/navigation'
import { t } from '@/i18n'

export type DuoPartnerOption = {
  invite_token: string
  partner_label?: string | null
  invited_email?: string | null
  status?: string
  created_at?: string
}

type DuoPartnerSelectorProps = {
  pairings: DuoPartnerOption[]
  currentToken: string
}

function labelFor(p: DuoPartnerOption): string {
  return (
    (p.partner_label && String(p.partner_label).trim()) ||
    (p.invited_email && String(p.invited_email).trim()) ||
    t('duo.anonymous')
  )
}

export function DuoPartnerSelector({ pairings, currentToken }: DuoPartnerSelectorProps) {
  const router = useRouter()
  const complete = pairings.filter((p) => p.status === 'complete' && p.invite_token)
  if (complete.length <= 1) return null

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <label htmlFor="duo-partner-select" className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
        {t('duoJourney.selectPartner')}
      </label>
      <select
        id="duo-partner-select"
        value={currentToken}
        onChange={(e) => {
          const next = e.target.value
          if (next && next !== currentToken) {
            router.push(`/a-deux/result?token=${encodeURIComponent(next)}`)
          }
        }}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {complete.map((p) => (
          <option key={p.invite_token} value={p.invite_token}>
            {labelFor(p)}
          </option>
        ))}
      </select>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{t('duoJourney.selectPartnerHint')}</p>
    </div>
  )
}
