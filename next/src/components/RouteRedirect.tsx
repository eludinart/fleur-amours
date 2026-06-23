'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function RouteRedirect({ to }: { to: string }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(to)
  }, [router, to])
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )
}
