import { useState } from 'react'
import { aiApi } from '@/api/ai'
import { parseLever } from '@/utils/levers'
import { FlowerSVG } from '@/components/FlowerSVG'
import { FOUR_DOORS } from '@/data/tarotCards'

type Card = { name: string; img?: string }
type DoorGroup = { key: string; group: Card[] }

function findCardByName(name: string): { door: string; card: Card } | null {
  if (!name) return null
  for (const door of FOUR_DOORS as DoorGroup[]) {
    const card = door.group.find(
      (c) => (c.name || '').toLowerCase() === (name || '').toLowerCase()
    )
    if (card) return { door: door.key, card }
  }
  return null
}

const PETAL_LABELS: Record<string, string> = {
  agape: 'Agape',
  philautia: 'Philautia',
  mania: 'Mania',
  storge: 'Storge',
  pragma: 'Pragma',
  philia: 'Philia',
  ludus: 'Ludus',
  eros: 'Eros',
}

const DOOR_LABELS: Record<string, string> = {
  love: 'Coeur',
  vegetal: 'Vegetal',
  elements: 'Elements',
  life: 'Histoire',
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatDate(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type ChatMsg = { role: string; content: string }

function ConversationViewer({ history }: { history: ChatMsg[] }) {
  if (!history || history.length === 0)
    return <p className="text-xs text-slate-400 italic">Aucun echange enregistre.</p>
  return (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
      {history.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-violet-500 text-white rounded-br-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-sm'
            }`}
          >
            <p className="whitespace-pre-line">{msg.content}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export type SessionForDetail = {
  id: string
  email?: string
  created_at?: string
  duration_seconds?: number
  turn_count?: number
  door_suggested?: string
  status?: string
  first_words?: string
  history?: ChatMsg[]
  petals?: Record<string, number>
  cards_drawn?: Array<{ card_name?: string; door?: string } | string>
  anchors?: Array<{
    door?: string
    subtitle?: string
    synthesis?: string
    paths_solutions?: string
    habit?: string
  }>
  plan14j?: {
    synthesis?: string
    synthesis_suggestion?: string
    levers?: string[]
    plan_14j?: Array<{
      day?: number
      theme?: string
      action?: string
      practice?: string
      micro_action?: string
    }>
  }
  step_data?: {
    threshold_snapshot?: {
      first_words?: string
      door_suggested?: string
      door_reason?: string
      first_question?: string
      card_group_hint?: string
      provider?: string
      cached_at?: string
    }
    coach_snapshot?: {
      coach_summary?: string
      coach_analysis?: string
      coach_suggestions?: string[]
      coach_conversation_prompts?: string[]
      coach_next_steps?: string[]
      provider?: string
      cached_at?: string
    }
    shadowEvents?: Array<{
      turn?: number
      level?: number
      urgent?: boolean
      door?: string
      resource_card?: string
      at?: string
    }>
    maxShadowLevel?: number
    petalsDeficit?: Record<string, number>
  }
}

export function SessionDetailModal({
  session,
  onClose,
  onRefresh,
}: {
  session: SessionForDetail
  onClose: () => void
  onRefresh?: (id: string) => Promise<void>
}) {
  const [tab, setTab] = useState('conversation')
  const [coachLoading, setCoachLoading] = useState(false)

  if (!session) return null

  const shadowEvents = session.step_data?.shadowEvents ?? []
  const maxShadowLevel = session.step_data?.maxShadowLevel ?? 0
  const hasShadow = shadowEvents.length > 0 || maxShadowLevel >= 1
  const petalsDeficit = session.step_data?.petalsDeficit || {}
  const coachSnapshot = (session.step_data as any)?.coach_snapshot ?? null

  async function handleGenerateCoach(force = false) {
    if (coachLoading) return
    setCoachLoading(true)
    try {
      await aiApi.coachFiche({ sessionId: session.id, force })
      if (onRefresh) await onRefresh(String(session.id))
    } catch {
      /* ignore (UI best-effort) */
    } finally {
      setCoachLoading(false)
    }
  }

  const tabs = [
    { id: 'conversation', label: 'Echanges' },
    { id: 'flower', label: 'Fleur' },
    { id: 'anchors', label: 'Ancres' },
    { id: 'plan', label: 'Plan 14j' },
    { id: 'coach', label: 'Coach (session)' },
    ...(hasShadow
      ? [{ id: 'shadows' as const, label: `🌑 Ombres (${shadowEvents.length})` }]
      : []),
  ]

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-start justify-center pt-8 px-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between z-10 rounded-t-2xl">
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
              {session.email || 'Session anonyme'}
            </h3>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
              <span>{formatDate(session.created_at)}</span>
              <span>{formatDuration(session.duration_seconds)}</span>
              <span>{session.turn_count} tours</span>
              {session.door_suggested && (
                <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 font-medium">
                  {DOOR_LABELS[session.door_suggested] || session.door_suggested}
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded-full font-medium ${
                  session.status === 'completed'
                    ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300'
                }`}
              >
                {session.status === 'completed' ? 'Terminée' : 'En cours'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            x
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-slate-100 dark:border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                tab === t.id
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'conversation' && (
            <div className="space-y-4">
              {session.first_words && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 p-3">
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">
                    Premiers mots
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 italic">
                    {session.first_words}
                  </p>
                </div>
              )}
              {session.step_data?.threshold_snapshot && (
                <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/15 p-3 space-y-2">
                  <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">
                    Analyse seuil (cache DB — pas de rappel IA)
                  </p>
                  {session.step_data.threshold_snapshot.door_reason && (
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                      {session.step_data.threshold_snapshot.door_reason}
                    </p>
                  )}
                  {session.step_data.threshold_snapshot.first_question && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      1re question : « {session.step_data.threshold_snapshot.first_question} »
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                    {session.step_data.threshold_snapshot.provider && (
                      <span>Source : {session.step_data.threshold_snapshot.provider}</span>
                    )}
                    {session.step_data.threshold_snapshot.cached_at && (
                      <span>Enregistré : {formatDate(session.step_data.threshold_snapshot.cached_at)}</span>
                    )}
                  </div>
                </div>
              )}
              <ConversationViewer history={session.history || []} />
            </div>
          )}

          {tab === 'flower' && (() => {
            const petals = session.petals || {}
            const petalsDeficitData = petalsDeficit
            const hasPetals = Object.values(petals).some((v) => v > 0)
            const hasDeficit = Object.values(petalsDeficitData).some((v) => v > 0.05)
            const drawnCards = (session.cards_drawn || [])
              .map((item) => {
                const name =
                  typeof item === 'object' && item && 'card_name' in item
                    ? (item as { card_name?: string }).card_name
                    : String(item)
                const found = name ? findCardByName(name) : null
                if (!found) return null
                const door =
                  typeof item === 'object' && item && 'door' in item
                    ? (item as { door?: string }).door
                    : found.door
                return { door: door ?? found.door, card: found.card }
              })
              .filter(Boolean) as { door: string; card: Card }[]

            return (
              <div className="space-y-6">
                {hasPetals ? (
                  <div className="flex flex-col items-center gap-3">
                    <FlowerSVG
                      petals={petals}
                      petalsDeficit={petalsDeficitData}
                      size={260}
                      animate
                      showLabels
                    />
                    {hasDeficit && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Dynamiques actives
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          Déficits
                        </span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic text-center">
                    Aucune donnée de fleur.
                  </p>
                )}

                {hasPetals && (
                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800">
                          <th className="px-3 py-2 text-left text-[10px] text-slate-400 uppercase tracking-widest">
                            Dynamique
                          </th>
                          <th className="px-3 py-2 text-center text-[10px] text-emerald-500 uppercase tracking-widest">
                            Actif
                          </th>
                          <th className="px-3 py-2 text-center text-[10px] text-amber-400 uppercase tracking-widest">
                            Déficit
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(petals).map((k) => (
                          <tr
                            key={k}
                            className="border-t border-slate-100 dark:border-slate-800"
                          >
                            <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                              {PETAL_LABELS[k] || k}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="h-1.5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-400 rounded-full"
                                    style={{
                                      width: `${Math.min((petals[k] || 0) * 333, 100)}%`,
                                    }}
                                  />
                                </div>
                                <span className="font-mono text-slate-500 w-7 text-right">
                                  {(petals[k] || 0).toFixed(2)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {(petalsDeficitData[k] || 0) > 0.01 ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="h-1.5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-amber-400 rounded-full"
                                      style={{
                                        width: `${Math.min((petalsDeficitData[k] || 0) * 333, 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="font-mono text-slate-500 w-7 text-right">
                                    {(petalsDeficitData[k] || 0).toFixed(2)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {drawnCards.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-3">
                      Cartes tirées
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {drawnCards.map((d, i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                          <div className="w-20 h-28 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shadow-sm">
                            {d.card?.img ? (
                              <img
                                src={d.card.img}
                                alt={d.card.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  ;(e.target as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              <span className="text-[9px] text-slate-500 text-center px-1">
                                {d.card?.name}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-medium text-slate-700 dark:text-slate-300 text-center leading-tight">
                            {d.card?.name}
                          </p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-wide">
                            {DOOR_LABELS[d.door] || d.door}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {tab === 'anchors' && (
            <div className="space-y-3">
              {(session.anchors || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic">Aucune ancre enregistree.</p>
              ) : (
                session.anchors?.map((a, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10 p-4 space-y-1"
                  >
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                      {DOOR_LABELS[a.door ?? ''] || a.subtitle || a.door}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 italic">
                      &quot;{a.synthesis}&quot;
                    </p>
                    {a.paths_solutions && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">
                        {a.paths_solutions}
                      </p>
                    )}
                    {a.habit && (
                      <p className="text-xs text-slate-400">Habitude : {a.habit}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'plan' && (
            <div className="space-y-5">
              {!session.plan14j ? (
                <p className="text-xs text-slate-400 italic">
                  Plan non genere pour cette session.
                </p>
              ) : (
                <>
                  {(session.plan14j.synthesis || session.plan14j.synthesis_suggestion) && (
                    <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/10 p-4">
                      <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">
                        Synthèse
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">
                        {session.plan14j.synthesis || session.plan14j.synthesis_suggestion}
                      </p>
                    </div>
                  )}

                  {(session.plan14j.levers?.length ?? 0) > 0 && (
                    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10 p-4 space-y-3">
                      <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">
                        Leviers
                      </p>
                      {session.plan14j.levers?.map((l, i) => {
                        const { action, anchor } = parseLever(l)
                        return (
                          <div key={i} className="flex gap-3 items-start">
                            <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                {action}
                              </p>
                              {anchor && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                  🔗 À ancrer après : {anchor}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {(session.plan14j.plan_14j?.length ?? 0) > 0 && (
                    <div className="space-y-4">
                      {[0, 1].map((w) => (
                        <div key={w}>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Semaine {w + 1}
                          </p>
                          <div className="space-y-1.5">
                            {session.plan14j!.plan_14j!.slice(w * 7, w * 7 + 7).map((day, idx) => (
                              <div
                                key={day.day ?? idx}
                                className="flex gap-3 items-start p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                              >
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                                  <span className="text-[11px] font-bold text-violet-600 dark:text-violet-300">
                                    J{day.day ?? w * 7 + idx + 1}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {day.theme || '—'}
                                  </p>
                                  {day.action && (
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                                      {day.action}
                                    </p>
                                  )}
                                  {day.practice && (
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                      🌿 {day.practice}
                                    </p>
                                  )}
                                  {day.micro_action && (
                                    <p className="text-xs text-violet-500 dark:text-violet-400 mt-1">
                                      ✦ {day.micro_action}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'coach' && (
            <div className="space-y-4">
              {!coachSnapshot ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 p-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                    Fiche coach (session) non générée.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Cliquez sur « Générer » pour créer un résumé, une analyse et des suggestions pour l’accompagnement (par session).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coachSnapshot.coach_summary && (
                    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10 p-4">
                      <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-1.5">
                        Résumé coach
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                        {String(coachSnapshot.coach_summary)}
                      </p>
                    </div>
                  )}

                  {coachSnapshot.coach_analysis && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10 p-4">
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1.5">
                        Analyse (pour le coach)
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                        {String(coachSnapshot.coach_analysis)}
                      </p>
                    </div>
                  )}

                  {Array.isArray(coachSnapshot.coach_suggestions) && coachSnapshot.coach_suggestions.length > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                        Suggestions d’accompagnement
                      </p>
                      <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 list-disc pl-5">
                        {coachSnapshot.coach_suggestions.slice(0, 10).map((s: any, i: number) => (
                          <li key={i}>{String(s)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 items-center flex-wrap">
                <button
                  onClick={() => handleGenerateCoach(true)}
                  disabled={coachLoading || !session?.id}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 shadow-md hover:opacity-90 disabled:opacity-50"
                >
                  {coachLoading
                    ? 'Génération…'
                    : coachSnapshot
                      ? 'Régénérer la fiche coach'
                      : 'Générer la fiche coach'}
                </button>
                {coachSnapshot?.cached_at && (
                  <span className="text-xs text-slate-400">
                    Enregistré le {formatDate(String(coachSnapshot.cached_at))}
                  </span>
                )}
              </div>
            </div>
          )}

          {tab === 'shadows' && (
            <div className="space-y-4">
              <div
                className={`rounded-xl p-4 border ${
                  maxShadowLevel >= 4
                    ? 'bg-red-950/30 border-red-700'
                    : maxShadowLevel >= 3
                      ? 'bg-rose-950/20 border-rose-700/50'
                      : maxShadowLevel >= 2
                        ? 'bg-orange-950/20 border-orange-700/40'
                        : 'bg-amber-950/10 border-amber-700/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {maxShadowLevel >= 4
                      ? '🔴'
                      : maxShadowLevel >= 3
                        ? '🌑'
                        : maxShadowLevel >= 2
                          ? '🌘'
                          : '🌗'}
                  </span>
                  <div>
                    <p
                      className={`font-bold text-sm ${
                        maxShadowLevel >= 4
                          ? 'text-red-300'
                          : maxShadowLevel >= 3
                            ? 'text-rose-300'
                            : maxShadowLevel >= 2
                              ? 'text-orange-300'
                              : 'text-amber-300'
                      }`}
                    >
                      Niveau d&apos;ombre maximum : {maxShadowLevel}/4
                      {maxShadowLevel >= 4 && ' — Situation de détresse'}
                      {maxShadowLevel === 3 && ' — Ombre forte'}
                      {maxShadowLevel === 2 && ' — Tension notable'}
                      {maxShadowLevel === 1 && ' — Légère ombre'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {shadowEvents.length} détection{shadowEvents.length > 1 ? 's' : ''} au cours de la session
                    </p>
                  </div>
                </div>
              </div>

              {shadowEvents.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Chronologie des détections
                  </p>
                  {shadowEvents.map((ev, i) => {
                    const lvl = ev.level ?? 0
                    const color =
                      lvl >= 4
                        ? 'border-red-700/60 bg-red-950/20 text-red-300'
                        : lvl >= 3
                          ? 'border-rose-700/50 bg-rose-950/20 text-rose-300'
                          : lvl >= 2
                            ? 'border-orange-700/40 bg-orange-950/20 text-orange-300'
                            : 'border-amber-700/30 bg-amber-950/10 text-amber-300'
                    const icon = lvl >= 4 ? '🔴' : lvl >= 3 ? '🌑' : lvl >= 2 ? '🌘' : '🌗'
                    return (
                      <div key={i} className={`rounded-xl border p-3 ${color}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{icon}</span>
                          <span className="font-semibold text-xs">
                            Tour {ev.turn} — Niveau {lvl}
                          </span>
                          {ev.urgent && (
                            <span className="ml-1 text-[10px] font-bold bg-red-700/40 px-1.5 rounded">
                              URGENT
                            </span>
                          )}
                          {ev.door && (
                            <span className="ml-auto text-[10px] text-slate-400 uppercase">
                              {DOOR_LABELS[ev.door] || ev.door}
                            </span>
                          )}
                        </div>
                        {ev.resource_card && (
                          <p className="text-xs mt-1">
                            Ressource suggérée : <span className="font-semibold">{ev.resource_card}</span>
                          </p>
                        )}
                        {ev.at && (
                          <p className="text-[10px] text-slate-500 mt-1">
                            {new Date(ev.at).toLocaleString('fr-FR')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Aucun événement d&apos;ombre enregistré.</p>
              )}

              <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10 p-4">
                <p className="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-1.5">
                  Note accompagnateur
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Ces détections signalent des zones de vulnérabilité ou de tension exprimées au cours de la session. Un contact bienveillant peut être pertinent pour proposer un accompagnement adapté.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

