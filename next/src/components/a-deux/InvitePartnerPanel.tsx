'use client'

import { useState } from 'react'
import Link from 'next/link'
import { aDeuxApi, getADeuxInviteUrl } from '@/api/a-deux'
import { InvitePartnerHint } from '@/components/a-deux/InvitePartnerHint'
import { t } from '@/i18n'

type InvitePartnerPanelProps = {
  anchorId: number
  onPairingCreated?: (token: string) => void
}

function InviteEmailSentBanner({ email }: { email: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border-2 border-emerald-400/70 bg-emerald-100/90 dark:bg-emerald-900/50 dark:border-emerald-500/50 px-4 py-3 space-y-1"
    >
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
        ✓ {t('aDeux.inviteSentTo', { email })}
      </p>
      <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90">{t('aDeux.inviteSentHint')}</p>
    </div>
  )
}

export function InvitePartnerPanel({
  anchorId,
  onPairingCreated,
}: InvitePartnerPanelProps) {
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [sentToEmail, setSentToEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function createInvite() {
    setLoading(true)
    setError('')
    setMessage('')
    setInviteSent(false)
    setSentToEmail('')
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
          setSentToEmail(email)
        } else {
          setMessage(t('aDeux.inviteCreated'))
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
      const email = partnerEmail.trim()
      const res = (await aDeuxApi.inviteByEmail(inviteToken, email)) as { sent?: boolean }
      if (res?.sent) {
        setInviteSent(true)
        setSentToEmail(email)
        setMessage('')
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

  function resetInvite() {
    setInviteToken(null)
    setInviteSent(false)
    setSentToEmail('')
    setPartnerEmail('')
    setMessage('')
    setError('')
  }

  const sendingLabel = partnerEmail.trim() ? t('aDeux.sendingInvite') : t('aDeux.creatingInvite')

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
            {loading ? sendingLabel : t('aDeux.createInvite')}
          </button>
          <InvitePartnerHint />
        </div>
      ) : (
        <div className="space-y-3">
          {inviteSent && sentToEmail && <InviteEmailSentBanner email={sentToEmail} />}

          {!inviteSent && message && (
            <div
              role="status"
              className="rounded-xl border border-emerald-300/70 bg-white/80 dark:bg-slate-900/60 px-4 py-3"
            >
              <p className="text-sm text-emerald-800 dark:text-emerald-200">{message}</p>
            </div>
          )}

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
          {!inviteSent && partnerEmail.trim() && (
            <button
              type="button"
              onClick={retrySendEmail}
              disabled={loading}
              className="w-full py-2 text-sm text-emerald-700 dark:text-emerald-300 underline disabled:opacity-50"
            >
              {loading ? t('aDeux.sendingInvite') : t('aDeux.sendEmail')}
            </button>
          )}
          <button
            type="button"
            onClick={resetInvite}
            className="w-full py-2 text-sm text-emerald-700 dark:text-emerald-300 underline"
          >
            {t('aDeux.inviteAnother')}
          </button>
        </div>
      )}

      {(message && (!inviteSent || message === t('aDeux.linkCopied'))) && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>
      )}
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
