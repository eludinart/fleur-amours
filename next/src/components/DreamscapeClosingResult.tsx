'use client'

import { motion } from 'framer-motion'
import { t } from '@/i18n'
import { proxyImageUrl } from '@/lib/api-client'
import { BACK_IMG, ALL_CARDS } from '@/data/tarotCards'
import { FlowerSVG } from '@/components/FlowerSVG'

export type ClosingSections = {
  intention_depart?: string | null
  ce_qui_a_emerge?: string | null
  trajectoire_cartes?: string | null
  citations?: string[]
  actions_a_oeuvrer?: string[]
}

type SlotLike = {
  position?: string
  card?: string
  faceDown?: boolean
  revealOrder?: number
}

function findCardImg(name?: string) {
  if (!name) return BACK_IMG
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
  const card = ALL_CARDS.find((c) => {
    const cn = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
    return cn === n || cn.includes(n) || n.includes(cn)
  })
  return card?.img || BACK_IMG
}

const WAIT_STEPS = [
  'dreamscapeCanvas.waitStep1',
  'dreamscapeCanvas.waitStep2',
  'dreamscapeCanvas.waitStep3',
] as const

export function DreamscapeClosingWait({ stepIndex }: { stepIndex: number }) {
  const idx = Math.min(WAIT_STEPS.length - 1, Math.max(0, stepIndex))
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="relative w-28 h-28 flex items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full bg-violet-500/20"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <FlowerSVG
          petals={{ agape: 0.7, philia: 0.55, eros: 0.4, storge: 0.5, pragma: 0.35, ludus: 0.3, philautia: 0.45, mania: 0.25 }}
          animate
          size={110}
          showLabels={false}
          showScores={false}
        />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90 mb-2">
          {t('dreamscapeCanvas.waitKicker')}
        </p>
        <motion.p
          key={idx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-base sm:text-lg text-white font-medium leading-relaxed"
        >
          {t(WAIT_STEPS[idx])}
        </motion.p>
        <p className="mt-3 text-sm text-white/55 leading-relaxed max-w-sm mx-auto">
          {t('dreamscapeCanvas.waitHint')}
        </p>
      </div>
      <div className="flex gap-1.5 justify-center pt-1">
        {WAIT_STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-6 rounded-full transition-colors ${i <= idx ? 'bg-violet-400' : 'bg-white/15'}`}
          />
        ))}
      </div>
    </div>
  )
}

export function DreamscapeClosingResult({
  sections,
  synthesis,
  slots,
  petals,
  path,
  previewUrl,
  emailSentTo,
}: {
  sections: ClosingSections | null
  synthesis?: string
  slots: SlotLike[]
  petals?: Record<string, number>
  path?: string[]
  previewUrl?: string | null
  emailSentTo?: string | null
}) {
  const revealed = (slots || [])
    .filter((s) => !s.faceDown)
    .sort((a, b) => (a.revealOrder || 0) - (b.revealOrder || 0))

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300/90">
          {t('dreamscapeCanvas.resultBadge')}
        </p>
        <h3 className="text-lg sm:text-xl font-bold text-white">
          {t('dreamscapeCanvas.resultTitle')}
        </h3>
        <p className="text-sm text-white/65">{t('dreamscapeCanvas.resultSubtitle')}</p>
      </div>

      {emailSentTo ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-center">
          <p className="text-sm text-emerald-100 leading-relaxed">
            {t('dreamscapeCanvas.emailSentTo', { email: emailSentTo })}
          </p>
        </div>
      ) : null}

      {(previewUrl || Object.keys(petals || {}).length > 0) && (
        <div className="rounded-xl bg-slate-900/80 border border-violet-500/25 p-3">
          <p className="text-xs font-semibold text-violet-300/90 uppercase tracking-wider mb-2">
            {t('dreamscapeHistorique.snapshot')}
          </p>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="w-full max-w-[280px] mx-auto rounded-lg object-contain ring-1 ring-white/10 shadow-lg"
            />
          ) : (
            <div className="flex justify-center py-2">
              <FlowerSVG petals={petals || {}} animate={false} size={160} showLabels={false} showScores={false} forceDualStyle />
            </div>
          )}
        </div>
      )}

      {sections?.intention_depart ? (
        <Section title={t('dreamscapeCanvas.sectionIntention')} body={sections.intention_depart} />
      ) : null}
      {sections?.ce_qui_a_emerge ? (
        <Section title={t('dreamscapeCanvas.sectionEmerged')} body={sections.ce_qui_a_emerge} />
      ) : synthesis?.trim() ? (
        <Section title={t('dreamscapeCanvas.sectionEmerged')} body={synthesis.trim()} />
      ) : null}

      {revealed.length > 0 && (
        <div className="rounded-xl bg-slate-800/90 border border-white/10 p-3">
          <p className="text-xs font-semibold text-violet-200 uppercase tracking-wider mb-3">
            {t('dreamscapeCanvas.sectionCards')}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {revealed.map((slot, j) => {
              const img = findCardImg(slot.card)
              return (
                <div key={j} className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="w-14 h-20 rounded-lg overflow-hidden border border-white/15 bg-black/40">
                    <img
                      src={proxyImageUrl(img) ?? img}
                      alt={slot.card || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-violet-300/90 text-center max-w-[56px] leading-tight">
                    {slot.position ?? '—'}
                  </span>
                  {slot.card && slot.card !== slot.position ? (
                    <span className="text-[10px] text-white/60 text-center max-w-[56px] truncate" title={slot.card}>
                      {slot.card}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
          {(sections?.trajectoire_cartes || (path && path.length > 0)) && (
            <p className="mt-3 text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
              {sections?.trajectoire_cartes?.trim() || path!.join(' → ')}
            </p>
          )}
        </div>
      )}

      {Array.isArray(sections?.citations) && sections!.citations!.length > 0 ? (
        <div className="rounded-xl bg-slate-800/90 border border-white/10 p-3">
          <p className="text-xs font-semibold text-violet-200 uppercase tracking-wider mb-2">
            {t('dreamscapeCanvas.sectionQuotes')}
          </p>
          <ul className="text-sm text-white/90 space-y-1.5 list-disc list-inside">
            {sections!.citations!.slice(0, 4).map((q, i) => (
              <li key={i} className="italic">{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {Array.isArray(sections?.actions_a_oeuvrer) && sections!.actions_a_oeuvrer!.length > 0 ? (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3">
          <p className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-2">
            {t('dreamscapeCanvas.sectionActions')}
          </p>
          <ul className="text-sm text-white/90 space-y-1.5 list-disc list-inside">
            {sections!.actions_a_oeuvrer!.slice(0, 7).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-slate-800/90 border border-white/10 p-3">
      <p className="text-xs font-semibold text-violet-200 uppercase tracking-wider mb-2">{title}</p>
      <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{body}</p>
    </div>
  )
}
