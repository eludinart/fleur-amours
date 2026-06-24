export type SortDir = 'asc' | 'desc'

export type SortAccessor<T> = keyof T | ((row: T) => unknown)

export function getSortValue<T>(row: T, accessor: SortAccessor<T>): unknown {
  if (typeof accessor === 'function') return accessor(row)
  return row[accessor]
}

function isEmptySortValue(v: unknown): boolean {
  return v == null || v === '' || v === '—' || v === '-'
}

/** Compare deux valeurs pour un tri de colonne (dates ISO, nombres, texte). */
export function compareSortValues(a: unknown, b: unknown, dir: SortDir): number {
  const mul = dir === 'asc' ? 1 : -1

  if (isEmptySortValue(a) && isEmptySortValue(b)) return 0
  if (isEmptySortValue(a)) return 1
  if (isEmptySortValue(b)) return -1

  if (typeof a === 'number' && typeof b === 'number') {
    return mul * (a - b)
  }

  const as = String(a).trim()
  const bs = String(b).trim()

  if (/^-?\d+(\.\d+)?$/.test(as) && /^-?\d+(\.\d+)?$/.test(bs)) {
    return mul * (Number(as) - Number(bs))
  }

  const da = Date.parse(as)
  const db = Date.parse(bs)
  if (!Number.isNaN(da) && !Number.isNaN(db) && (/\d{4}-\d{2}-\d{2}/.test(as) || /\d{4}-\d{2}-\d{2}/.test(bs))) {
    return mul * (da - db)
  }

  return mul * as.localeCompare(bs, 'fr', { numeric: true, sensitivity: 'base' })
}
