/** Skeleton de chargement pour le dashboard et listes */
export function DashboardSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
      <div className="flex justify-center">
        <div className="w-48 h-48 rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="h-32 rounded-xl bg-slate-200 dark:bg-slate-700" />
      <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-700" />
    </div>
  )
}

/** Skeleton pour le Dashboard Admin */
export function AdminDashboardSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-8 animate-pulse">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-56 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="h-14 w-28 rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="h-16 w-full rounded-2xl bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-4">
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-slate-200 dark:bg-slate-700" />
      ))}
    </div>
  )
}
