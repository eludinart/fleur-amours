'use client'

import React from 'react'
import Link from 'next/link'

type Props = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center shadow-lg">
            <span className="text-5xl mb-4 block">🌿</span>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Une erreur s&apos;est produite
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Désolé, quelque chose a mal tourné. Rechargez la page ou retournez à l&apos;accueil.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors"
              >
                Recharger la page
              </button>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Retour à l&apos;accueil
              </Link>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
