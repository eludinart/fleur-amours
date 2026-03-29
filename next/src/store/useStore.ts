'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setLocale as setI18nLocale } from '@/i18n'

type Card = { name?: string; slug?: string; tags?: string[] }
type HistoryItem = { slug: string; name: string; at: number }
type SavedDiagnostic = { savedAt: string; [k: string]: unknown }

interface StoreState {
  cards: Card[]
  setCards: (cards: Card[]) => void
  currentCard: Card | null
  setCurrentCard: (card: Card | null) => void
  filterQuery: string
  setFilterQuery: (q: string) => void
  filteredCards: () => Card[]
  socialMode: string
  setSocialMode: (mode: string) => void
  pointsDeRosee: number
  setPointsDeRosee: (n: number) => void
  theme: string
  toggleTheme: () => void
  sapTooltipSeen: boolean
  setSapTooltipSeen: (v: boolean) => void
  hasSeenOnboardingTour: boolean
  setHasSeenOnboardingTour: (v: boolean) => void
  /** IDs persistés : indices contextuels fermés par l'utilisateur */
  dismissedContextualHints: string[]
  dismissContextualHint: (id: string) => void
  hasCompletedFirstFleur: boolean
  setHasCompletedFirstFleur: (v: boolean) => void
  hasDoneFirstTirage: boolean
  setHasDoneFirstTirage: (v: boolean) => void
  hasSeenSessionIntro: boolean
  setHasSeenSessionIntro: (v: boolean) => void
  hasCompletedFirstSession: boolean
  setHasCompletedFirstSession: (v: boolean) => void
  fontSizePreference: string
  setFontSizePreference: (v: string) => void
  locale: string
  setLocale: (v: string) => void
  history: HistoryItem[]
  addToHistory: (slug: string, name?: string) => void
  savedDiagnostics: SavedDiagnostic[]
  saveDiagnostic: (diag: Record<string, unknown>) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      cards: [],
      setCards: (cards) => set({ cards }),
      currentCard: null,
      setCurrentCard: (card) => set({ currentCard: card }),
      filterQuery: '',
      setFilterQuery: (q) => set({ filterQuery: q }),
      filteredCards: () => {
        const { cards, filterQuery } = get()
        if (!filterQuery.trim()) return cards
        const q = filterQuery.toLowerCase()
        return cards.filter(
          (c) =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.slug || '').toLowerCase().includes(q) ||
            (c.tags || []).join(' ').toLowerCase().includes(q)
        )
      },
      socialMode: 'PRIVATE',
      setSocialMode: (mode) => set({ socialMode: mode }),
      pointsDeRosee: 5,
      setPointsDeRosee: (n) => set({ pointsDeRosee: Math.max(0, n) }),
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      sapTooltipSeen: false,
      setSapTooltipSeen: (v) => set({ sapTooltipSeen: v }),
      hasSeenOnboardingTour: false,
      setHasSeenOnboardingTour: (v) => set({ hasSeenOnboardingTour: v }),
      dismissedContextualHints: [],
      dismissContextualHint: (id) =>
        set((s) =>
          s.dismissedContextualHints.includes(id)
            ? s
            : { dismissedContextualHints: [...s.dismissedContextualHints, id] }
        ),
      hasCompletedFirstFleur: false,
      setHasCompletedFirstFleur: (v) => set({ hasCompletedFirstFleur: v }),
      hasDoneFirstTirage: false,
      setHasDoneFirstTirage: (v) => set({ hasDoneFirstTirage: v }),
      hasSeenSessionIntro: false,
      setHasSeenSessionIntro: (v) => set({ hasSeenSessionIntro: v }),
      hasCompletedFirstSession: false,
      setHasCompletedFirstSession: (v) => set({ hasCompletedFirstSession: v }),
      fontSizePreference: 'normal',
      setFontSizePreference: (v) => set({ fontSizePreference: v }),
      locale: 'fr',
      setLocale: (v) => {
        const next = v || 'fr'
        setI18nLocale(next)
        set({ locale: next })
      },
      history: [],
      addToHistory: (slug, name) =>
        set((s) => {
          const h = s.history.filter((x) => x.slug !== slug)
          return { history: [{ slug, name: name || slug, at: Date.now() }, ...h].slice(0, 20) }
        }),
      savedDiagnostics: [],
      saveDiagnostic: (diag) =>
        set((s) => ({
          savedDiagnostics: [
            { ...diag, savedAt: new Date().toISOString() },
            ...s.savedDiagnostics,
          ].slice(0, 10),
        })),
    }),
    {
      name: 'fleur-amours-store',
      version: 8,
      migrate: (persistedState: unknown) => {
        const s = persistedState as Record<string, unknown>
        if (!s) return undefined
        const { topBannerExpanded, ...rest } = s
        return {
          ...rest,
          theme: s.theme ?? 'dark',
          sapTooltipSeen: s.sapTooltipSeen ?? false,
          hasSeenOnboardingTour: s.hasSeenOnboardingTour ?? false,
          hasCompletedFirstFleur: s.hasCompletedFirstFleur ?? false,
          hasDoneFirstTirage: s.hasDoneFirstTirage ?? false,
          hasSeenSessionIntro: s.hasSeenSessionIntro ?? false,
          hasCompletedFirstSession: s.hasCompletedFirstSession ?? false,
          fontSizePreference: s.fontSizePreference ?? 'normal',
          locale: s.locale ?? 'fr',
          dismissedContextualHints: Array.isArray(s.dismissedContextualHints)
            ? s.dismissedContextualHints
            : [],
        }
      },
      partialize: (state) => ({
        theme: state.theme,
        history: state.history,
        savedDiagnostics: state.savedDiagnostics,
        sapTooltipSeen: state.sapTooltipSeen,
        hasSeenOnboardingTour: state.hasSeenOnboardingTour,
        hasCompletedFirstFleur: state.hasCompletedFirstFleur,
        hasDoneFirstTirage: state.hasDoneFirstTirage,
        hasSeenSessionIntro: state.hasSeenSessionIntro,
        hasCompletedFirstSession: state.hasCompletedFirstSession,
        fontSizePreference: state.fontSizePreference,
        locale: state.locale,
        dismissedContextualHints: state.dismissedContextualHints,
      }),
    }
  )
)
