'use client'

import { useState } from 'react'
import Link from 'next/link'
import { aDeuxApi, getADeuxInviteUrl } from '@/api/a-deux'
import { t } from '@/i18n'

type InvitePartnerPanelProps = {
  anchorId: number
  onPairingCreated?: (token: string) => void
}

export function InvitePartnerPanel({ anchorId, onPairingCreated }: InvitePartnerPanelProps) {
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function createInvite() {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const email = partnerEmail.trim()
      const res = (await aDeuxApi.createPairing(anchorId, email || undefined)) as {
        invite_token: string
        email_sent?: boolean
      }
      setInviteToken(res.invite_token)
      onPairingCreated?.(res.invite_token)
      if (email) {
        if (res.email_sent) {
          setInviteSent(true)
          setMessage(t('aDeux.inviteSentTo', { email }))
        } else {
          setError(t('aDeux.inviteFailed'))
        }
      } else {
        setMessage(t('aDeux.inviteCreated'))
      }
    } catch (e) {
      const err = e as { message?: string; detail?: string }
      setError(err.detail || err.message || t('aDeux.inviteError'))
    } finally {
      setLoading(false)
    }
  }

  async function retrySendEmail() {
    if (!inviteToken || !partnerEmail.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = (await aDeuxApi.inviteByEmail(inviteToken, partnerEmail.trim())) as { sent?: boolean }
      if (res?.sent) {
        setInviteSent(true)
        setMessage(t('aDeux.inviteSentTo', { email: partnerEmail.trim() }))
      } else {
        setError(t('aDeux.inviteFailed'))
      }
    } catch (e) {
      const err = e as { message?: string; detail?: string }
      setError(err.detail || err.message || t('aDeux.inviteError'))
    } finally {
      setLoading(false)
    }
  }

  function copyLink() {
    if (!inviteToken) return
    const url = getADeuxInviteUrl(inviteToken)
    navigator.clipboard?.writeText(url).then(
      () => setMessage(t('aDeux.linkCopied')),
      () => setError(t('aDeux.copyLinkManual'))
    )
  }

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">{t('aDeux.inviteTitle')}</h3>
        <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">{t('aDeux.inviteDesc')}</p>
      </div>

      {!inviteToken ? (
        <div className="space-y-3">
          <input
            type="email"
            className="w-full px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 text-sm"
            placeholder={t('aDeux.partnerEmailPlaceholder')}
            value={partnerEmail}
            onChange={(e) => setPartnerEmail(e.target.value)}
          />
          <button
            type="button"
            onClick={createInvite}
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? '…' : t('aDeux.createInvite')}
          </button>
          <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{t('aDeux.multiInviteHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 items-start">
            <code className="flex-1 text-xs font-mono break-all bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800">
              {getADeuxInviteUrl(inviteToken)}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700"
            >
              {t('aDeux.copyLink')}
            </button>
          </div>
          {!inviteSent && partnerEmail.trim() && error && (
            <button
              type="button"
              onClick={retrySendEmail}
              disabled={loading}
              className="w-full py-2 text-sm text-emerald-700 dark:text-emerald-300 underline disabled:opacity-50"
            >
              {loading ? '…' : t('aDeux.sendEmail')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setInviteToken(null)
              setInviteSent(false)
              setPartnerEmail('')
              setMessage('')
            }}
            className="w-full py-2 text-sm text-emerald-700 dark:text-emerald-300 underline"
          >
            {t('aDeux.inviteAnother')}
          </button>
        </div>
      )}

      {message && <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Link
        href="/mes-duos"
        className="inline-flex text-sm font-medium text-emerald-800 dark:text-emerald-200 underline"
      >
        {t('aDeux.viewMesDuos')}
      </Link>
    </div>
  )
}
