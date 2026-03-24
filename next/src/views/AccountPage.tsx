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

export function AccountPage() {
  const { user, logout, refreshUser, isAdmin } = useAuth()
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
  })
  const [prairieOptInModalOpen, setPrairieOptInModalOpen] = useState(false)
  const [prairieOptInSaving, setPrairieOptInSaving] = useState(false)
  const [prairieResyncLoading, setPrairieResyncLoading] = useState(false)
  const [prairieVisibility, setPrairieVisibility] = useState<boolean | null>(null)
  const [forceVisibleLoading, setForceVisibleLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const updated = await authApi.updateMyProfile({
        name: profileForm.name,
        pseudo: profileForm.pseudo || null,
        bio: profileForm.bio || null,
        avatar: profileForm.avatar || null,
        avatar_emoji: profileForm.avatar_emoji || null,
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

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              👤 {t('account.profileSection')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('account.profileDesc')}
            </p>
          </div>
          <form onSubmit={handleProfileSave} className="space-y-4">
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
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 resize-none"
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
                {isAdmin && (user as { email?: string })?.email && (
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
                        setProfileError(
                          (err as Error)?.message || t('account.profileError')
                        )
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
            <button
              type="submit"
              disabled={profileSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-rose-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {profileSaving ? '…' : t('common.save')}
            </button>
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
