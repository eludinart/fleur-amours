'use client'

import { useState, useEffect } from 'react'
import { billingApi } from '@/api/billing'

const EMPTY_FORM = {
  code: '',
  duration_days: '',
  max_uses: '',
  expires_at: '',
  note: '',
}

type PromoCode = {
  id: number
  code: string
  duration_days: number | null
  unlimited_duration?: boolean
  max_uses: number | null
  unlimited_uses?: boolean
  uses_count?: number
  expires_at: string | null
  note?: string
  is_expired?: boolean
  is_exhausted?: boolean
}

type Redemption = {
  id: number
  user_id: number
  promo_code: string
  redeemed_at: string
  free_until?: string
  unlimited?: boolean
  active?: boolean
}

function PromoStatusBadge({ code }: { code: PromoCode }) {
  if (code.is_expired) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">Expiré</span>
  if (code.is_exhausted) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400">Épuisé</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">Actif</span>
}

function formatDuration(code: PromoCode) {
  if (code.unlimited_duration) return <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Illimité</span>
  return `${code.duration_days} jour${(code.duration_days ?? 0) > 1 ? 's' : ''}`
}

function formatUses(code: PromoCode) {
  if (code.unlimited_uses) return <span>{(code.uses_count ?? 0)} / <span className="text-emerald-600 dark:text-emerald-400">∞</span></span>
  return `${code.uses_count ?? 0} / ${code.max_uses ?? 0}`
}

export default function AdminPromoPage() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'codes' | 'redemptions'>('codes')
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; id?: number } | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  function flash(text: string, type = 'success') {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  async function load() {
    setLoading(true)
    try {
      const [c, r] = await Promise.all([
        billingApi.listPromoCodes(),
        billingApi.listRedemptions({}),
      ])
      setCodes(Array.isArray(c) ? c : [])
      setRedemptions((r as { items?: Redemption[] })?.items ?? [])
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string }
      flash('Erreur lors du chargement : ' + (err?.message || err?.detail || 'Erreur'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setForm(EMPTY_FORM)
    setModal({ mode: 'create' })
  }

  function openEdit(code: PromoCode) {
    setForm({
      code: code.code,
      duration_days: code.duration_days !== null ? String(code.duration_days) : '',
      max_uses: code.max_uses !== null ? String(code.max_uses) : '',
      expires_at: code.expires_at ? code.expires_at.slice(0, 10) : '',
      note: code.note ?? '',
    })
    setModal({ mode: 'edit', id: code.id })
  }

  async function handleSave() {
    if (!form.code.trim()) { flash('Le code est requis.', 'error'); return }
    if (!modal) return
    setBusy(true)
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        duration_days: form.duration_days !== '' ? parseInt(form.duration_days, 10) : null,
        max_uses: form.max_uses !== '' ? parseInt(form.max_uses, 10) : null,
        expires_at: form.expires_at || null,
        note: form.note.trim(),
      }
      if (modal.mode === 'create') {
        await billingApi.createPromoCode(payload)
        flash('Code promo créé avec succès.')
      } else if (modal.id) {
        await billingApi.updatePromoCode({ id: modal.id, ...payload })
        flash('Code promo mis à jour.')
      }
      setModal(null)
      load()
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string }
      flash(err?.message || err?.detail || 'Erreur lors de la sauvegarde.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: number) {
    setBusy(true)
    try {
      await billingApi.deletePromoCode(id)
      setDeleteConfirm(null)
      flash('Code promo supprimé.')
      load()
    } catch (e: unknown) {
      const err = e as { message?: string; detail?: string }
      flash(err?.message || err?.detail || 'Erreur lors de la suppression.', 'error')
    } finally {
      setBusy(false)
    }
  }

  function f(field: keyof typeof form, val: string) { setForm((prev) => ({ ...prev, [field]: val })) }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">🎁 Codes Promo</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gérer les accès gratuits par code promo</p>
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-rose-500 text-white font-bold text-sm hover:opacity-90 transition-all"
          >
            + Nouveau code
          </button>
        </div>

        {msg && (
          <div className={`rounded-xl p-4 text-sm ${msg.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'}`}>
            {msg.text}
          </div>
        )}

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-0">
          {[['codes', `Codes (${codes.length})`], ['redemptions', `Utilisations (${redemptions.length})`]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as 'codes' | 'redemptions')}
              className={`px-4 py-2 text-sm font-medium rounded-t-xl transition-all ${tab === key ? 'bg-white dark:bg-slate-800 border border-b-0 border-slate-200 dark:border-slate-700 text-violet-600 dark:text-violet-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'codes' && (
          loading ? (
            <div className="text-center py-12 text-slate-400"><span className="w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin inline-block" /></div>
          ) : codes.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Aucun code promo. Créez le premier !</div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    {['Code', 'Durée', 'Utilisations', 'Expire', 'Statut', 'Note', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {codes.map((code) => (
                    <tr key={code.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-100">{code.code}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDuration(code)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatUses(code)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                        {code.expires_at ? new Date(code.expires_at).toLocaleDateString('fr-FR') : <span className="text-emerald-600 dark:text-emerald-400">Jamais</span>}
                      </td>
                      <td className="px-4 py-3"><PromoStatusBadge code={code} /></td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-[120px] truncate">{code.note || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(code)} className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            Modifier
                          </button>
                          <button onClick={() => setDeleteConfirm(code.id)} className="text-xs px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'redemptions' && (
          loading ? (
            <div className="text-center py-12 text-slate-400"><span className="w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin inline-block" /></div>
          ) : redemptions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Aucune utilisation de code promo.</div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    {["Utilisateur", "Code", "Activé le", "Accès gratuit jusqu'au", "Statut"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {redemptions.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">#{r.user_id}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800 dark:text-slate-100">{r.promo_code}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{new Date(r.redeemed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">
                        {r.unlimited ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Illimité</span> : r.free_until ? new Date(r.free_until).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.active
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">Actif</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">Expiré</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {modal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {modal.mode === 'create' ? '+ Nouveau code promo' : 'Modifier le code promo'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Code <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => f('code', e.target.value.toUpperCase())}
                    placeholder="Ex. BIENVENUE2025"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Durée (jours) <span className="text-slate-400 font-normal">— vide = illimité</span></label>
                  <input
                    type="number"
                    min={1}
                    value={form.duration_days}
                    onChange={(e) => f('duration_days', e.target.value)}
                    placeholder="Ex. 30, 90, 365 — vide pour illimité"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Max d&apos;utilisations <span className="text-slate-400 font-normal">— vide = illimité</span></label>
                  <input
                    type="number"
                    min={1}
                    value={form.max_uses}
                    onChange={(e) => f('max_uses', e.target.value)}
                    placeholder="Ex. 100 — vide pour illimité"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Date d&apos;expiration du code <span className="text-slate-400 font-normal">— vide = jamais</span></label>
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => f('expires_at', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Note (usage interne)</label>
                  <input
                    type="text"
                    value={form.note}
                    onChange={(e) => f('note', e.target.value)}
                    placeholder="Ex. Partenariat X, Presse, Bêta-testeurs…"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-rose-500 text-white font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-all"
                >
                  {busy ? 'Enregistrement…' : (modal.mode === 'create' ? 'Créer' : 'Enregistrer')}
                </button>
                <button
                  onClick={() => setModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteConfirm !== null && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm p-6 space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
              <div className="text-4xl">🗑️</div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">Supprimer ce code promo ?</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Les utilisations existantes seront aussi supprimées.</p>
              <div className="flex gap-2">
                <button onClick={() => handleDelete(deleteConfirm)} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-600 disabled:opacity-40 transition-colors">
                  {busy ? '…' : 'Supprimer'}
                </button>
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
