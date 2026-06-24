'use client'

import type { SortDir } from '@/lib/table-sort'

type Props = {
  columnKey: string
  label: string
  sortKey: string | null
  sortDir: SortDir
  onSort: (key: string) => void
  className?: string
  align?: 'left' | 'right' | 'center'
}

const DEFAULT_CLASS =
  'px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-widest'

export function SortableTh({
  columnKey,
  label,
  sortKey,
  sortDir,
  onSort,
  className,
  align = 'left',
}: Props) {
  const active = sortKey === columnKey
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <th
      className={`${className ?? DEFAULT_CLASS} ${alignClass} cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200 transition-colors`}
      onClick={() => onSort(columnKey)}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      scope="col"
    >
      <span
        className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : ''}`}
      >
        {label}
        <span
          className={`text-[9px] leading-none ${active ? 'text-violet-500 opacity-100' : 'opacity-40'}`}
          aria-hidden
        >
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    </th>
  )
}
