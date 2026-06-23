'use client'

import { motion } from 'framer-motion'
import { t } from '@/i18n'
import type { LandingReadingDTO } from '@/api/landingReading'

export function LandingAiReading({
  loading,
  reading,
  intention,
}: {
  loading: boolean
  reading: LandingReadingDTO | null
  intention: string
}) {
  if (!loading && !reading) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/95 via-white to-rose-50/90 p-5 sm:p-6 shadow-[0_16px_40px_-16px_rgba(91,33,182,0.28)] ring-1 ring-violet-100/60">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-600 mb-3">
          {loading ? t('landing.aiReadingLoadingLabel') : t('landing.aiReadingLabel')}
        </p>

        {loading ? (
          <div className="space-y-3" aria-live="polite">
            <p className="font-serif text-base sm:text-lg text-stone-700 italic">
              {intention.trim()
                ? t('landing.aiReadingLoadingWithIntention')
                : t('landing.aiReadingLoading')}
            </p>
            <div className="flex items-center gap-2 text-sm text-violet-600/80">
              <span className="h-4 w-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" aria-hidden />
              {t('landing.aiReadingSpinner')}
            </div>
          </div>
        ) : reading ? (
          <div className="space-y-4 text-left">
            {reading.mirror ? (
              <p className="font-serif text-lg sm:text-xl leading-snug text-stone-800 font-medium">
                {reading.mirror}
              </p>
            ) : null}
            {reading.reading ? (
              <div className="space-y-2.5">
                {reading.reading.split(/\n\n+/).map((para, i) => (
                  <p key={i} className="font-serif text-sm sm:text-base leading-relaxed text-stone-700">
                    {para}
                  </p>
                ))}
              </div>
            ) : null}
            {reading.question ? (
              <div className="rounded-xl border border-violet-200/70 bg-violet-50/80 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 mb-1">
                  {t('landing.aiReadingQuestionLabel')}
                </p>
                <p className="font-serif text-sm sm:text-base italic text-violet-900/90 leading-snug">
                  {reading.question}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}
