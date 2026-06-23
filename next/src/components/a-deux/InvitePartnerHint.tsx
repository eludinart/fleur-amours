'use client'

import { t } from '@/i18n'

type InvitePartnerHintProps = {
  className?: string
}

const DEFAULT_CLASS =
  'text-xs text-emerald-600/70 dark:text-emerald-400/70'

/** Consigne partagée — parcours À deux et Duo classique. */
export function InvitePartnerHint({ className = DEFAULT_CLASS }: InvitePartnerHintProps) {
  return <p className={className}>{t('aDeux.multiInviteHint')}</p>
}
