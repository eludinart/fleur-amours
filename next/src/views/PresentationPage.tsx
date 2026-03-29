'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { t } from '@/i18n'
import { NoteCard } from '@/components/NoteCard'
import { useStore } from '@/store/useStore'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export function PresentationPage() {
  useStore((s) => s.locale)
  const { user } = useAuth()
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div
        className="max-w-2xl mx-auto px-4 py-10 sm:py-14 space-y-10"
        style={{ animation: 'fadeIn 0.6s ease' }}
      >
        {user && (
          <div className="flex justify-end">
            <Link
              href="/"
              className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              {t('presentation.backDashboard')}
            </Link>
          </div>
        )}
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-rose-500 shadow-xl shadow-rose-500/25 p-2">
            <img
              src={`${basePath}/juste-la-fleur.png`}
              alt=""
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
            {t('presentation.welcomeTitle')}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed font-medium">
            {t('presentation.welcomeSubtitle')}
          </p>
        </div>

        {/* Introduction */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('presentation.intro')}
          </p>
        </div>

        {/* AI Systémique */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {t('presentation.aiTitle')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('presentation.aiDesc')}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            {t('presentation.aiTagline')}
          </p>
        </div>

        {/* Tarot */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {t('presentation.tarotTitle')}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('presentation.tarotIntro')}
          </p>
          <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li>
              <strong>{t('presentation.tarotCardLabel')}</strong> :{' '}
              {t('presentation.tarotCardDesc')}
            </li>
            <li>
              <strong>{t('presentation.tarotDoorsLabel')}</strong> :{' '}
              {t('presentation.tarotDoorsDesc')}
              <ul className="mt-2 ml-4 space-y-1 text-slate-500 dark:text-slate-400">
                <li>
                  <strong>{t('presentation.tarotDoor1')}</strong> :{' '}
                  {t('presentation.tarotDoor1Desc')}
                </li>
                <li>
                  <strong>{t('presentation.tarotDoor2')}</strong> :{' '}
                  {t('presentation.tarotDoor2Desc')}
                </li>
                <li>
                  <strong>{t('presentation.tarotDoor3')}</strong> :{' '}
                  {t('presentation.tarotDoor3Desc')}
                </li>
                <li>
                  <strong>{t('presentation.tarotDoor4')}</strong> :{' '}
                  {t('presentation.tarotDoor4Desc')}
                </li>
              </ul>
            </li>
          </ul>
        </div>

        {/* Closing */}
        <p className="text-center text-slate-600 dark:text-slate-300 font-medium">
          {t('presentation.closing')}
        </p>

        {/* Features */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {t('presentation.whatForTitle')}
          </h2>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-violet-600 dark:text-violet-400 text-lg">
                🌿
              </span>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  {t('presentation.gardenFeatureTitle')}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  {t('presentation.gardenFeatureDesc')}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 text-lg">
                🎴
              </span>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  {t('presentation.tiragesFeatureTitle')}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  {t('presentation.tiragesFeatureDesc')}
                </p>
              </div>
            </li>
          </ul>
          <NoteCard>
            <p className="italic">{t('presentation.disclaimer')}</p>
            <p>
              {t('presentation.accompanyProposal')}{' '}
              <Link
                href="/coaches"
                className="text-violet-600 dark:text-violet-400 underline hover:no-underline"
              >
                {t('presentation.requestMeeting')}
              </Link>
            </p>
          </NoteCard>
        </div>

        {/* Accompagnement & Chat */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/coaches"
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-transparent dark:from-emerald-950/30 dark:to-transparent hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group"
          >
            <span className="text-4xl group-hover:scale-110 transition-transform">
              🤝
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {t('presentation.requestAccompaniment')}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 text-center">
              {t('presentation.requestAccompanimentSub')}
            </span>
          </Link>
          {user && (
            <Link
              href="/chat"
              className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-950/30 dark:to-transparent hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-lg hover:shadow-amber-500/10 transition-all group"
            >
              <span className="text-4xl group-hover:scale-110 transition-transform">
                💬
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {t('presentation.chatCoach')}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 text-center">
                {t('presentation.chatCoachSub')}
              </span>
            </Link>
          )}
        </div>

        {/* Actions */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/session"
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-transparent dark:from-violet-950/30 dark:to-transparent hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-lg hover:shadow-violet-500/10 transition-all group"
          >
            <span className="text-4xl group-hover:scale-110 transition-transform">
              🌿
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {t('presentation.exploreFleur')}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 text-center">
              {t('presentation.exploreFleurSub')}
            </span>
          </Link>
          <Link
            href="/tirage"
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-rose-200 dark:border-rose-800 bg-gradient-to-br from-rose-50 to-transparent dark:from-rose-950/30 dark:to-transparent hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-lg hover:shadow-rose-500/10 transition-all group"
          >
            <span className="text-4xl group-hover:scale-110 transition-transform">
              🎴
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {t('presentation.tirages')}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 text-center">
              {t('presentation.tiragesSub')}
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
