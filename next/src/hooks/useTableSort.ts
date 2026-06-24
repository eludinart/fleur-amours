'use client'

import { useCallback, useMemo, useState } from 'react'
import { compareSortValues, getSortValue, type SortAccessor, type SortDir } from '@/lib/table-sort'

type SortMode =
  | { mode: 'default' }
  | { mode: 'active'; key: string; dir: SortDir }
  | { mode: 'none' }

type EffectiveSort = { key: string; dir: SortDir } | null

function resolveEffectiveSort(
  state: SortMode,
  options?: { defaultKey?: string; defaultDir?: SortDir },
): EffectiveSort {
  if (state.mode === 'active') return { key: state.key, dir: state.dir }
  if (state.mode === 'default' && options?.defaultKey) {
    return { key: options.defaultKey, dir: options?.defaultDir ?? 'asc' }
  }
  return null
}

/**
 * Tri client des colonnes de tableau (SortableTh).
 * Cycle par colonne : 1er clic croissant → 2e décroissant → 3e sans tri (ordre d'origine).
 * Si un tri par défaut est configuré, il s'applique au chargement jusqu'à annulation explicite.
 */
export function useTableSort<T>(
  items: T[] | null | undefined,
  accessors: Record<string, SortAccessor<T>>,
  options?: { defaultKey?: string; defaultDir?: SortDir },
) {
  const defaultKey = options?.defaultKey
  const defaultDir = options?.defaultDir
  const sortOptions = useMemo(
    () => (defaultKey ? { defaultKey, defaultDir } : undefined),
    [defaultKey, defaultDir],
  )

  const [sortState, setSortState] = useState<SortMode>(() =>
    defaultKey ? { mode: 'default' } : { mode: 'none' },
  )

  const effective = resolveEffectiveSort(sortState, sortOptions)

  const toggleSort = useCallback(
    (key: string) => {
      if (!accessors[key]) return
      setSortState((prev) => {
        const current = resolveEffectiveSort(prev, sortOptions)

        if (current?.key !== key) {
          return { mode: 'active', key, dir: 'asc' }
        }

        if (current.dir === 'asc') {
          return { mode: 'active', key, dir: 'desc' }
        }

        if (prev.mode === 'default') {
          return { mode: 'active', key, dir: 'asc' }
        }

        return { mode: 'none' }
      })
    },
    [accessors, sortOptions],
  )

  const sortedItems = useMemo(() => {
    if (!items?.length || !effective || !accessors[effective.key]) return items ?? []
    const accessor = accessors[effective.key]
    return [...items].sort((a, b) =>
      compareSortValues(getSortValue(a, accessor), getSortValue(b, accessor), effective.dir),
    )
  }, [items, effective, accessors])

  return {
    sortedItems,
    sortKey: effective?.key ?? null,
    sortDir: effective?.dir ?? 'asc',
    toggleSort,
  }
}
