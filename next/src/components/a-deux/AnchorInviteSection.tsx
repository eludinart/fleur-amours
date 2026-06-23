'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { aDeuxApi } from '@/api/a-deux'
import { InvitePartnerPanel } from '@/components/a-deux/InvitePartnerPanel'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

export type AnchorInviteAnchor = {
  id: number
  questionnaire_type?: string
  porte?: string | null
  created_at?: string
}

type AnchorInviteSectionProps = {
  anchor: AnchorInviteAnchor
  /** Panneau d'invitation ouvert dès l'affichage (ex. fin de questionnaire). */
  defaultExpanded?: boolean
  /** Mode contrôlé (ex. liste Mes duos). */
  expanded?: boolean
  onExpandedChange?: (open: boolean) => void
  onDeleted?: () => void
  onPairingCreated?: (token: string) => void
  showDelete?: boolean
}

function formatAnchorDate(s: string | undefined, locale: string): string {
  if (!s) return '—'
  const raw = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString(locale || 'fr', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function AnchorInviteSection({
  anchor,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  onDeleted,
  onPairingCreated,
  showDelete = true,
}: AnchorInviteSectionProps) {
  const locale = useStore((s) => s.locale) || 'fr'
  const router = useRouter()
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const expanded = expandedProp ?? internalExpanded

  function setExpanded(open: boolean) {
    onExpandedChange?.(open)
    if (expandedProp === undefined) setInternalExpanded(open)
  }

  const title =
    anchor.questionnaire_type === 'porte'
      ? t('aDeux.anchorPorte', { porte: anchor.porte || '—' })
      : t('aDeux.anchorComplet')

  async function deleteAnchor() {
    if (!window.confirm(t('aDeux.deleteAnchorConfirm'))) return
    try {
      await aDeuxApi.deleteAnchor(Number(anchor.id))
      onDeleted?.()
      if (!onDeleted) router.push('/a-deux')
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      id="anchor-invite"
      className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-white dark:bg-slate-900/40 scroll-mt-4"
    >
      <div className="flex justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-500">{formatAnchorDate(anchor.created_at, locale)}</p>
        </div>
        {showDelete && (
          <button type="button" onClick={deleteAnchor} className="text-xs text-red-500 shrink-0 hover:underline">
            {t('common.delete')}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-semibold text-accent underline"
      >
        {expanded ? t('common.close') : t('aDeux.inviteFromAnchor')}
      </button>
      {expanded && (
        <InvitePartnerPanel anchorId={Number(anchor.id)} onPairingCreated={onPairingCreated} />
      )}
    </div>
  )
}
