'use client'

import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const TAROT_BUY_URL =
  'https://eludein.art/produit/prevente-tarot-fleur-damours-edition-dedicacee/'

type BuyTarotCTAProps = {
  variant?: 'default' | 'compact'
  className?: string
}

export function BuyTarotCTA({ variant = 'default', className = '' }: BuyTarotCTAProps) {
  useStore((s) => s.locale)
  const isCompact = variant === 'compact'

  return (
    <a
      href={TAROT_BUY_URL}
      target="_blank"
      rel="noreferrer"
      className={`
        inline-flex items-center justify-center gap-2 rounded-full border border-accent text-accent
        hover:bg-accent hover:text-white transition-all hover:shadow-lg hover:shadow-accent/25
        ${
          isCompact
            ? 'px-4 py-2 text-xs font-semibold'
            : 'px-6 py-2.5 text-sm font-semibold'
        }
        ${className}
      `}
    >
      <span className="shrink-0">✦</span>
      <span className="truncate">{t('common.buyTarot')}</span>
    </a>
  )
}
