'use client'

import { useCallback, useMemo, useState } from 'react'
import { compareSortValues, getSortValue, type SortAccessor, type SortDir } from '@/lib/table-sort'

export function useTableSort<T>(
  items: T[] | null | undefined,
  accessors: Record<string, SortAccessor<T>>,
  options?: { defaultKey?: string; defaultDir?: SortDir },
) {
  const [sortKey, setSortKey] = useState<string | null>(options?.defaultKey ?? null)
  const [sortDir, setSortDir] = useState<SortDir>(options?.defaultDir ?? 'asc')

  const toggleSort = useCallback(
    (key: string) => {
      if (!accessors[key]) return
      setSortKey((prev) => {
        if (prev === key) {
          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
          return prev
        }
        setSortDir('asc')
        return key
      })
    },
    [accessors],
  )

  const sortedItems = useMemo(() => {
    if (!items?.length || !sortKey || !accessors[sortKey]) return items ?? []
    const accessor = accessors[sortKey]
    return [...items].sort((a, b) =>
      compareSortValues(getSortValue(a, accessor), getSortValue(b, accessor), sortDir),
    )
  }, [items, sortKey, sortDir, accessors])

  return { sortedItems, sortKey, sortDir, toggleSort }
}
