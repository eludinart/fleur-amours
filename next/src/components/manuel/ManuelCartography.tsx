'use client'

import { useMemo, useState, type MouseEvent } from 'react'
import type { ManuelManifestSection } from '@/lib/manuel'
import { FOUR_DOORS } from '@/data/tarotCards'
import { t } from '@/i18n'
import {
  MANUEL_CLIMATE_CYCLES,
  MANUEL_DOOR_ZONES,
  MANUEL_INTRO_GROUPS,
  filterSections,
  isManuelCartoVisible,
  manuelFileNum,
  sectionsInRange,
  isManuelCardFile,
  sortVegetalStemSections,
} from '@/lib/manuel-cartography'
import { manuelTocAnchorFromFile, rememberManuelTocReturn } from '@/lib/manuel-toc-scroll'

type Props = {
  sections: ManuelManifestSection[]
  hrefFor: (file: string) => string
  openChapter: (file: string, fromEl: HTMLElement) => void
  query: string
  canonicalTitle: (raw: string) => string
  sectionTitle: (section: ManuelManifestSection) => string
  cardImageFor: (title: string) => string | undefined
}

const INTRO_ICONS: Record<string, string> = {
  origins: '🌱',
  ethics: '🤝',
  draws: '🎴',
  architecture: '🌸',
}

const DOOR_ICONS: Record<string, string> = {
  love: '♥',
  vegetal: '🌿',
  elements: '☁',
  life: '∞',
}

/** Fond de bandeau porte : pastel en clair, teinte profonde en sombre. */
const DOOR_HEADER_BG: Record<string, string> = {
  love: 'bg-gradient-to-br from-rose-50 via-rose-50/95 to-pink-100/80 dark:from-rose-950 dark:via-rose-900/90 dark:to-rose-950/80',
  vegetal:
    'bg-gradient-to-br from-emerald-50 via-emerald-50/95 to-teal-100/70 dark:from-emerald-950 dark:via-emerald-900/90 dark:to-emerald-950/80',
  elements:
    'bg-gradient-to-br from-sky-50 via-sky-50/95 to-cyan-100/70 dark:from-sky-950 dark:via-sky-900/90 dark:to-sky-950/80',
  life: 'bg-gradient-to-br from-violet-50 via-violet-50/95 to-purple-100/70 dark:from-violet-950 dark:via-violet-900/90 dark:to-violet-950/80',
}

const DOOR_HEADER_ACCENT: Record<string, string> = {
  love: 'text-rose-700 dark:text-rose-300',
  vegetal: 'text-emerald-700 dark:text-emerald-300',
  elements: 'text-sky-700 dark:text-sky-300',
  life: 'text-violet-700 dark:text-violet-300',
}

/** Couleurs d'accent par sous-cycle (Porte du Climat). */
const CLIMATE_CYCLE_ACCENT: Record<string, string> = {
  raw: 'border-amber-300/60 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20',
  earth: 'border-stone-300/60 bg-stone-50/50 dark:border-stone-700/40 dark:bg-stone-900/30',
  water: 'border-sky-300/60 bg-sky-50/50 dark:border-sky-800/40 dark:bg-sky-950/20',
  air: 'border-cyan-300/60 bg-cyan-50/40 dark:border-cyan-800/40 dark:bg-cyan-950/15',
  fire: 'border-orange-300/60 bg-orange-50/50 dark:border-orange-900/40 dark:bg-orange-950/20',
  ether: 'border-violet-300/60 bg-violet-50/50 dark:border-violet-800/40 dark:bg-violet-950/20',
}

function sectionMatches(
  section: ManuelManifestSection,
  filtered: Set<string>,
  query: string,
): boolean {
  if (!query.trim()) return true
  return filtered.has(section.file)
}

function shortCardLabel(label: string): string {
  const t = label.trim()
  if (t.length <= 18) return t
  return t
    .replace(/^(Le |La |Les |L')/i, '')
    .replace(/\s+/g, ' ')
}

/** Tuile carte — format portrait, comme sur le tapis de tirage. */
function CardTile({
  href,
  label,
  img,
  file,
  openChapter,
  accentClass,
  showLabel = true,
  size = 'md',
}: {
  href: string
  label: string
  img?: string
  file: string
  openChapter: (file: string, fromEl: HTMLElement) => void
  accentClass?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}) {
  const frameClass =
    size === 'sm'
      ? 'max-w-[56px] min-[380px]:max-w-[64px] sm:max-w-[72px]'
      : 'max-w-[68px] min-[380px]:max-w-[76px] sm:max-w-[88px] md:max-w-[96px]'

  const anchorId = manuelTocAnchorFromFile(file)

  const handleOpen = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    rememberManuelTocReturn(anchorId, e.currentTarget)
    openChapter(file, e.currentTarget)
  }

  return (
    <a
      id={anchorId}
      href={href}
      onMouseDown={(e) => rememberManuelTocReturn(anchorId, e.currentTarget)}
      onClick={handleOpen}
      className={[
        'group flex flex-col items-center text-center min-w-0',
        'rounded-xl p-1 sm:p-1.5 md:p-2 transition-all duration-200',
        'active:scale-[0.98] sm:hover:-translate-y-0.5 sm:hover:shadow-lg',
        accentClass ?? 'sm:hover:bg-white/80 dark:sm:hover:bg-slate-800/50',
      ].join(' ')}
    >
      <div
        className={[
          'relative w-full aspect-[5/7] mx-auto rounded-lg overflow-hidden',
          frameClass,
          'shadow-md ring-1 ring-black/10 dark:ring-white/10',
          'sm:group-hover:ring-violet-400/50 sm:group-hover:shadow-violet-500/15',
          'transition-all duration-200',
        ].join(' ')}
      >
        {img ? (
          <img
            src={img}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
            <span className="text-[8px] sm:text-[10px] font-semibold text-slate-400 dark:text-slate-500 px-0.5 text-center leading-tight">
              <span translate="no">{shortCardLabel(label)}</span>
            </span>
          </div>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 sm:group-hover:opacity-100 transition-opacity"
          aria-hidden
        />
      </div>
      {showLabel ? (
        <span
          className={[
            'mt-1 sm:mt-1.5 w-full font-medium leading-tight',
            size === 'sm' ? 'text-[9px] sm:text-[10px]' : 'text-[9px] sm:text-[11px]',
            'text-slate-600 dark:text-slate-300 sm:group-hover:text-violet-700 dark:sm:group-hover:text-violet-300',
            'line-clamp-2 px-0.5',
          ].join(' ')}
        >
          <span translate="no">{shortCardLabel(label)}</span>
        </span>
      ) : null}
    </a>
  )
}

function IntroChapterLink({
  href,
  label,
  file,
  openChapter,
}: {
  href: string
  label: string
  file: string
  openChapter: (file: string, fromEl: HTMLElement) => void
}) {
  const anchorId = manuelTocAnchorFromFile(file)

  const handleOpen = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    rememberManuelTocReturn(anchorId, e.currentTarget)
    openChapter(file, e.currentTarget)
  }

  return (
    <a
      id={anchorId}
      href={href}
      onMouseDown={(e) => rememberManuelTocReturn(anchorId, e.currentTarget)}
      onClick={handleOpen}
      className="flex items-center rounded-xl border border-white/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/50 px-3 py-3 min-h-[44px] text-sm hover:border-violet-300 hover:shadow-sm transition-all w-full"
    >
      <span className="text-slate-700 dark:text-slate-200 leading-snug" translate="no">
        {label}
      </span>
    </a>
  )
}
function PetalGrid({
  items,
  hrefFor,
  openChapter,
  canonicalTitle,
  cardImageFor,
}: {
  items: ManuelManifestSection[]
  hrefFor: (f: string) => string
  openChapter: (file: string, fromEl: HTMLElement) => void
  canonicalTitle: (raw: string) => string
  cardImageFor: (title: string) => string | undefined
}) {
  return (
    <div className="relative py-1 sm:py-2">
      <div
        className="pointer-events-none absolute inset-6 sm:inset-4 rounded-full border border-dashed border-rose-200/80 dark:border-rose-800/40 hidden min-[400px]:block"
        aria-hidden
      />
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 min-[400px]:grid-cols-4 min-[400px]:gap-x-3 min-[400px]:gap-y-5 max-w-lg mx-auto">
        {items.map((s) => (
          <CardTile
            key={s.file}
            href={hrefFor(s.file)}
            file={s.file}
            openChapter={openChapter}
            label={sectionTitle(s)}
            img={cardImageFor(s.title)}
          />
        ))}
      </div>
    </div>
  )
}

/** Cycle végétal — cartes seules, ordre botanique (pollen → graine). */
function StemTimeline({
  items,
  hrefFor,
  openChapter,
  canonicalTitle,
  cardImageFor,
}: {
  items: ManuelManifestSection[]
  hrefFor: (f: string) => string
  openChapter: (file: string, fromEl: HTMLElement) => void
  canonicalTitle: (raw: string) => string
  cardImageFor: (title: string) => string | undefined
}) {
  const ordered = sortVegetalStemSections(items)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 max-w-3xl mx-auto">
      {ordered.map((s) => (
        <CardTile
          key={s.file}
          href={hrefFor(s.file)}
          file={s.file}
          openChapter={openChapter}
          label={sectionTitle(s)}
          img={cardImageFor(s.title)}
        />
      ))}
    </div>
  )
}

/** Cycle de la vie — arc en 3×4. */
function LifeArc({
  items,
  hrefFor,
  openChapter,
  canonicalTitle,
  cardImageFor,
}: {
  items: ManuelManifestSection[]
  hrefFor: (f: string) => string
  openChapter: (file: string, fromEl: HTMLElement) => void
  canonicalTitle: (raw: string) => string
  cardImageFor: (title: string) => string | undefined
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 max-w-2xl mx-auto">
      {items.map((s) => (
        <CardTile
          key={s.file}
          href={hrefFor(s.file)}
          file={s.file}
          openChapter={openChapter}
          label={sectionTitle(s)}
          img={cardImageFor(s.title)}
        />
      ))}
    </div>
  )
}

function ClimateZone({
  sections,
  filteredSet,
  query,
  hrefFor,
  openChapter,
  canonicalTitle,
  cardImageFor,
}: {
  sections: ManuelManifestSection[]
  filteredSet: Set<string>
  query: string
  hrefFor: (f: string) => string
  openChapter: (file: string, fromEl: HTMLElement) => void
  canonicalTitle: (raw: string) => string
  cardImageFor: (title: string) => string | undefined
}) {
  return (
    <div className="space-y-5">
      {MANUEL_CLIMATE_CYCLES.map((cycle) => {
        const cycleSections = sectionsInRange(sections, cycle.from, cycle.to).filter(
          (s) => sectionMatches(s, filteredSet, query) && isManuelCardFile(s.file),
        )
        if (!cycleSections.length) return null
        const isRaw = cycle.id === 'raw'
        const accent = CLIMATE_CYCLE_ACCENT[cycle.id] ?? ''
        return (
          <div
            key={cycle.id}
            className={['rounded-xl border p-3 sm:p-4', accent].join(' ')}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-3 text-center sm:text-left">
              {t(cycle.labelKey)}
            </p>
            <div
              className={
                isRaw
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 max-w-3xl mx-auto'
                  : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3'
              }
            >
              {cycleSections.map((s) => (
                <CardTile
                  key={s.file}
                  href={hrefFor(s.file)}
                  file={s.file}
                  openChapter={openChapter}
                  label={sectionTitle(s)}
                  img={cardImageFor(s.title)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DoorPanel({
  zone,
  sections,
  filteredSet,
  query,
  hrefFor,
  openChapter,
  canonicalTitle,
  cardImageFor,
  defaultOpen,
  fullWidth,
}: {
  zone: (typeof MANUEL_DOOR_ZONES)[number]
  sections: ManuelManifestSection[]
  filteredSet: Set<string>
  query: string
  hrefFor: (file: string) => string
  openChapter: (file: string, fromEl: HTMLElement) => void
  canonicalTitle: (raw: string) => string
  cardImageFor: (title: string) => string | undefined
  defaultOpen?: boolean
  fullWidth?: boolean
}) {
  const doorStyle = FOUR_DOORS.find((d) => d.key === zone.doorKey)!
  const [open, setOpen] = useState(defaultOpen ?? false)

  const introSections = sectionsInRange(sections, zone.introFrom, zone.introTo).filter((s) =>
    sectionMatches(s, filteredSet, query),
  )
  const cardSections = sectionsInRange(sections, zone.cardsFrom, zone.cardsTo).filter(
    (s) => sectionMatches(s, filteredSet, query) && isManuelCardFile(s.file),
  )

  const visible = introSections.length + cardSections.length > 0
  if (!visible) return null

  return (
    <div
      className={[
        'rounded-2xl border overflow-hidden shadow-sm transition-shadow hover:shadow-md',
        doorStyle.border,
        fullWidth ? 'md:col-span-2' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'w-full text-left px-3 py-4 sm:px-5 sm:py-5 flex items-start gap-3 transition-colors min-h-[56px]',
          DOOR_HEADER_BG[zone.doorKey],
        ].join(' ')}
        aria-expanded={open}
      >
        <span
          className={[
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-serif shadow-sm',
            DOOR_HEADER_ACCENT[zone.doorKey],
            'bg-white/80 dark:bg-slate-950/50 border border-black/5 dark:border-white/10',
          ].join(' ')}
          aria-hidden
        >
          {DOOR_ICONS[zone.doorKey]}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={[
              'text-[11px] font-semibold uppercase tracking-[0.14em]',
              DOOR_HEADER_ACCENT[zone.doorKey],
            ].join(' ')}
          >
            {t(zone.subtitleKey)}
          </p>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 leading-tight mt-0.5">
            {t(zone.labelKey)}
          </h3>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1">
            {t(zone.aspectKey)} · {cardSections.length} cartes
          </p>
        </div>
        <span
          className="text-slate-600 dark:text-slate-300 text-xl font-light shrink-0 pt-0.5"
          aria-hidden
        >
          {open ? '−' : '+'}
        </span>
      </button>

      {open ? (
        <div className="px-2.5 sm:px-5 pb-4 sm:pb-5 pt-2 bg-white/70 dark:bg-slate-950/50 border-t border-white/50 dark:border-slate-800/80 space-y-3 sm:space-y-4 overflow-x-hidden">
          {introSections.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {introSections.map((s) => (
                <IntroChapterLink
                  key={s.file}
                  href={hrefFor(s.file)}
                  file={s.file}
                  openChapter={openChapter}
                  label={sectionTitle(s)}
                />
              ))}
            </div>
          ) : null}

          {zone.id === 'heart' ? (
            <PetalGrid
              items={cardSections}
              hrefFor={hrefFor}
              openChapter={openChapter}
              canonicalTitle={canonicalTitle}
              cardImageFor={cardImageFor}
            />
          ) : zone.id === 'time' ? (
            <StemTimeline
              items={cardSections}
              hrefFor={hrefFor}
              openChapter={openChapter}
              canonicalTitle={canonicalTitle}
              cardImageFor={cardImageFor}
            />
          ) : zone.id === 'climate' ? (
            <ClimateZone
              sections={sections}
              filteredSet={filteredSet}
              query={query}
              hrefFor={hrefFor}
              openChapter={openChapter}
              canonicalTitle={canonicalTitle}
              cardImageFor={cardImageFor}
            />
          ) : (
            <LifeArc
              items={cardSections}
              hrefFor={hrefFor}
              openChapter={openChapter}
              canonicalTitle={canonicalTitle}
              cardImageFor={cardImageFor}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function ManuelCartography({
  sections,
  hrefFor,
  openChapter,
  query,
  canonicalTitle,
  sectionTitle,
  cardImageFor,
}: Props) {
  const visibleSections = useMemo(
    () => sections.filter((s) => isManuelCartoVisible(s.file)),
    [sections],
  )
  const filtered = useMemo(
    () => filterSections(visibleSections, query, sectionTitle),
    [visibleSections, query, sectionTitle],
  )
  const filteredSet = useMemo(() => new Set(filtered.map((s) => s.file)), [filtered])

  const introVisible = useMemo(
    () =>
      MANUEL_INTRO_GROUPS.some((g) =>
        sectionsInRange(visibleSections, g.from, g.to).some((s) =>
          sectionMatches(s, filteredSet, query),
        ),
      ),
    [visibleSections, filteredSet, query],
  )

  const annexSections = useMemo(
    () =>
      visibleSections.filter((s) => {
        const n = manuelFileNum(s.file)
        return n >= 94 && sectionMatches(s, filteredSet, query)
      }),
    [visibleSections, filteredSet, query],
  )

  const hasResults = filtered.length > 0

  return (
    <div className="space-y-8 sm:space-y-10 min-w-0 overflow-x-hidden">
      {introVisible ? (
        <section aria-labelledby="manuel-carto-intro">
          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
              {t('manuel.carto.intro.badge')}
            </p>
            <h2
              id="manuel-carto-intro"
              className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1"
            >
              {t('manuel.carto.intro.title')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-2xl leading-relaxed">
              {t('manuel.carto.intro.desc')}
            </p>
          </div>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            {MANUEL_INTRO_GROUPS.map((group) => {
              const groupSections = sectionsInRange(visibleSections, group.from, group.to).filter((s) =>
                sectionMatches(s, filteredSet, query),
              )
              if (!groupSections.length) return null
              return (
                <div
                  key={group.id}
                  className="rounded-2xl border border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/90 to-orange-50/50 dark:from-amber-950/70 dark:to-orange-950/50 p-4 sm:p-5"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-2xl" aria-hidden>
                      {INTRO_ICONS[group.id]}
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-amber-50">
                        {t(group.labelKey)}
                      </h3>
                      <p className="text-xs text-slate-700 dark:text-amber-200/80 mt-0.5">
                        {t(group.hintKey)}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {groupSections.map((s) => (
                      <IntroChapterLink
                        key={s.file}
                        href={hrefFor(s.file)}
                        file={s.file}
                        openChapter={openChapter}
                        label={sectionTitle(s)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="manuel-carto-doors">
        <div className="mb-6 text-center max-w-xl mx-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
            {t('manuel.carto.doors.badge')}
          </p>
          <h2
            id="manuel-carto-doors"
            className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1"
          >
            {t('manuel.carto.doors.title')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
            {t('manuel.carto.doors.desc')}
          </p>
        </div>

        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-1.5 max-w-2xl mx-auto mb-5 sm:mb-8 text-center"
          aria-hidden
        >
          {FOUR_DOORS.map((d) => (
            <div
              key={d.key}
              className={[
                'rounded-lg py-2 px-1 text-[9px] uppercase tracking-wider font-semibold border',
                d.border,
                DOOR_HEADER_ACCENT[d.key],
                DOOR_HEADER_BG[d.key],
              ].join(' ')}
            >
              {d.subtitle}
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          {MANUEL_DOOR_ZONES.map((zone) => (
            <DoorPanel
              key={zone.id}
              zone={zone}
              sections={visibleSections}
              filteredSet={filteredSet}
              query={query}
              hrefFor={hrefFor}
              openChapter={openChapter}
              canonicalTitle={canonicalTitle}
              cardImageFor={cardImageFor}
              defaultOpen={!query.trim()}
              fullWidth={zone.id === 'climate' || zone.id === 'history'}
            />
          ))}
        </div>
      </section>

      {annexSections.length ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/30 p-4 sm:p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            {t('manuel.carto.annex')}
          </h2>
          <ul className="flex flex-wrap gap-3">
            {annexSections.map((s) => {
              const anchorId = manuelTocAnchorFromFile(s.file)
              const href = hrefFor(s.file)
              return (
                <li key={s.file}>
                  <a
                    id={anchorId}
                    href={href}
                    onMouseDown={(e) => rememberManuelTocReturn(anchorId, e.currentTarget)}
                    onClick={(e) => {
                      e.preventDefault()
                      rememberManuelTocReturn(anchorId, e.currentTarget)
                      openChapter(s.file, e.currentTarget)
                    }}
                    className="text-sm text-violet-700 dark:text-violet-300 hover:underline px-3 py-1.5 rounded-lg border border-violet-200/60 dark:border-violet-800/40 bg-white/60 dark:bg-slate-900/40"
                  >
                    <span translate="no">{sectionTitle(s)}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {!hasResults ? (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
          {t('manuel.carto.noResults')}
        </p>
      ) : null}
    </div>
  )
}
