'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { authApi } from '@/api/auth'
import { billingApi } from '@/api/billing'
import { prairieApi } from '@/api/prairie'
import { useStore } from '@/store/useStore'
import { SUPPORTED_LOCALES, t } from '@/i18n'
import { PrairieOptInModal } from '@/components/PrairieOptInModal'
import { INTENTIONS, socialApi } from '@/api/social'
import { toast } from '@/hooks/useToast'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

type Access = {
  has_subscription?: boolean
  subscription?: { current_period_end?: string; plan_id?: string }
  free_access?: boolean
  unlimited?: boolean
  free_until?: string
  token_balance?: number
  eternal_sap?: number
  total_accumulated_eternal?: number
  usage?: Record<string, number>
  limits?: Record<string, number>
  credits?: number
}

function AccessBadge({ access }: { access: Access | null }) {
  if (!access) return null
  if (access.has_subscription) {
    const end = access.subscription?.current_period_end
    const date = end
      ? new Date(end).toLocaleDateString(undefined, {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : null
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
        {date
          ? t('account.subscriptionActiveBadgeUntil').replace('{date}', date)
          : t('account.subscriptionActiveBadge')}
      </span>
    )
  }
  if (access.free_access && access.unlimited) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
        ✨ {t('account.unlimited')}
      </span>
    )
  }
  if (access.free_access && access.free_until) {
    const date = new Date(access.free_until).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
        🎁 {t('account.freeUntil').replace('{date}', date)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
      {t('account.limited')}
    </span>
  )
}

function UsageBar({
  label,
  used,
  limit,
  color = 'violet',
}: {
  label: string
  used: number
  limit: number
  color?: 'violet' | 'rose' | 'amber' | 'emerald'
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const colorMap = {
    violet: 'bg-violet-500',
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  }
  const textColor = {
    violet: 'text-violet-600 dark:text-violet-400',
    rose: 'text-rose-600 dark:text-rose-400',
    amber: 'text-amber-600 dark:text-amber-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
  }
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
        <span className={`text-xs font-semibold ${textColor[color]}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorMap[color]} transition-all rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const FLOWER_EMOJIS = [
  '🌸',
  '🌺',
  '🌻',
  '🌷',
  '🌹',
  '💐',
  '🪷',
  '🪻',
  '🌼',
  '🏵️',
  '🌿',
  '🍀',
  '🥀',
  '💮',
  '🌾',
]

function resizeImageToDataUrl(
  file: File,
  maxSize = 150,
  maxBytes = 95000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let w = img.width
      let h = img.height
      if (w > maxSize || h > maxSize) {
        if (w > h) {
          h = Math.round((h * maxSize) / w)
          w = maxSize
        } else {
          w = Math.round((w * maxSize) / h)
          h = maxSize
        }
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      let quality = 0.85
      let dataUrl = canvas.toDataURL('image/jpeg', quality)
      while (dataUrl.length > maxBytes && quality > 0.2) {
        quality -= 0.1
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }
      resolve(dataUrl)
    }
    img.onerror = () => reject(new Error('Invalid image'))
    img.src = URL.createObjectURL(file)
  })
}

function insertInTextarea(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (next: string) => void,
  template: string,
  maxLen: number
) {
  const el = ref.current
  if (!el) {
    onChange((value + template).slice(0, maxLen))
    return
  }
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  const next = (value.slice(0, start) + template + value.slice(end)).slice(0, maxLen)
  onChange(next)
  requestAnimationFrame(() => {
    const pos = Math.min(start + template.length, next.length)
    el.focus()
    el.setSelectionRange(pos, pos)
  })
}

function RichTextToolbar({
  onInsert,
}: {
  onInsert: (template: string) => void
}) {
  const btn = 'text-[11px] px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200'
  return (
    <div className="flex flex-wrap gap-1.5 mb-1.5">
      <button type="button" onClick={() => onInsert('**texte en gras**')} className={btn}><strong>B</strong></button>
      <button type="button" onClick={() => onInsert('*texte en italique*')} className={btn}><em>I</em></button>
      <button type="button" onClick={() => onInsert('\n- point 1\n- point 2')} className={btn}>Liste</button>
      <button type="button" onClick={() => onInsert('\n\nTitre:\n')} className={btn}>Titre</button>
      <button type="button" onClick={() => onInsert('\n\nExemple concret: ')} className={btn}>Exemple</button>
      <button type="button" onClick={() => onInsert('\n\nResultat attendu: ')} className={btn}>Resultat</button>
    </div>
  )
}

function coachCompletionScore(form: {
  coach_headline: string
  coach_short_bio: string
  coach_long_bio: string
  coach_specialties: string
  coach_languages: string
  coach_response_time_label: string
}) {
  let score = 0
  if (form.coach_headline.trim().length >= 20) score += 1
  if (form.coach_short_bio.trim().length >= 80) score += 1
  if (form.coach_long_bio.trim().length >= 200) score += 1
  if (form.coach_specialties.split(',').map((s) => s.trim()).filter(Boolean).length >= 2) score += 1
  if (form.coach_languages.split(',').map((s) => s.trim()).filter(Boolean).length >= 1) score += 1
  if (form.coach_response_time_label.trim().length >= 8) score += 1
  return score
}

export function AccountPage() {
  const { user, logout, refreshUser, isAdmin, isCoach } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fontSizePreference = useStore((s) => s.fontSizePreference)
  const setFontSizePreference = useStore((s) => s.setFontSizePreference)
  const locale = useStore((s) => s.locale)
  const setLocale = useStore((s) => s.setLocale)
  const [access, setAccess] = useState<Access | null>(null)
  const [products, setProducts] = useState<Array<{ id: string; label: string; amount_cents?: number; price_id?: string; unit?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoSuccess, setPromoSuccess] = useState<{ unlimited?: boolean; free_until?: string } | null>(null)
  const [promoError, setPromoError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState(1)
  const [deleteTyped, setDeleteTyped] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [profileForm, setProfileForm] = useState({
    name: '',
    pseudo: '',
    bio: '',
    avatar: null as string | null,
    avatar_emoji: null as string | null,
    profile_public: false,
    coach_headline: '',
    coach_short_bio: '',
    coach_long_bio: '',
    coach_specialties: '',
    coach_languages: '',
    coach_response_time_label: 'Repond sous 24h',
    coach_response_time_hours: 24,
    coach_is_listed: true,
    coach_years_experience: 0,
    coach_reviews_label: '',
    coach_verified: false,
  })
  const [prairieOptInModalOpen, setPrairieOptInModalOpen] = useState(false)
  const [prairieOptInSaving, setPrairieOptInSaving] = useState(false)
  const [prairieResyncLoading, setPrairieResyncLoading] = useState(false)
  const [prairieVisibility, setPrairieVisibility] = useState<boolean | null>(null)
  const [forceVisibleLoading, setForceVisibleLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileTab, setProfileTab] = useState<'user' | 'coach' | 'admin'>('user')
  const [pendingSeeds, setPendingSeeds] = useState<Array<{ id: number; from_user_id: number; intention_id: string; created_at: string | null }>>([])
  const [pendingSeedsLoading, setPendingSeedsLoading] = useState(false)
  const [pendingBusyId, setPendingBusyId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coachShortBioRef = useRef<HTMLTextAreaElement>(null)
  const coachLongBioRef = useRef<HTMLTextAreaElement>(null)
  const hasCoachTab = isCoach || isAdmin
  const coachScore = coachCompletionScore(profileForm)

  useEffect(() => {
    if (profileTab === 'coach' && !hasCoachTab) setProfileTab('user')
    if (profileTab === 'admin' && !isAdmin) setProfileTab('user')
  }, [profileTab, hasCoachTab, isAdmin])

  useEffect(() => {
    if (!user?.id) return
    const intentionIds = INTENTIONS.map((i) => i.id).join(',')
    setPendingSeedsLoading(true)
    socialApi
      .pendingSeedsIncoming({ intention_ids: intentionIds, limit: 50 })
      .then((r) => {
        const items = (r as { items?: any[] })?.items ?? []
        setPendingSeeds(
          Array.isArray(items)
            ? items.map((s) => ({
                id: Number(s.id),
                from_user_id: Number(s.from_user_id),
                intention_id: String(s.intention_id ?? ''),
                created_at: s.created_at ? String(s.created_at) : null,
              }))
            : []
        )
      })
      .catch(() => setPendingSeeds([]))
      .finally(() => setPendingSeedsLoading(false))
  }, [user?.id])

  async function acceptPendingSeed(seedId: number) {
    if (pendingBusyId) return
    setPendingBusyId(seedId)
    try {
      const res = (await socialApi.acceptConnection(String(seedId))) as { channelId?: number }
      toast('Demande acceptée.', 'success')
      setPendingSeeds((prev) => prev.filter((s) => s.id !== seedId))
      if (res?.channelId) {
        // Ne force pas la navigation, mais laisse un accès rapide via la Clairière.
        // Le bouton "Ouvrir la Clairière" est disponible dans la navigation latérale.
      }
    } catch (e: unknown) {
      const ex = e as { detail?: string; message?: string }
      toast(ex?.detail || ex?.message || "Impossible d'accepter.", 'error')
    } finally {
      setPendingBusyId(null)
    }
  }

  async function rejectPendingSeed(seedId: number) {
    if (pendingBusyId) return
    setPendingBusyId(seedId)
    try {
      await socialApi.rejectConnection(String(seedId))
      toast('Demande refusée.', 'success')
      setPendingSeeds((prev) => prev.filter((s) => s.id !== seedId))
    } catch (e: unknown) {
      const ex = e as { detail?: string; message?: string }
      toast(ex?.detail || ex?.message || 'Impossible de refuser.', 'error')
    } finally {
      setPendingBusyId(null)
    }
  }

  useEffect(() => {
    billingApi
      .getAccess()
      .then((a) => setAccess(a as Access))
      .catch(() => setAccess(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    authApi
      .getMyProfile()
      .then((p) => {
        const prof = p as Record<string, unknown>
        setProfile(prof)
        setProfileForm({
          name: (prof?.name ?? user?.name ?? '') as string,
          pseudo: (prof?.pseudo ?? '') as string,
          bio: (prof?.bio ?? '') as string,
          avatar: (prof?.avatar ?? null) as string | null,
          avatar_emoji: (prof?.avatar_emoji ?? null) as string | null,
          profile_public: (prof?.profile_public ?? false) as boolean,
          coach_headline: (prof?.coach_headline ?? '') as string,
          coach_short_bio: (prof?.coach_short_bio ?? '') as string,
          coach_long_bio: (prof?.coach_long_bio ?? '') as string,
          coach_specialties: Array.isArray(prof?.coach_specialties)
            ? (prof?.coach_specialties as string[]).join(', ')
            : '',
          coach_languages: Array.isArray(prof?.coach_languages)
            ? (prof?.coach_languages as string[]).join(', ')
            : 'fr-FR',
          coach_response_time_label: ((prof?.coach_response_time_label ?? 'Repond sous 24h') as string),
          coach_response_time_hours: Number(prof?.coach_response_time_hours ?? 24),
          coach_is_listed: (prof?.coach_is_listed ?? true) as boolean,
          coach_years_experience: Number(prof?.coach_years_experience ?? 0),
          coach_reviews_label: (prof?.coach_reviews_label ?? '') as string,
          coach_verified: (prof?.coach_verified ?? false) as boolean,
        })
      })
      .catch(() => {
        setProfile(null)
        setProfileForm((f) => ({ ...f, name: (user?.name ?? '') as string }))
      })
  }, [user?.id, user?.name])

  async function handleProfileSave(e?: React.FormEvent) {
    e?.preventDefault()
    setProfileSaving(true)
    setProfileError('')
    setProfileSuccess(false)
    try {
      if ((isCoach || isAdmin) && profileTab === 'coach') {
        if (!profileForm.coach_headline.trim() || !profileForm.coach_short_bio.trim()) {
          throw new Error('Veuillez renseigner au minimum le titre et la presentation courte du coach.')
        }
      }
      const updated = await authApi.updateMyProfile({
        name: profileForm.name,
        pseudo: profileForm.pseudo || null,
        bio: profileForm.bio || null,
        avatar: profileForm.avatar || null,
        avatar_emoji: profileForm.avatar_emoji || null,
        coach_headline: profileForm.coach_headline || null,
        coach_short_bio: profileForm.coach_short_bio || null,
        coach_long_bio: profileForm.coach_long_bio || null,
        coach_specialties: profileForm.coach_specialties
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        coach_languages: profileForm.coach_languages
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        coach_response_time_label: profileForm.coach_response_time_label || null,
        coach_response_time_hours: profileForm.coach_response_time_hours || 24,
        coach_is_listed: !!profileForm.coach_is_listed,
        coach_years_experience: profileForm.coach_years_experience || 0,
        coach_reviews_label: profileForm.coach_reviews_label || null,
        coach_verified: !!profileForm.coach_verified,
      })
      setProfile(updated as Record<string, unknown>)
      await refreshUser()
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      setProfileError((err as Error)?.message || t('account.profileError'))
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e?.target?.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      setProfileForm((f) => ({ ...f, avatar: dataUrl }))
    } catch {
      setProfileError(t('account.profileError'))
    }
    e.target.value = ''
  }

  function handleRemovePhoto() {
    setProfileForm((f) => ({ ...f, avatar: null }))
  }

  function handleSelectEmoji(emoji: string) {
    setProfileForm((f) => ({
      ...f,
      avatar_emoji: f.avatar_emoji === emoji ? null : emoji,
    }))
  }

  useEffect(() => {
    billingApi
      .getProducts()
      .then((r) => setProducts((r as { products?: typeof products })?.products || []))
      .catch(() => setProducts([]))
  }, [])

  useEffect(() => {
    const q = searchParams.get('checkout')
    if (q === 'success') {
      router.replace(pathname || '/account')
      billingApi.getAccess().then((a) => setAccess(a as Access)).catch(() => {})
    }
    if (q === 'canceled') router.replace(pathname || '/account')
  }, [searchParams, router, pathname])

  async function handlePurchase(
    product: { id: string; price_id?: string }
  ) {
    setCheckoutError('')
    setCheckoutLoading(product.id)
    const base = `${typeof window !== 'undefined' ? window.location.origin : ''}${basePath}`
    try {
      const { url } = (await billingApi.createCheckoutSession({
        price_id: product.price_id,
        product_id: product.id,
        success_url: `${base}/account?checkout=success`,
        cancel_url: `${base}/account?checkout=canceled`,
      })) as { url?: string }
      if (url) window.location.href = url
      else setCheckoutError(t('account.checkoutError'))
    } catch (err) {
      setCheckoutError(
        (err as { message?: string; detail?: string })?.message ||
          (err as { detail?: string })?.detail ||
          t('account.paymentError')
      )
    } finally {
      setCheckoutLoading(null)
    }
  }

  async function handleRedeemPromo(e: React.FormEvent) {
    e.preventDefault()
    if (!promoCode.trim()) return
    setPromoLoading(true)
    setPromoError('')
    setPromoSuccess(null)
    try {
      const res = (await billingApi.redeemPromo(promoCode.trim())) as {
        unlimited?: boolean
        free_until?: string
      }
      setPromoSuccess(res)
      setPromoCode('')
      const updated = await billingApi.getAccess()
      setAccess(updated as Access)
    } catch (err) {
      setPromoError(
        (err as Error)?.message ||
          (err as { detail?: string })?.detail ||
          t('account.promoError')
      )
    } finally {
      setPromoLoading(false)
    }
  }

  const usage = access?.usage ?? {}
  const limits = access?.limits ?? {
    chat_messages_per_month: 10,
    sessions_per_month: 2,
    tirages_per_month: 5,
    fleur_submits_per_month: 2,
  }
  const isFree = access?.free_access || access?.has_subscription
  const confirmWord = t('account.deleteAccountPlaceholder')
  const canConfirmDelete =
    deleteTyped.trim().toUpperCase() === confirmWord.toUpperCase()

  function openDeleteModal() {
    setDeleteModalOpen(true)
    setDeleteStep(1)
    setDeleteTyped('')
    setDeleteError('')
  }

  function closeDeleteModal() {
    setDeleteModalOpen(false)
    setDeleteStep(1)
    setDeleteTyped('')
    setDeleteError('')
  }

  async function handleDeleteAccount() {
    if (deleteStep === 1) {
      setDeleteStep(2)
      return
    }
    if (!canConfirmDelete) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      await authApi.deleteMyAccount()
      logout()
      router.replace('/')
    } catch (err) {
      setDeleteError(
        (err as Error)?.message ||
          (err as { detail?: string })?.detail ||
          t('account.deleteAccountError')
      )
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div
        className="w-full max-w-xl mx-auto px-4 py-8 space-y-8 min-w-0"
        style={{ animation: 'fadeIn 0.5s ease' }}
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
            {t('accountTitle')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {(user as { email?: string })?.email}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-6 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-emerald-900 dark:text-emerald-100">
                🌿 Demandes d’accompagnement
              </h2>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">
                Invitations ou demandes à valider (coach ↔ patient).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!user?.id) return
                const intentionIds = INTENTIONS.map((i) => i.id).join(',')
                setPendingSeedsLoading(true)
                socialApi
                  .pendingSeedsIncoming({ intention_ids: intentionIds, limit: 50 })
                  .then((r) => {
                    const items = (r as { items?: any[] })?.items ?? []
                    setPendingSeeds(
                      Array.isArray(items)
                        ? items.map((s) => ({
                            id: Number(s.id),
                            from_user_id: Number(s.from_user_id),
                            intention_id: String(s.intention_id ?? ''),
                            created_at: s.created_at ? String(s.created_at) : null,
                          }))
                        : []
                    )
                  })
                  .catch(() => setPendingSeeds([]))
                  .finally(() => setPendingSeedsLoading(false))
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/30 transition-colors"
            >
              Rafraîchir
            </button>
          </div>

          {pendingSeedsLoading ? (
            <div className="flex items-center justify-center py-6">
              <span className="w-6 h-6 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
            </div>
          ) : pendingSeeds.length === 0 ? (
            <p className="text-sm text-emerald-900/70 dark:text-emerald-100/70">
              Aucune demande en attente.
            </p>
          ) : (
            <div className="space-y-2">
              {pendingSeeds.map((s) => {
                const label = INTENTIONS.find((i) => i.id === s.intention_id)?.label ?? s.intention_id
                return (
                  <div
                    key={s.id}
                    className="rounded-xl border border-emerald-200/70 dark:border-emerald-800/60 bg-white/60 dark:bg-slate-900/40 px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        Demande #{s.id} · {label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        De l’utilisateur #{s.from_user_id}
                        {s.created_at ? ` · ${new Date(s.created_at).toLocaleDateString('fr-FR')}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => acceptPendingSeed(s.id)}
                        disabled={pendingBusyId === s.id}
                        className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {pendingBusyId === s.id ? '…' : 'Accepter'}
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectPendingSeed(s.id)}
                        disabled={pendingBusyId === s.id}
                        className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/25 disabled:opacity-50"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              👤 {t('account.profileSection')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('account.profileDesc')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setProfileTab('user')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                profileTab === 'user'
                  ? 'border-violet-500 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300'
              }`}
            >
              Profil utilisateur
            </button>
            {hasCoachTab && (
              <button
                type="button"
                onClick={() => setProfileTab('coach')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  profileTab === 'coach'
                    ? 'border-violet-500 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300'
                }`}
              >
                Profil coach
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setProfileTab('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  profileTab === 'admin'
                    ? 'border-violet-500 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300'
                }`}
              >
                Profil admin
              </button>
            )}
          </div>
          <form onSubmit={handleProfileSave} className="space-y-4">
            {profileTab === 'user' && (
              <>
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {(profileForm.avatar || (profile?.avatar as string)) ? (
                    <div className="relative group">
                      <img
                        src={profileForm.avatar || (profile?.avatar as string)}
                        alt=""
                        className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                      />
                      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          onChange={handlePhotoChange}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 rounded-full bg-white/90 text-slate-800 hover:bg-white text-sm"
                          title={t('account.changePhoto')}
                        >
                          📷
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="p-1.5 rounded-full bg-white/90 text-slate-800 hover:bg-white text-sm"
                          title={t('account.removePhoto')}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ) : (profileForm.avatar_emoji || (profile?.avatar_emoji as string)) ? (
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-3xl">
                        {profileForm.avatar_emoji || (profile?.avatar_emoji as string)}
                      </div>
                      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={handlePhotoChange}
                          />
                          <span
                            className="p-1.5 rounded-full bg-white/90 text-slate-800 hover:bg-white text-sm inline-block"
                            title={t('account.changePhoto')}
                          >
                            📷
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            handleSelectEmoji(
                              profileForm.avatar_emoji ||
                                (profile?.avatar_emoji as string)
                            )
                          }
                          className="p-1.5 rounded-full bg-white/90 text-slate-800 hover:bg-white text-sm"
                          title={t('account.changeAvatarEmoji')}
                        >
                          🌸
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex w-20 h-20 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 items-center justify-center cursor-pointer hover:border-violet-400 dark:hover:border-violet-500 transition-colors">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                      <span className="text-2xl text-slate-400">📷</span>
                    </label>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t('account.photo')}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('account.photoHint')}
                  </p>
                  {!(profileForm.avatar || profile?.avatar) && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {t('account.avatarEmojiHint')}
                    </p>
                  )}
                </div>
              </div>
              {!(profileForm.avatar || profile?.avatar) && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 w-full">
                    {t('account.selectFlowerEmoji')}
                  </span>
                  {FLOWER_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSelectEmoji(emoji)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all hover:scale-110 ${
                        (profileForm.avatar_emoji || profile?.avatar_emoji) ===
                        emoji
                          ? 'bg-violet-500 text-white ring-2 ring-violet-400 ring-offset-2 dark:ring-offset-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('account.displayName')}
              </label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) =>
                  setProfileForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={(user as { email?: string })?.email?.split('@')[0] || ''}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t('account.displayNameHint')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('account.pseudo')}
              </label>
              <input
                type="text"
                value={profileForm.pseudo}
                onChange={(e) =>
                  setProfileForm((f) => ({
                    ...f,
                    pseudo: e.target.value.replace(/\s/g, '').toLowerCase(),
                  }))
                }
                placeholder={t('account.pseudoPlaceholder')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400/40"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t('account.pseudoHint')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('account.bio')}
              </label>
              <textarea
                value={profileForm.bio}
                onChange={(e) =>
                  setProfileForm((f) => ({
                    ...f,
                    bio: e.target.value.slice(0, 500),
                  }))
                }
                placeholder={t('account.bioPlaceholder')}
                rows={5}
                className="w-full min-h-[130px] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-y"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {profileForm.bio.length}/500 — {t('account.bioHint')}
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profileForm.profile_public}
                onChange={async (e) => {
                  if (e.target.checked) {
                    setPrairieOptInModalOpen(true)
                  } else {
                    setProfileForm((f) => ({ ...f, profile_public: false }))
                    try {
                      await authApi.updateMyProfile({ profile_public: false })
                      await refreshUser()
                    } catch {
                      /* ignore */
                    }
                  }
                }}
                className="mt-1 rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-400"
              />
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {t('account.profilePublic')}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('account.profilePublicHint')}
                </p>
              </div>
            </label>
            {profileForm.profile_public && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={async () => {
                    setPrairieResyncLoading(true)
                    setPrairieVisibility(null)
                    try {
                      await authApi.updateMyProfile({ profile_public: true })
                      await refreshUser()
                      const check = await prairieApi.checkVisibility()
                      const vis = (check as { visible?: boolean })?.visible ?? false
                      setPrairieVisibility(vis)
                      setProfileSuccess(vis !== false)
                      setTimeout(() => {
                        setProfileSuccess(false)
                        setPrairieVisibility(null)
                      }, 5000)
                    } catch (err) {
                      setProfileError((err as Error)?.message || t('account.profileError'))
                    } finally {
                      setPrairieResyncLoading(false)
                    }
                  }}
                  disabled={prairieResyncLoading}
                  className="text-xs px-3 py-1.5 rounded-lg border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-50"
                >
                  {prairieResyncLoading ? '…' : t('account.prairieResync')}
                </button>
                {prairieVisibility === false && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {t('account.prairieNotVisible')}
                  </span>
                )}
                {prairieVisibility === true && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    ✓ {t('account.prairieVisible')}
                  </span>
                )}
              </div>
            )}
              </>
            )}
            {profileTab === 'coach' && hasCoachTab && (
              <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                  Fiche coach (visible aux utilisateurs)
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Ces informations sont utilisees pour aider les utilisateurs a choisir leur coach dans la section Accompagnement.
                </p>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Titre / positionnement
                  </label>
                  <input
                    type="text"
                    value={profileForm.coach_headline}
                    onChange={(e) => setProfileForm((f) => ({ ...f, coach_headline: e.target.value.slice(0, 120) }))}
                    placeholder="Ex: Accompagnement relationnel et transitions de vie"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Conseil: explicitez votre promesse en 1 phrase (public + resultat).
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Presentation courte
                    </label>
                    <button
                      type="button"
                      onClick={() => setProfileForm((f) => ({
                        ...f,
                        coach_short_bio:
                          "J'aide les personnes et les couples a clarifier leurs blocages relationnels, retrouver une communication apaisée et poser des actions concretes en quelques echanges progressifs.",
                      }))}
                      className="text-[11px] px-2 py-1 rounded-md border border-violet-300/60 dark:border-violet-700/60 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                    >
                      Inserer un exemple
                    </button>
                  </div>
                  <RichTextToolbar
                    onInsert={(template) =>
                      insertInTextarea(
                        coachShortBioRef,
                        profileForm.coach_short_bio,
                        (next) => setProfileForm((f) => ({ ...f, coach_short_bio: next })),
                        template,
                        280
                      )
                    }
                  />
                  <textarea
                    ref={coachShortBioRef}
                    value={profileForm.coach_short_bio}
                    onChange={(e) => setProfileForm((f) => ({ ...f, coach_short_bio: e.target.value.slice(0, 280) }))}
                    rows={6}
                    placeholder="2-3 phrases pour expliquer votre accompagnement."
                    className="w-full min-h-[180px] max-h-[520px] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-y"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {profileForm.coach_short_bio.length}/280 — Formatage simple: gras, italique, listes. Coin bas-droit pour agrandir la zone.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Presentation detaillee
                    </label>
                    <button
                      type="button"
                      onClick={() => setProfileForm((f) => ({
                        ...f,
                        coach_long_bio:
                          "Approche:\n- Ecoute active et sans jugement\n- Clarification des besoins et limites\n\nMethode:\n- Diagnostic en messages\n- Plan d'action progressif sur 2 a 4 semaines\n\nCe que vous obtenez:\n- Plus de clarte emotionnelle\n- Des mots concrets pour communiquer\n- Une trajectoire relationnelle plus stable",
                      }))}
                      className="text-[11px] px-2 py-1 rounded-md border border-violet-300/60 dark:border-violet-700/60 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30"
                    >
                      Inserer une structure type
                    </button>
                  </div>
                  <RichTextToolbar
                    onInsert={(template) =>
                      insertInTextarea(
                        coachLongBioRef,
                        profileForm.coach_long_bio,
                        (next) => setProfileForm((f) => ({ ...f, coach_long_bio: next })),
                        template,
                        2500
                      )
                    }
                  />
                  <textarea
                    ref={coachLongBioRef}
                    value={profileForm.coach_long_bio}
                    onChange={(e) => setProfileForm((f) => ({ ...f, coach_long_bio: e.target.value.slice(0, 2500) }))}
                    rows={14}
                    placeholder="Votre posture, methode, ce qui vous differencie."
                    className="w-full min-h-[320px] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-y max-h-[min(70vh,900px)]"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {profileForm.coach_long_bio.length}/2500 — Astuce: structurez par sections (approche, methode, benefices). Coin bas-droit pour agrandir la zone.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-3">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Apercu presentation courte</p>
                    <p className="text-[12px] whitespace-pre-wrap text-slate-700 dark:text-slate-200 min-h-[56px]">
                      {profileForm.coach_short_bio || 'Votre texte apparaitra ici.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-3">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Qualite de la fiche</p>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${coachScore >= 5 ? 'bg-emerald-500' : coachScore >= 3 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.round((coachScore / 6) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">{coachScore}/6</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Visez 5/6 minimum pour une fiche convaincante.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Specialites (separees par virgules)
                    </label>
                    <input
                      type="text"
                      value={profileForm.coach_specialties}
                      onChange={(e) => setProfileForm((f) => ({ ...f, coach_specialties: e.target.value }))}
                      placeholder="Communication, couple, limites..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Langues (separees par virgules)
                    </label>
                    <input
                      type="text"
                      value={profileForm.coach_languages}
                      onChange={(e) => setProfileForm((f) => ({ ...f, coach_languages: e.target.value }))}
                      placeholder="fr-FR, en-US"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Delai de reponse (texte)
                    </label>
                    <input
                      type="text"
                      value={profileForm.coach_response_time_label}
                      onChange={(e) => setProfileForm((f) => ({ ...f, coach_response_time_label: e.target.value.slice(0, 60) }))}
                      placeholder="Repond sous 24h"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Delai cible (heures)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={profileForm.coach_response_time_hours}
                      onChange={(e) => {
                        const n = parseInt(e.target.value || '24', 10)
                        setProfileForm((f) => ({ ...f, coach_response_time_hours: Number.isNaN(n) ? 24 : Math.min(168, Math.max(1, n)) }))
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Annees d&apos;experience
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={profileForm.coach_years_experience}
                      onChange={(e) => {
                        const n = parseInt(e.target.value || '0', 10)
                        setProfileForm((f) => ({ ...f, coach_years_experience: Number.isNaN(n) ? 0 : Math.min(60, Math.max(0, n)) }))
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Note / avis (texte court)
                    </label>
                    <input
                      type="text"
                      value={profileForm.coach_reviews_label}
                      onChange={(e) => setProfileForm((f) => ({ ...f, coach_reviews_label: e.target.value.slice(0, 120) }))}
                      placeholder="Ex: 4.9/5 · 120 avis verifies"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                    />
                  </div>
                </div>

                {isAdmin && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileForm.coach_verified}
                      onChange={(e) => setProfileForm((f) => ({ ...f, coach_verified: e.target.checked }))}
                      className="mt-1 rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-400"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Coach verifie par l&apos;equipe
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Badge de confiance affiche cote utilisateur.
                      </p>
                    </div>
                  </label>
                )}

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profileForm.coach_is_listed}
                    onChange={(e) => setProfileForm((f) => ({ ...f, coach_is_listed: e.target.checked }))}
                    className="mt-1 rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-400"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Afficher ce profil dans le choix du coach
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Si desactive, vous restez coach mais vous n'apparaissez plus dans la liste de selection utilisateur.
                    </p>
                  </div>
                </label>
              </div>
            )}
            {profileTab === 'admin' && isAdmin && (
              <div className="rounded-xl border border-amber-300/70 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Profil admin
                </h3>
                <p className="text-[12px] text-slate-700 dark:text-slate-200">
                  En tant qu&apos;admin, vous avez aussi le role coach. Utilisez l&apos;onglet <strong>Profil coach</strong> pour regler votre fiche publique.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => router.push('/admin')}
                    className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/30"
                  >
                    Ouvrir le dashboard admin
                  </button>
                  {(user as { email?: string })?.email && (
                    <button
                      type="button"
                      onClick={async () => {
                        setForceVisibleLoading(true)
                        try {
                          await prairieApi.forceVisible((user as { email: string }).email)
                          setProfileSuccess(true)
                          setTimeout(() => setProfileSuccess(false), 3000)
                          await refreshUser()
                        } catch (err) {
                          setProfileError((err as Error)?.message || t('account.profileError'))
                        } finally {
                          setForceVisibleLoading(false)
                        }
                      }}
                      disabled={forceVisibleLoading}
                      className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
                    >
                      {forceVisibleLoading ? '…' : t('account.prairieForceVisible')}
                    </button>
                  )}
                </div>
              </div>
            )}
            <PrairieOptInModal
              open={prairieOptInModalOpen}
              saving={prairieOptInSaving}
              onConfirm={async () => {
                setPrairieOptInSaving(true)
                try {
                  await authApi.updateMyProfile({ profile_public: true })
                  setProfileForm((f) => ({ ...f, profile_public: true }))
                  setProfile((p) => (p ? { ...p, profile_public: true } : p))
                  await refreshUser()
                  setPrairieOptInModalOpen(false)
                  setProfileSuccess(true)
                  setTimeout(() => setProfileSuccess(false), 3000)
                } catch (err) {
                  setProfileError(
                    (err as Error)?.message || t('account.profileError')
                  )
                } finally {
                  setPrairieOptInSaving(false)
                }
              }}
              onCancel={() => setPrairieOptInModalOpen(false)}
            />
            {profileError && (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                {profileError}
              </p>
            )}
            {profileSuccess && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {t('account.profileSaved')}
              </p>
            )}
            {profileTab !== 'admin' && (
              <button
                type="submit"
                disabled={profileSaving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-rose-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {profileSaving ? '…' : t('common.save')}
              </button>
            )}
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {t('account.myAccess')}
            </h2>
            {loading ? (
              <span className="w-5 h-5 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
            ) : (
              <AccessBadge access={access} />
            )}
          </div>

          {!loading && (
            <div className="space-y-4">
              {access?.has_subscription && access?.subscription && (
                <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 p-3 space-y-1">
                  <p className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                    {t('account.subscriptionLabel')}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Plan{' '}
                    <strong>
                      {(access.subscription.plan_id || '')
                        .toLowerCase()
                        .includes('year')
                        ? t('account.planAnnual')
                        : t('account.planMonthly')}
                    </strong>
                    {access.subscription.current_period_end && (
                      <>
                        {' '}
                        ·{' '}
                        {t('account.planUntil').replace(
                          '{date}',
                          new Date(
                            access.subscription.current_period_end
                          ).toLocaleDateString(undefined, {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                          })
                        )}
                      </>
                    )}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 min-w-0">
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 min-w-0 overflow-hidden">
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                    {t('account.sapBadge')}
                  </p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {access?.token_balance ?? 0}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {t('account.sapSaison')}
                  </p>
                </div>
                <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 p-3 min-w-0 overflow-hidden">
                  <p className="text-[10px] font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                    {t('account.cristalLabel')}
                  </p>
                  <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
                    {access?.eternal_sap ?? 0}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {t('account.sapEternelle')}
                  </p>
                </div>
              </div>

              {!isFree && (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('account.usageThisMonth').replace(
                      '{period}',
                      String(usage.period ?? '—')
                    )}
                  </p>
                  <div className="space-y-3">
                    <UsageBar
                      label={t('account.messages')}
                      used={(usage.chat_messages_count as number) ?? 0}
                      limit={limits.chat_messages_per_month ?? 10}
                      color="violet"
                    />
                    <UsageBar
                      label={t('account.sessions')}
                      used={(usage.sessions_count as number) ?? 0}
                      limit={limits.sessions_per_month ?? 2}
                      color="rose"
                    />
                    <UsageBar
                      label={t('account.tirages')}
                      used={(usage.tirages_count as number) ?? 0}
                      limit={limits.tirages_per_month ?? 5}
                      color="amber"
                    />
                    <UsageBar
                      label={`🌸 ${t('account.fleurSubmits')}`}
                      used={(usage.fleur_submits_count as number) ?? 0}
                      limit={limits.fleur_submits_per_month ?? 2}
                      color="rose"
                    />
                  </div>
                </>
              )}

              {isFree && !access?.credits && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {access?.has_subscription
                    ? t('account.subscriptionActiveDesc')
                    : t('account.promoFreeDesc')}
                </p>
              )}

              {(access?.credits ?? 0) > 0 && (
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    {t('account.credits')}
                  </p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
                    {access?.credits}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {t('account.creditsAvailable')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            🎁 {t('account.promoCode')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('account.promoHint')}
          </p>

          {promoSuccess && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 text-sm text-emerald-700 dark:text-emerald-300">
              {promoSuccess.unlimited
                ? `✨ ${t('account.promoSuccessUnlimited')}`
                : `🎁 ${t('account.promoSuccessUntil').replace(
                    '{date}',
                    new Date(promoSuccess.free_until!).toLocaleDateString(
                      undefined,
                      { day: '2-digit', month: 'long', year: 'numeric' }
                    )
                  )}`}
            </div>
          )}

          {promoError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-4 text-sm text-rose-700 dark:text-rose-300">
              {promoError}
            </div>
          )}

          <form onSubmit={handleRedeemPromo} className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) =>
                setPromoCode(e.target.value.toUpperCase())
              }
              placeholder="Ex. BIENVENUE2025"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-violet-400/40"
            />
            <button
              type="submit"
              disabled={promoLoading || !promoCode.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-rose-500 text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-40"
            >
              {promoLoading ? '…' : t('account.promoActivate')}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            💳 {t('account.subscription')}
          </h2>
          {access?.has_subscription ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {t('account.subscriptionActiveDesc')}
            </p>
          ) : (
            <>
              <div className="space-y-2.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                <p>
                  <strong className="text-slate-700 dark:text-slate-300">
                    {t('account.subscriptionPlan')}
                  </strong>{' '}
                  {t('account.subscriptionDesc')}
                </p>
                <p>
                  <strong className="text-slate-700 dark:text-slate-300">
                    {t('account.creditsLabel')}
                  </strong>{' '}
                  {t('account.creditsDesc')}
                </p>
              </div>
              {checkoutError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 p-3 text-sm text-rose-700 dark:text-rose-300">
                  {checkoutError}
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-3">
                {products.map((p) => {
                  const priceLabel = p.amount_cents
                    ? (
                        p.amount_cents / 100
                      ).toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }) +
                      ' €' +
                      (p.unit ? `/${p.unit}` : '')
                    : null
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePurchase(p)}
                      disabled={!!checkoutLoading}
                      className="flex flex-col items-center gap-0.5 px-5 py-3 rounded-xl bg-gradient-to-br from-violet-600 to-rose-600 hover:from-violet-500 hover:to-rose-500 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50 disabled:hover:from-violet-600 disabled:hover:to-rose-600"
                    >
                      <span>
                        {checkoutLoading === p.id
                          ? t('account.redirecting')
                          : p.label}
                      </span>
                      {priceLabel && (
                        <span className="text-xs font-medium text-white/90">
                          {priceLabel}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {products.length === 0 && !loading && (
                <p className="text-xs text-slate-400">
                  {t('account.configureStripe')}
                </p>
              )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            ♿ {t('accessibility')}
          </h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('fontSize')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('fontSizeDesc')}
              </p>
            </div>
            <button
              onClick={() =>
                setFontSizePreference(
                  fontSizePreference === 'large' ? 'normal' : 'large'
                )
              }
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
                fontSizePreference === 'large'
                  ? 'bg-violet-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {fontSizePreference === 'large' ? t('fontLarge') : t('fontNormal')}
            </button>
          </div>
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('language')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('languageDesc')}
              </p>
            </div>
            <select
              value={locale || 'fr'}
              onChange={(e) => setLocale(e.target.value)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-medium"
            >
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-6 space-y-4">
          <h2 className="text-base font-bold text-rose-700 dark:text-rose-400">
            ⚠️ {t('account.deleteAccountSection')}
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {t('account.deleteAccountWarning')}
          </p>
          <button
            type="button"
            onClick={openDeleteModal}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition-colors"
          >
            {t('account.deleteAccount')}
          </button>
        </div>

        {deleteModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={(e) =>
              e.target === e.currentTarget && closeDeleteModal()
            }
          >
            <div
              className="w-full max-w-md rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-white dark:bg-[#0f172a] p-6 space-y-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">
                  ⚠️ {t('account.deleteAccountConfirm1')}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('account.deleteAccountWarning')}
                </p>
                {deleteStep === 2 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                      {t('account.deleteAccountConfirm2')}
                    </p>
                    <input
                      type="text"
                      value={deleteTyped}
                      onChange={(e) => setDeleteTyped(e.target.value)}
                      placeholder={confirmWord}
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono tracking-wider placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                )}
              </div>
              {deleteError && (
                <div className="rounded-xl bg-rose-100 dark:bg-rose-900/40 border border-rose-200 dark:border-rose-800 p-3 text-sm text-rose-700 dark:text-rose-300">
                  {deleteError}
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={
                    (deleteStep === 2 && !canConfirmDelete) || deleteLoading
                  }
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold"
                >
                  {deleteLoading
                    ? '…'
                    : deleteStep === 1
                      ? t('common.confirm')
                      : t('account.deleteAccount')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
