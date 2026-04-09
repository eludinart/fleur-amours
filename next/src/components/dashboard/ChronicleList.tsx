// @ts-nocheck
'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { InfoBubble } from '@/components/InfoBubble'
import { t } from '@/i18n'
import { useStore } from '@/store/useStore'

const LOCALE_MAP: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
}

function formatDate(s: string, locale: string) {
  if (!s) return '—'
  const d = new Date(s)
  const loc = LOCALE_MAP[locale] || 'fr-FR'
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' })
}

function toneBorderClass(tone: string | undefined) {
  if (tone === 'shadow') return '!border-l-[6px] !border-l-rose-500'
  if (tone === 'light') return '!border-l-[6px] !border-l-amber-400'
  return '!border-l-[6px] !border-l-slate-400'
}

function toneSurfaceClass(tone: string | undefined, zen: boolean) {
  if (zen) {
    if (tone === 'shadow') {
      return 'border-rose-900/50 bg-gradient-to-br from-rose-950/55 via-slate-950/90 to-slate-950 ring-1 ring-rose-500/20'
    }
    if (tone === 'light') {
      return 'border-amber-500/25 bg-gradient-to-br from-amber-500/15 via-amber-950/20 to-slate-950/80 ring-1 ring-amber-400/25'
    }
    return 'border-white/12 bg-white/[0.05] ring-1 ring-white/10'
  }
  if (tone === 'shadow') {
    return 'border-rose-200/50 dark:border-rose-900/60 bg-gradient-to-br from-rose-50/90 to-white dark:from-rose-950/35 dark:to-slate-950/90 ring-1 ring-rose-200/40 dark:ring-rose-900/40'
  }
  if (tone === 'light') {
    return 'border-amber-200/60 dark:border-amber-700/40 bg-gradient-to-br from-amber-50/95 to-white dark:from-amber-950/30 dark:to-slate-950/85 ring-1 ring-amber-200/50 dark:ring-amber-800/35'
  }
  return 'border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/55'
}

function toneBadgeClass(tone: string | undefined, zen: boolean) {
  if (tone === 'shadow') {
    return zen
      ? 'bg-rose-600/35 text-rose-100 border border-rose-400/45'
      : 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100 border border-rose-300/60 dark:border-rose-700/50'
  }
  if (tone === 'light') {
    return zen
      ? 'bg-amber-500/30 text-amber-50 border border-amber-300/45'
      : 'bg-amber-100 dark:bg-amber-950/50 text-amber-950 dark:text-amber-100 border border-amber-300/55 dark:border-amber-700/45'
  }
  return zen
    ? 'bg-slate-600/35 text-slate-100 border border-slate-400/35'
    : 'bg-slate-200/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 border border-slate-300/70 dark:border-slate-600/60'
}

function typeChipClass(
  kind: 'session' | 'session_anchor' | 'dreamscape' | 'tirage',
  zen: boolean
) {
  if (kind === 'dreamscape') {
    return zen
      ? 'bg-violet-600/30 text-violet-100 border border-violet-400/35'
      : 'bg-violet-100 dark:bg-violet-950/55 text-violet-900 dark:text-violet-100 border border-violet-300/60 dark:border-violet-700/45'
  }
  if (kind === 'tirage') {
    return zen
      ? 'bg-sky-600/25 text-sky-100 border border-sky-400/35'
      : 'bg-sky-100 dark:bg-sky-950/50 text-sky-950 dark:text-sky-100 border border-sky-300/55 dark:border-sky-800/45'
  }
  return zen
    ? 'bg-emerald-600/28 text-emerald-100 border border-emerald-400/35'
    : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100 border border-emerald-300/55 dark:border-emerald-800/45'
}

function toneLabelKey(tone: string | undefined) {
  if (tone === 'shadow') return 'chronicle.badgeShadow'
  if (tone === 'light') return 'chronicle.badgeLight'
  return 'chronicle.badgeNeutral'
}

export function ChronicleList({
  chronicle = [],
  className = '',
  layout = 'stack',
  whisper = null,
  whisperSubhint = null,
  journalTitle = false,
  variant = 'default',
  compact = false,
}: {
  chronicle?: Array<Record<string, unknown>>
  className?: string
  layout?: 'stack' | 'rail' | 'grid'
  whisper?: string | null
  /** Sous-titre pédagogique (ex. niveau 3 — temps) */
  whisperSubhint?: string | null
  /** Libellé « Journal des Ombres et Lumières » au lieu de Chronique */
  journalTitle?: boolean
  /** Thème sombre (vue Fleur zen) */
  variant?: 'default' | 'zen'
  /** Masque la longue description sous le titre */
  compact?: boolean
}) {
  const locale = useStore((s) => s.locale)
  const title = journalTitle ? t('chronicle.journalTitle') : t('chronicle.title')
  const desc = journalTitle ? t('chronicle.journalDesc') : t('chronicle.desc')
  const zen = variant === 'zen'
  const shell = zen
    ? 'rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm'
    : 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50'
  const titleCls = zen ? 'text-white/90' : 'text-slate-800 dark:text-slate-100'
  const descCls = zen ? 'text-white/45' : 'text-slate-500 dark:text-slate-400'
  const metaCls = zen ? 'text-white/45' : 'text-slate-400'

  const clampQuote = layout === 'grid'
  const bodyCls = zen ? 'text-violet-50/95' : 'text-slate-800 dark:text-slate-100'
  const quoteCls = `${bodyCls} text-sm leading-relaxed font-normal not-italic text-left [overflow-wrap:anywhere] ${
    clampQuote ? 'line-clamp-[10] min-h-0' : 'whitespace-pre-wrap break-words'
  }`

  const cardInner = (item: Record<string, unknown>) => {
    const tone = item.tone as string | undefined
    const surface = toneSurfaceClass(tone, zen)
    const edge = toneBorderClass(tone)
    const badgeTone = toneBadgeClass(tone, zen)
    const cardPad =
      layout === 'grid'
        ? 'p-3.5 min-h-0 max-h-[19rem] flex flex-col min-w-0 overflow-hidden'
        : 'p-3.5 min-w-0'

    const kind =
      item.type === 'session' || item.type === 'session_anchor'
        ? (item.type as 'session' | 'session_anchor')
        : item.type === 'dreamscape'
          ? 'dreamscape'
          : 'tirage'
    const typeChip = typeChipClass(kind, zen)
    const typeLabel =
      kind === 'dreamscape'
        ? t('chronicle.dreamscape')
        : kind === 'tirage'
          ? t('chronicle.tirage')
          : t('chronicle.session')

    const chips = (
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${badgeTone}`}
        >
          {t(toneLabelKey(tone))}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${typeChip}`}
        >
          {typeLabel}
        </span>
      </div>
    )

    const body = (
      <>
        {chips}
        <p className={quoteCls}>{item.synthesis}</p>
        <p className={`text-[10px] mt-auto pt-2.5 flex items-center gap-1 shrink-0 border-t ${zen ? 'border-white/10' : 'border-slate-200/80 dark:border-slate-700/80'} ${metaCls}`}>
          <span className="opacity-80">{formatDate(item.created_at as string, locale)}</span>
        </p>
      </>
    )

    const shellCls = `block rounded-xl border transition-colors ${edge} ${surface} ${cardPad}`

    if (item.type === 'session' || item.type === 'session_anchor') {
      return (
        <Link
          href={`/session/${item.id}`}
          className={`${shellCls} ${
            zen ? 'hover:border-teal-400/45 hover:ring-teal-400/20' : 'hover:border-accent/40 hover:bg-accent/5 dark:hover:bg-accent/10'
          }`}
        >
          {body}
        </Link>
      )
    }
    if (item.type === 'dreamscape') {
      return (
        <Link
          href="/dreamscape/historique"
          className={`${shellCls} ${
            zen ? 'hover:border-violet-400/50 hover:ring-violet-400/20' : 'hover:border-violet-400/40 hover:bg-violet-50/80 dark:hover:bg-violet-950/50'
          }`}
        >
          {body}
        </Link>
      )
    }
    if (item.type === 'tirage' && item.id != null && String(item.id) !== '') {
      const rid = encodeURIComponent(String(item.id))
      return (
        <Link
          href={`/tirage?tab=list&reading=${rid}`}
          className={`${shellCls} ${
            zen
              ? 'hover:border-sky-400/45 hover:ring-sky-400/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50'
              : 'hover:border-sky-400/45 hover:bg-sky-50/70 dark:hover:bg-sky-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/40'
          }`}
        >
          {body}
        </Link>
      )
    }
    return <div className={shellCls}>{body}</div>
  }

  if (!chronicle.length) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={`${shell} ${zen ? 'p-4 sm:p-5' : 'p-6'} ${className}`}
      >
        <div className="flex items-center gap-1.5 mb-4">
          <h3 className={`text-lg font-bold ${titleCls}`}>{title}</h3>
          <InfoBubble title={title} content={desc} />
        </div>
        {whisper ? (
          <div className="mb-4 border-l-2 border-violet-400/50 pl-3 space-y-1.5">
            {zen && whisperSubhint ? (
              <p className="text-[9px] uppercase tracking-wider text-violet-300/60">{whisperSubhint}</p>
            ) : null}
            <p className={`text-sm italic ${zen ? 'text-violet-200/90' : 'text-violet-700/90 dark:text-violet-200/90'}`}>
              {whisper}
            </p>
          </div>
        ) : null}
        <div className={`flex flex-col items-center justify-center py-10 ${zen ? 'text-white/35' : 'text-slate-400 dark:text-slate-500'}`}>
          <span className="text-4xl mb-2">📜</span>
          <p className="text-sm text-center">{t('chronicle.empty')}</p>
        </div>
      </motion.div>
    )
  }

  const listClass =
    layout === 'rail'
      ? 'flex flex-nowrap gap-3 overflow-x-auto pb-2 pt-1 px-0.5 scroll-smooth snap-x snap-mandatory [scrollbar-width:thin]'
      : layout === 'grid'
        ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 auto-rows-fr min-w-0'
        : 'space-y-3 max-h-[28rem] overflow-y-auto overflow-x-hidden'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={`${shell} ${zen ? 'p-4 sm:p-5' : 'p-6'} ${className}`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <h3 className={`text-lg font-bold ${titleCls}`}>{title}</h3>
        <InfoBubble title={title} content={desc} />
      </div>
      {whisper ? (
        <div
          className={`mb-4 rounded-xl border px-3 py-2.5 ${
            zen
              ? 'border-violet-400/25 bg-violet-500/10'
              : 'border-violet-200/60 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-950/25'
          }`}
        >
          <p
            className={`text-[10px] uppercase tracking-widest mb-1 ${
              zen ? 'text-violet-200/70' : 'text-violet-600/80 dark:text-violet-300/80'
            }`}
          >
            {t('chronicle.tutorWhisperLabel')}
          </p>
          {zen && whisperSubhint ? (
            <p className="text-[9px] uppercase tracking-wider text-violet-300/55 mb-2">{whisperSubhint}</p>
          ) : null}
          <p
            className={`text-sm italic leading-relaxed ${
              zen ? 'text-violet-100/90 line-clamp-4 sm:line-clamp-5' : 'text-violet-900/90 dark:text-violet-100/90'
            }`}
          >
            {whisper}
          </p>
        </div>
      ) : null}
      {!compact ? <p className={`text-xs mb-4 ${descCls}`}>{desc}</p> : null}
      <ul className={listClass}>
        {chronicle.map((item, i) => (
          <motion.li
            key={`${item.type}-${item.id}-${i}`}
            initial={{ opacity: 0, x: layout === 'rail' ? 12 : -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 * i }}
            className={
              layout === 'rail'
                ? 'snap-center shrink-0 w-[min(17rem,85vw)] max-w-[17rem]'
                : layout === 'grid'
                  ? 'min-h-0 min-w-0 flex w-full'
                  : ''
            }
          >
            {cardInner(item)}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  )
}
