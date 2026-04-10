// @ts-nocheck
'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { FlowerSVG } from '@/components/FlowerSVG'
import { ShareFleurButton } from '@/components/ShareFleurButton'
import { InfoBubble } from '@/components/InfoBubble'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

export function FleurSynthese({
  petals = {},
  size = 240,
  className = '',
  pulsePetalId = null,
  disablePulse = false,
  onPetalClick,
  clickablePetals = null,
}: {
  petals?: Record<string, number>
  size?: number
  className?: string
  pulsePetalId?: string | null
  disablePulse?: boolean
  onPetalClick?: (petalId: string) => void
  clickablePetals?: Set<string> | null
}) {
  useStore((s) => s.locale)
  const flowerRef = useRef(null)
  const hasData = Object.values(petals || {}).some((v) => (v ?? 0) > 0.05)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 min-h-[320px] flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('fleurSynthese.title')}</h3>
          <InfoBubble title={t('fleurSynthese.infoTitle')} content={t('fleurSynthese.infoDesc')} />
        </div>
        {hasData && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <ShareFleurButton
              targetRef={flowerRef}
              shareUrl="/"
              filename="fleur-synthese.png"
              label={t('fleurSynthese.share')}
              showEncouragement
            />
          </div>
        )}
      </div>
      <p className="text-center text-xs text-slate-500 dark:text-slate-400 mb-4">{t('fleurSynthese.subtitle')}</p>
      <div ref={flowerRef} className="flex justify-center flex-1 items-center py-4">
        {hasData ? (
          <FlowerSVG
            petals={petals}
            size={size}
            animate
            showLabels
            showScores={false}
            pulsePetalId={pulsePetalId}
            disablePulse={disablePulse}
            onPetalClick={onPetalClick}
            clickablePetals={clickablePetals}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
            <span className="text-5xl mb-2">🌸</span>
            <p className="text-sm">{t('fleurSynthese.empty')}</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
