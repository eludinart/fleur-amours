'use client'

import Link from 'next/link'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export function PlaceholderPage({ title, path }: { title: string; path: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900">
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-slate-400 mb-6">Page en cours de migration vers Next.js</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  )
}
