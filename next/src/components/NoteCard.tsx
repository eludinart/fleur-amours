'use client'

type NoteCardProps = {
  children: React.ReactNode
  className?: string
}

/** Carte de note/disclaimer — fond violet/slate, style cohérent avec le thème onirique */
export function NoteCard({ children, className = '' }: NoteCardProps) {
  return (
    <div
      className={`rounded-xl bg-slate-100 dark:bg-violet-950/30 border border-slate-200 dark:border-violet-500/30 p-4 text-xs text-slate-700 dark:text-slate-200 text-left space-y-1 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  )
}
