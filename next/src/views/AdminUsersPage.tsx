'use client'

import { useState, useEffect, useCallback } from 'react'
import { authApi } from '@/api/auth'
import { billingApi } from '@/api/billing'

const APP_ROLES = ['user', 'admin', 'coach'] as const

const ROLE_LABELS: Record<string, string> = {
  administrator: 'WP Admin',
  editor: 'Editeur',
  author: 'Auteur',
  contributor: 'Contributeur',
  subscriber: 'Abonne',
  admin: 'Admin App',
  coach: 'Coach',
  user: 'Utilisateur',
}

type Redemption = {
  id: number
  user_id: number
  promo_code: string
  redeemed_at: string
  free_until?: string
  unlimited?: boolean
  active?: boolean
  promo_note?: string
}

type PromoCode = { id: number; code: string }

type User = {
  id: number
  name?: string
  login?: string
  email?: string
  wp_role?: string
  app_role?: string
  last_login?: string
  registered?: string
  credits?: number
  token_balance?: number
  eternal_sap?: number
}

type UsageData = {
  usage?: Record<string, number> & { period?: string }
  limits?: Record<string, number>
  free_access?: boolean
  token_balance?: number
  eternal_sap?: number
}

function RoleBadge({ role, type = 'app' }: { role?: string; type?: string }) {
  const colors: Record<string, string> = {
    admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    administrator: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    coach: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    editor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    user: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    subscriber: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[role ?? 'user'] || colors.user}`}>
      {ROLE_LABELS[role ?? ''] || role}
    </span>
  )
}

function UserEditPanel({
  user,
  promoCodes,
  onRoleSaved,
  onClose,
}: {
  user: User
  promoCodes: PromoCode[]
  onRoleSaved: () => void
  onClose: () => void
}) {
  const [appRole, setAppRole] = useState(user.app_role || 'user')
  useEffect(() => {
    setAppRole(user.app_role || 'user')
  }, [user.app_role])
  const [roleSaving, setRoleSaving] = useState(false)
  const [roleMsg, setRoleMsg] = useState<{ text: string; type: string } | null>(null)
  const [redemptions, setRedemptions] = useState<Redemption[] | null>(null)
  const [redLoading, setRedLoading] = useState(true)
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [addMode, setAddMode] = useState<'code' | 'direct'>('code')
  const [addCode, setAddCode] = useState('')
  const [addFreeUntil, setAddFreeUntil] = useState('')
  const [addUnlimited, setAddUnlimited] = useState(false)
  const [addBusy, setAddBusy] = useState(false)
  const [addMsg, setAddMsg] = useState<{ text: string; type: string } | null>(null)
  const [creditTokens, setCreditTokens] = useState({
    chat_messages: '',
    sessions: '',
    tirages: '',
    fleur_submits: '',
  })
  const [creditBusy, setCreditBusy] = useState(false)
  const [creditMsg, setCreditMsg] = useState<{ text: string; type: string } | null>(null)
  const [creditSap, setCreditSap] = useState({ sablier: '', cristal: '' })
  const [creditSapBusy, setCreditSapBusy] = useState(false)
  const [creditSapMsg, setCreditSapMsg] = useState<{ text: string; type: string } | null>(null)

  function flash(
    set: (v: { text: string; type: string } | null) => void,
    text: string,
    type = 'success'
  ) {
    set({ text, type })
    setTimeout(() => set(null), 4000)
  }

  async function loadRedemptions() {
    setRedLoading(true)
    try {
      const [redsData, usage] = await Promise.all([
        billingApi.getUserRedemptions(user.id),
        billingApi.getUserUsage(user.id).catch(() => null),
      ])
      setRedemptions(Array.isArray(redsData) ? redsData : [])
      setUsageData(usage as UsageData | null)
    } catch {
      setRedemptions([])
    } finally {
      setRedLoading(false)
    }
  }

  useEffect(() => {
    loadRedemptions()
  }, [user.id])

  async function handleSaveRole() {
    setRoleSaving(true)
    try {
      await authApi.updateUser({ id: user.id, app_role: appRole })
      flash(setRoleMsg, 'Rôle enregistré.')
      onRoleSaved()
    } catch (e: unknown) {
      const err = e as { message?: string }
      flash(setRoleMsg, err?.message || 'Erreur.', 'error')
    } finally {
      setRoleSaving(false)
    }
  }

  async function handleAddAccess() {
    setAddBusy(true)
    try {
      const payload: Record<string, unknown> = { user_id: user.id }
      if (addMode === 'code') {
        if (!addCode.trim()) {
          flash(setAddMsg, 'Code requis.', 'error')
          setAddBusy(false)
          return
        }
        payload.code = addCode.trim().toUpperCase()
      } else {
        if (!addUnlimited && !addFreeUntil) {
          flash(setAddMsg, 'Date ou illimité requis.', 'error')
          setAddBusy(false)
          return
        }
        if (addUnlimited) payload.unlimited = true
        else payload.free_until = addFreeUntil + ' 23:59:59'
      }
      await billingApi.adminAssignAccess(payload)
      flash(setAddMsg, 'Accès ajouté.')
      setAddCode('')
      setAddFreeUntil('')
      setAddUnlimited(false)
      loadRedemptions()
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string }
      flash(setAddMsg, err?.message || err?.detail || 'Erreur.', 'error')
    } finally {
      setAddBusy(false)
    }
  }

  async function handleCreditTokens() {
    const credits = {
      chat_messages: parseInt(creditTokens.chat_messages, 10) || 0,
      sessions: parseInt(creditTokens.sessions, 10) || 0,
      tirages: parseInt(creditTokens.tirages, 10) || 0,
      fleur_submits: parseInt(creditTokens.fleur_submits, 10) || 0,
    }
    if (!credits.chat_messages && !credits.sessions && !credits.tirages && !credits.fleur_submits) {
      flash(setCreditMsg, 'Indiquez au moins un nombre de tokens à créditer.', 'error')
      return
    }
    setCreditBusy(true)
    try {
      await billingApi.adminCreditUsage(user.id, credits)
      flash(setCreditMsg, 'Tokens crédités.')
      setCreditTokens({ chat_messages: '', sessions: '', tirages: '', fleur_submits: '' })
      loadRedemptions()
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string }
      flash(setCreditMsg, err?.message || err?.detail || 'Erreur.', 'error')
    } finally {
      setCreditBusy(false)
    }
  }

  async function handleCreditSap() {
    const sablier = parseInt(creditSap.sablier, 10) || 0
    const cristal = parseInt(creditSap.cristal, 10) || 0
    if (!sablier && !cristal) {
      flash(
        setCreditSapMsg,
        "Indiquez au moins un nombre de Sève à créditer (Sablier ou Cristal).",
        'error'
      )
      return
    }
    setCreditSapBusy(true)
    try {
      const res = (await billingApi.adminCreditSap(user.id, { sablier, cristal })) as {
        ok?: boolean
        sap_wallet_sync_error?: string
        sap_credited?: number
      }
      if (res?.sap_wallet_sync_error) {
        flash(
          setCreditSapMsg,
          `Sablier/Cristal enregistrés. Wallet SAP non synchronisé : ${res.sap_wallet_sync_error}`,
          'error'
        )
      } else {
        flash(
          setCreditSapMsg,
          res?.sap_credited
            ? `Sève créditée (access + ${res.sap_credited} SAP). SapGauge / sessions alignés.`
            : 'Sève créditée. Les nouvelles fonctionnalités (SapGauge, sessions) sont maintenant actives.'
        )
      }
      setCreditSap({ sablier: '', cristal: '' })
      loadRedemptions()
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string }
      flash(setCreditSapMsg, err?.message || err?.detail || 'Erreur.', 'error')
    } finally {
      setCreditSapBusy(false)
    }
  }

  async function handleRemove(id: number) {
    try {
      await billingApi.removeRedemption(id)
      loadRedemptions()
    } catch (e: unknown) {
      const err = e as { message?: string }
      flash(setAddMsg, err?.message || 'Erreur lors de la suppression.', 'error')
    }
  }

  const activeRedemption = redemptions?.find((r) => r.active) ?? null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-md bg-white dark:bg-[#0f172a] shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 dark:border-slate-700"
        style={{ animation: 'slideLeft 0.25s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
              activeRedemption
                ? 'bg-gradient-to-br from-emerald-400 to-violet-500'
                : 'bg-gradient-to-br from-violet-400 to-rose-400'
            }`}
          >
            {(user.name || user.login || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
              {user.name || user.login}
            </p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
            {user.last_login && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Dernière connexion :{' '}
                {new Date(user.last_login).toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-lg"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Rôle
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>WP :</span>
              <RoleBadge role={user.wp_role} />
            </div>
            <div className="flex gap-2">
              <select
                value={appRole}
                onChange={(e) => setAppRole(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              >
                {APP_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r] || r}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveRole}
                disabled={roleSaving}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-rose-500 disabled:opacity-50 hover:opacity-90 transition-all"
              >
                {roleSaving ? '…' : 'Enregistrer'}
              </button>
            </div>
            {roleMsg && (
              <p
                className={`text-xs ${
                  roleMsg.type === 'error' ? 'text-rose-500' : 'text-emerald-600'
                }`}
              >
                {roleMsg.text}
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Accès & Codes promo
            </h3>
            {redLoading ? (
              <p className="text-xs text-slate-400 italic">Chargement…</p>
            ) : redemptions?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucun accès promo attribué.</p>
            ) : (
              <div className="space-y-2">
                {redemptions?.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border ${
                      r.active
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-mono font-bold text-xs ${
                            r.active ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'
                          }`}
                        >
                          {r.promo_code}
                        </span>
                        {r.active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 font-semibold">
                            Actif
                          </span>
                        )}
                        {!r.active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 font-semibold">
                            Expiré
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {r.unlimited
                          ? '✨ Illimité'
                          : `Jusqu'au ${new Date(r.free_until ?? '').toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}`}
                        {' · '}Ajouté le{' '}
                        {new Date(r.redeemed_at).toLocaleDateString('fr-FR')}
                        {r.promo_note ? ` · ${r.promo_note}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(r.id)}
                      className="shrink-0 text-[10px] px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Utilisation ce mois-ci
            </h3>
            {redLoading ? (
              <p className="text-xs text-slate-400 italic">Chargement…</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: 'Messages chat',
                    key: 'chat_messages_count',
                    limit: usageData?.limits?.chat_messages_per_month ?? 10,
                    icon: '💬',
                  },
                  {
                    label: 'Sessions',
                    key: 'sessions_count',
                    limit: usageData?.limits?.sessions_per_month ?? 2,
                    icon: '🌿',
                  },
                  {
                    label: 'Tirages',
                    key: 'tirages_count',
                    limit: usageData?.limits?.tirages_per_month ?? 5,
                    icon: '🎴',
                  },
                  {
                    label: 'Fleurs',
                    key: 'fleur_submits_count',
                    limit: usageData?.limits?.fleur_submits_per_month ?? 2,
                    icon: '🌸',
                  },
                ].map(({ label, key, limit, icon }) => {
                  const used = usageData?.usage?.[key] ?? 0
                  const isFree = usageData?.free_access
                  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
                  const over = limit && used >= limit && !isFree
                  return (
                    <div
                      key={key}
                      className={`rounded-xl p-3 border ${
                        over
                          ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {icon} {label}
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            over
                              ? 'text-rose-500'
                              : isFree
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isFree ? '∞' : limit ? `${used}/${limit}` : used}
                        </span>
                      </div>
                      {limit && !isFree && (
                        <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              over ? 'bg-rose-500' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {usageData?.usage?.period && (
              <p className="text-[10px] text-slate-400">
                Période : {usageData.usage.period}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Créditer des tokens gratuits
            </h3>
            <p className="text-[10px] text-slate-400">
              Réduit le compteur d&apos;utilisation pour redonner des tokens à l&apos;utilisateur ce
              mois-ci.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'chat_messages' as const, label: '💬 Messages chat', placeholder: '0' },
                { key: 'sessions' as const, label: '🌿 Sessions', placeholder: '0' },
                { key: 'tirages' as const, label: '🎴 Tirages', placeholder: '0' },
                { key: 'fleur_submits' as const, label: '🌸 Fleurs', placeholder: '0' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                    {label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={creditTokens[key]}
                    onChange={(e) =>
                      setCreditTokens((t) => ({ ...t, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                  />
                </div>
              ))}
            </div>
            {creditMsg && (
              <p
                className={`text-xs ${
                  creditMsg.type === 'error' ? 'text-rose-500' : 'text-emerald-600'
                }`}
              >
                {creditMsg.text}
              </p>
            )}
            <button
              onClick={handleCreditTokens}
              disabled={creditBusy}
              className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition-all"
            >
              {creditBusy ? 'En cours…' : 'Créditer les tokens'}
            </button>
          </section>

          <section className="rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-3">
            <h3 className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">
              Créditer de la Sève
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Active les nouvelles fonctionnalités : SapGauge, modale de confirmation, déductions
              open_door / draw_card / plan14j.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mb-2">
              <span>
                Solde actuel :{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {usageData?.token_balance ?? 0}
                </strong>{' '}
                Sablier
              </span>
              <span>·</span>
              <span>
                <strong className="text-amber-600 dark:text-amber-400">
                  {usageData?.eternal_sap ?? 0}
                </strong>{' '}
                Cristal
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                  Sablier (mensuel)
                </label>
                <input
                  type="number"
                  min={0}
                  value={creditSap.sablier}
                  onChange={(e) =>
                    setCreditSap((t) => ({ ...t, sablier: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                  Cristal (éternel)
                </label>
                <input
                  type="number"
                  min={0}
                  value={creditSap.cristal}
                  onChange={(e) =>
                    setCreditSap((t) => ({ ...t, cristal: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                />
              </div>
            </div>
            {creditSapMsg && (
              <p
                className={`text-xs ${
                  creditSapMsg.type === 'error' ? 'text-rose-500' : 'text-emerald-600'
                }`}
              >
                {creditSapMsg.text}
              </p>
            )}
            <button
              onClick={handleCreditSap}
              disabled={creditSapBusy}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-violet-500 to-rose-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {creditSapBusy ? 'En cours…' : 'Créditer la Sève'}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Attribuer un accès
            </h3>
            <div className="flex gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {(
                [
                  ['code', '🎁 Code promo'],
                  ['direct', '⚡ Accès direct'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setAddMode(mode)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    addMode === mode
                      ? 'bg-white dark:bg-slate-700 shadow text-violet-600 dark:text-violet-400'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {addMode === 'code' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Code promo
                  </label>
                  <div className="flex gap-2">
                    <input
                      list="promo-codes-list"
                      type="text"
                      value={addCode}
                      onChange={(e) => setAddCode(e.target.value.toUpperCase())}
                      placeholder="Ex. PARTENAIRE"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                    <datalist id="promo-codes-list">
                      {promoCodes.map((c) => (
                        <option key={c.id} value={c.code} />
                      ))}
                    </datalist>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    La durée et les conditions du code s&apos;appliquent automatiquement.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addUnlimited}
                    onChange={(e) => {
                      setAddUnlimited(e.target.checked)
                      if (e.target.checked) setAddFreeUntil('')
                    }}
                    className="w-4 h-4 accent-violet-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Accès illimité
                  </span>
                </label>
                {!addUnlimited && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Accès gratuit jusqu&apos;au
                    </label>
                    <input
                      type="date"
                      value={addFreeUntil}
                      onChange={(e) => setAddFreeUntil(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                  </div>
                )}
              </div>
            )}

            {addMsg && (
              <p
                className={`text-xs ${
                  addMsg.type === 'error' ? 'text-rose-500' : 'text-emerald-600'
                }`}
              >
                {addMsg.text}
              </p>
            )}

            <button
              onClick={handleAddAccess}
              disabled={addBusy}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-rose-500 text-white font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {addBusy ? "Enregistrement…" : "Attribuer l'accès"}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

function LastLoginBadge({ lastLogin }: { lastLogin?: string }) {
  if (!lastLogin) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 whitespace-nowrap">
        Jamais
      </span>
    )
  }
  const date = new Date(lastLogin)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  let colorClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  if (diffDays >= 30) colorClass = 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
  else if (diffDays >= 7)
    colorClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  const label = date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${colorClass}`}
      title={label}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" /> {label}
    </span>
  )
}

function TokensBadge({ user }: { user: User }) {
  const credits = user.credits ?? 0
  const sablier = user.token_balance ?? 0
  const cristal = user.eternal_sap ?? 0
  const hasCredits = credits > 0
  const hasSap = sablier > 0 || cristal > 0
  if (!hasCredits && !hasSap)
    return <span className="text-xs text-slate-400">—</span>
  const parts: string[] = []
  if (hasCredits) parts.push(`🪙 ${credits}`)
  if (hasSap) {
    const s = [sablier > 0 && `${sablier}S`, cristal > 0 && `${cristal}C`]
      .filter(Boolean)
      .join('/')
    parts.push(`🌿 ${s}`)
  }
  const fullTitle = [
    hasCredits && `${credits} crédits`,
    hasSap && `Sève : ${sablier} Sablier · ${cristal} Cristal`,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 whitespace-nowrap"
      title={fullTitle}
    >
      {parts.join(' · ')}
    </span>
  )
}

function AccessBadge({ redemption }: { redemption: Redemption | null }) {
  if (!redemption)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
        Freemium
      </span>
    )
  const unlimited = redemption.unlimited
  const active = redemption.active
  if (!active)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400">
        Expiré · {redemption.promo_code}
      </span>
    )
  if (unlimited)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
        ✨ Illimité
        {redemption.promo_code && redemption.promo_code !== '—'
          ? ` · ${redemption.promo_code}`
          : ''}
      </span>
    )
  const date = new Date(redemption.free_until ?? '').toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
      🎁{' '}
      {redemption.promo_code && redemption.promo_code !== '—'
        ? `${redemption.promo_code} · `
        : ''}
      {date}
    </span>
  )
}

type UsersResponse = {
  items?: User[]
  total?: number
  pages?: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UsersResponse | null>(null)
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [editing, setEditing] = useState<User | null>(null)
  const [impersonateLoading, setImpersonateLoading] = useState<number | null>(null)

  async function handleImpersonate(u: User) {
    if (impersonateLoading) return
    setImpersonateLoading(u.id)
    try {
      sessionStorage.setItem('impersonate_restore', localStorage.getItem('auth_token') || '')
      const res = (await authApi.impersonate(String(u.id))) as {
        token: string
        user: User
      }
      const { token, user: target } = res
      localStorage.setItem('auth_token', token)
      localStorage.setItem('auth_user', JSON.stringify(target))
      sessionStorage.setItem(
        'impersonating',
        target?.name || target?.login || target?.email || String(u.id)
      )
      const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin')
        .replace(/\/+$/, '')
        .trim() || '/'
      window.location.href = base || '/'
    } catch (err) {
      console.error('Impersonation failed:', err)
      setImpersonateLoading(null)
    }
  }

  const loadUsers = useCallback(async () => {
    try {
      const [data, redData, promoData] = await Promise.all([
        authApi.users({
          page,
          per_page: 20,
          search: search || undefined,
          role: roleFilter || undefined,
        }),
        billingApi.listRedemptions({ per_page: 500 }).catch(() => ({ items: [] })),
        billingApi.listPromoCodes().catch(() => []),
      ])
      setUsers(data as UsersResponse)
      setRedemptions((redData as { items?: Redemption[] })?.items ?? [])
      setPromoCodes(Array.isArray(promoData) ? promoData : [])
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }, [page, search, roleFilter])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (editing && users?.items) {
      const fresh = users.items.find((u) => u.id === editing.id)
      if (fresh && (fresh.app_role !== editing.app_role || fresh.wp_role !== editing.wp_role)) {
        setEditing(fresh)
      }
    }
  }, [users, editing?.id])

  function getRedemption(userId: number): Redemption | null {
    const userReds = redemptions.filter((r) => r.user_id === userId)
    const active = userReds.find((r) => r.active)
    if (active) return active
    return userReds[0] ?? null
  }

  const total = users?.total ?? 0
  const pages = users?.pages ?? 1

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
        Utilisateurs
      </h2>

      {users && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/40 dark:border-slate-700/60 p-4">
            <p className="text-2xl font-bold text-violet-600">{total}</p>
            <p className="text-xs text-slate-500">Utilisateurs total</p>
          </div>
          <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/40 dark:border-slate-700/60 p-4">
            <p className="text-2xl font-bold text-rose-500">
              {users.items?.filter(
                (u) => u.app_role === 'admin' || u.wp_role === 'administrator'
              ).length ?? 0}
            </p>
            <p className="text-xs text-slate-500">Administrateurs</p>
          </div>
          <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/40 dark:border-slate-700/60 p-4">
            <p className="text-2xl font-bold text-amber-500">
              {users.items?.filter((u) => u.app_role === 'coach').length ?? 0}
            </p>
            <p className="text-xs text-slate-500">Coachs</p>
          </div>
          <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/40 dark:border-slate-700/60 p-4">
            <p className="text-2xl font-bold text-emerald-500">
              {redemptions.filter((r) => r.active).length}
            </p>
            <p className="text-xs text-slate-500">Accès promo actifs</p>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-white/40 dark:border-slate-700/60 overflow-hidden">
        <div className="p-4 border-b border-slate-200/60 dark:border-slate-700/60 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Recherche</label>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Email, nom, identifiant..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            >
              <option value="">Tous</option>
              {APP_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm table-fixed">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-slate-700/60 text-left text-xs text-slate-500 uppercase">
                <th className="px-3 py-2.5">Utilisateur</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Role WP</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Role App</th>
                <th className="px-3 py-2.5">Accès</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Tokens</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Dernière conn.</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Inscrit le</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {!users && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Chargement...
                  </td>
                </tr>
              )}
              {users?.items?.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Aucun utilisateur
                  </td>
                </tr>
              )}
              {users?.items?.map((u) => {
                const redemption = getRedemption(u.id)
                return (
                  <tr
                    key={u.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 align-middle"
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                            redemption?.active
                              ? 'bg-gradient-to-br from-emerald-400 to-violet-500'
                              : 'bg-gradient-to-br from-violet-400 to-rose-400'
                          }`}
                        >
                          {(u.name || u.login || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {u.name || u.login}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{u.login}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 align-middle">
                      <span className="block truncate" title={u.email}>
                        {u.email}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                      <RoleBadge role={u.wp_role} type="wp" />
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                      <RoleBadge role={u.app_role} type="app" />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <AccessBadge redemption={redemption} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <TokensBadge user={u} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <LastLoginBadge lastLogin={u.last_login} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs align-middle whitespace-nowrap">
                      {u.registered
                        ? new Date(u.registered).toLocaleDateString('fr-FR')
                        : '-'}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleImpersonate(u)}
                          disabled={!!impersonateLoading}
                          className="px-2 py-1 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 transition-colors whitespace-nowrap text-left"
                          title="Voir le dashboard comme cet utilisateur"
                        >
                          {impersonateLoading === u.id ? '…' : 'Voir le dashboard'}
                        </button>
                        <button
                          onClick={() => setEditing(u)}
                          className="px-2 py-1 rounded-lg text-xs font-medium text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors whitespace-nowrap text-left"
                        >
                          Modifier
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200/60 dark:border-slate-700/60">
            <p className="text-xs text-slate-500">
              Page {page} / {pages} ({total} utilisateurs)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Prec.
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Suiv.
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <UserEditPanel
          user={editing}
          promoCodes={promoCodes}
          onRoleSaved={loadUsers}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
