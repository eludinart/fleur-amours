// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { contactApi } from '@/api/contact'
import { chatApi } from '@/api/chat'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

function StatCard({ label, value, sub, to, icon, color }: { label: string; value?: number; sub?: string; to?: string; icon: string; color: string }) {
  const content = (
    <div
      className={`rounded-2xl border p-5 transition-all hover:shadow-lg ${
        color === 'violet'
          ? 'border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 hover:border-violet-300 dark:hover:border-violet-700'
          : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 hover:border-rose-300 dark:hover:border-rose-700'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value ?? '—'}</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
        </div>
        <span className="text-2xl opacity-70">{icon}</span>
      </div>
      {to ? (
        <span className="mt-3 inline-block text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">
          Voir les détails →
        </span>
      ) : null}
    </div>
  )
  if (to) return <Link href={to} className="block">{content}</Link>
  return content
}

function ShortcutCard({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <Link
      href={to}
      className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:border-violet-300 dark:hover:border-violet-700 transition-all"
    >
      <span className="text-2xl">{icon}</span>
      <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <span className="ml-auto text-slate-400">→</span>
    </Link>
  )
}

export default function CoachDashboardPage() {
  const [msgStats, setMsgStats] = useState<{ total?: number; unread?: number } | null>(null)
  const [chatStats, setChatStats] = useState<{ total?: number; open?: number; unread_messages?: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([contactApi.stats().catch(() => null), chatApi.stats().catch(() => null)]).then(([msgs, chat]) => {
      setMsgStats(msgs)
      setChatStats(chat)
      setLoading(false)
    })
  }, [])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" style={{ animation: 'fadeIn 0.5s ease' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-rose-500 bg-clip-text text-transparent">Dashboard Coach</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Suivi des utilisateurs et conversations</p>
          </div>
          <Link
            href="/admin/suivi"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md"
          >
            🌸 Suivi des utilisateurs
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {(msgStats?.unread ?? 0) > 0 || (chatStats?.unread_messages ?? 0) > 0 ? (
              <section className="flex flex-col sm:flex-row gap-3">
                {(msgStats?.unread ?? 0) > 0 && (
                  <Link
                    href="/admin/messages"
                    className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                    <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                      {msgStats!.unread!} message{msgStats!.unread! > 1 ? 's' : ''} non lu{msgStats!.unread! > 1 ? 's' : ''}
                    </span>
                    <span className="ml-auto text-rose-400 text-xs">Voir →</span>
                  </Link>
                )}
                {(chatStats?.unread_messages ?? 0) > 0 && (
                  <Link
                    href="/admin/chat"
                    className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      {chatStats!.unread_messages!} message{chatStats!.unread_messages! > 1 ? 's' : ''} de chat non lu{chatStats!.unread_messages! > 1 ? 's' : ''}
                      {(chatStats?.open ?? 0) > 0 && (
                        <span className="ml-1 font-normal opacity-70">
                          · {chatStats!.open} conversation{(chatStats!.open ?? 0) > 1 ? 's' : ''} ouverte{(chatStats!.open ?? 0) > 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                    <span className="ml-auto text-amber-400 text-xs">Répondre →</span>
                  </Link>
                )}
              </section>
            ) : null}

            <section>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Vue d&apos;ensemble</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard
                  label="Messages"
                  value={msgStats?.total ?? 0}
                  sub={(msgStats?.unread ?? 0) > 0 ? `${msgStats!.unread} non lu${msgStats!.unread! > 1 ? 's' : ''}` : "Demandes d'accompagnement"}
                  to="/admin/messages"
                  icon="✉️"
                  color="rose"
                />
                <StatCard
                  label="Conversations chat"
                  value={chatStats?.total ?? 0}
                  sub={
                    chatStats
                      ? `${chatStats.open ?? 0} ouverte${(chatStats.open ?? 0) > 1 ? 's' : ''} · ${chatStats.unread_messages ?? 0} msg non lu${(chatStats.unread_messages ?? 0) > 1 ? 's' : ''}`
                      : undefined
                  }
                  to="/admin/chat"
                  icon="💬"
                  color="violet"
                />
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">Raccourcis</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ShortcutCard to="/coach/analytics" label="Vue globale" icon="📊" />
                <ShortcutCard to="/coach/suivi" label="Suivi individuel" icon="🌸" />
                <ShortcutCard to="/coach/messages" label="Messages" icon="✉️" />
                <ShortcutCard to="/coach/chat" label="Chat" icon="💬" />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
