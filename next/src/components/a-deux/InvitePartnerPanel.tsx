'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { aDeuxApi, getADeuxInviteUrl } from '@/api/a-deux'
import { socialApi, type LienItem } from '@/api/social'
import { InvitePartnerHint } from '@/components/a-deux/InvitePartnerHint'
import { t } from '@/i18n'

type InvitePartnerPanelProps = {
  anchorId: number
  onPairingCreated?: (token: string) => void
}

function InviteEmailSentBanner({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border-2 border-emerald-400/70 bg-emerald-100/90 dark:bg-emerald-900/50 dark:border-emerald-500/50 px-4 py-3 space-y-1"
    >
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">✓ {label}</p>
      <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90">{t('aDeux.inviteSentHint')}</p>
    </div>
  )
}

function InviteKnownSentBanner({ pseudo }: { pseudo: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border-2 border-emerald-400/70 bg-emerald-100/90 dark:bg-emerald-900/50 dark:border-emerald-500/50 px-4 py-3 space-y-1"
    >
      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
        ✓ {t('aDeux.inviteKnownSentTo', { pseudo })}
      </p>
      <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90">{t('aDeux.inviteKnownSentHint')}</p>
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
  const [sentToPseudo, setSentToPseudo] = useState('')
  const [loading, setLoading] = useState(false)
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null)
  const [inviteSent, setInviteSent] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [knownContacts, setKnownContacts] = useState<LienItem[]>([])
  const [loadingContacts, setLoadingContacts] = useState(true)
  /** 'none' = formulaire ; 'link' = lien à copier ; 'email' | 'known' = envoi direct */
  const [inviteChannel, setInviteChannel] = useState<'none' | 'link' | 'email' | 'known'>('none')

  useEffect(() => {
    let cancelled = false
    setLoadingContacts(true)
    socialApi
      .getMyLiens()
      .then((res) => {
        if (!cancelled) setKnownContacts(res.liens || [])
      })
      .catch(() => {
        if (!cancelled) setKnownContacts([])
      })
      .finally(() => {
        if (!cancelled) setLoadingContacts(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function createInvite(email?: string) {
    setLoading(true)
    setError('')
    setMessage('')
    setInviteSent(false)
    setSentToEmail('')
    setSentToPseudo('')
    const trimmed = (email ?? partnerEmail).trim()
    setInviteChannel(trimmed ? 'email' : 'link')
    try {
      const res = (await aDeuxApi.createPairing(anchorId, trimmed || undefined)) as {
        invite_token: string
        email_sent?: boolean
      }
      setInviteToken(res.invite_token)
      onPairingCreated?.(res.invite_token)
      if (trimmed) {
        if (res.email_sent) {
          setInviteSent(true)
          setSentToEmail(trimmed)
        } else {
          setInviteChannel('none')
          setInviteToken(null)
          setError(t('aDeux.inviteFailed'))
        }
      } else {
        setMessage(t('aDeux.inviteCreated'))
      }
    } catch (e) {
      const err = e as { message?: string; detail?: string }
      setInviteChannel('none')
      setInviteToken(null)
      setError(err.detail || err.message || t('aDeux.inviteError'))
    } finally {
      setLoading(false)
    }
  }

  async function inviteKnownContact(contact: LienItem) {
    setInvitingUserId(contact.userId)
    setError('')
    setMessage('')
    setInviteSent(false)
    setSentToEmail('')
    setSentToPseudo('')
    setInviteChannel('known')
    try {
      const res = (await aDeuxApi.createPairing(anchorId)) as { invite_token: string }
      setInviteToken(res.invite_token)
      onPairingCreated?.(res.invite_token)

      const inviteRes = await aDeuxApi.inviteByUserId(res.invite_token, contact.userId)
      if (inviteRes?.sent) {
        setInviteSent(true)
        setSentToPseudo(contact.pseudo)
      } else if (inviteRes?.notified && !inviteRes?.email_sent) {
        setInviteChannel('none')
        setInviteToken(null)
        setError(t('aDeux.inviteKnownEmailFailed'))
      } else {
        setInviteChannel('none')
        setInviteToken(null)
        setError(t('aDeux.inviteFailed'))
      }
    } catch (e) {
      const err = e as { message?: string; detail?: string }
      setInviteChannel('none')
      setInviteToken(null)
      setError(err.detail || err.message || t('aDeux.inviteError'))
    } finally {
      setInvitingUserId(null)
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
    setSentToPseudo('')
    setPartnerEmail('')
    setMessage('')
    setError('')
    setInviteChannel('none')
  }

  const sendingLabel = partnerEmail.trim() ? t('aDeux.sendingInvite') : t('aDeux.creatingInvite')
  const inviteDelivered =
    (inviteChannel === 'email' && inviteSent && Boolean(sentToEmail)) ||
    (inviteChannel === 'known' && inviteSent && Boolean(sentToPseudo))
  const showInviteLink = inviteChannel === 'link' && Boolean(inviteToken)

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">{t('aDeux.inviteTitle')}</h3>
        <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">{t('aDeux.inviteDesc')}</p>
      </div>

      {inviteDelivered ? (
        <div className="space-y-3">
          {sentToEmail && (
            <InviteEmailSentBanner label={t('aDeux.inviteSentTo', { email: sentToEmail })} />
          )}
          {sentToPseudo && <InviteKnownSentBanner pseudo={sentToPseudo} />}
          <button
            type="button"
            onClick={resetInvite}
            className="w-full py-2 text-sm text-emerald-700 dark:text-emerald-300 underline"
          >
            {t('aDeux.inviteAnother')}
          </button>
        </div>
      ) : showInviteLink ? (
        <div className="space-y-3">
          {message && (
            <div
              role="status"
              className="rounded-xl border border-emerald-300/70 bg-white/80 dark:bg-slate-900/60 px-4 py-3"
            >
              <p className="text-sm text-emerald-800 dark:text-emerald-200">{message}</p>
            </div>
          )}

          <div className="flex gap-2 items-start">
            <code className="flex-1 text-xs font-mono break-all bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-emerald-200 dark:border-emerald-800">
              {getADeuxInviteUrl(inviteToken!)}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700"
            >
              {t('aDeux.copyLink')}
            </button>
          </div>
          <button
            type="button"
            onClick={resetInvite}
            className="w-full py-2 text-sm text-emerald-700 dark:text-emerald-300 underline"
          >
            {t('aDeux.inviteAnother')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">
              {t('aDeux.inviteKnownSection')}
            </p>
            {loadingContacts ? (
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{t('aDeux.inviteKnownLoading')}</p>
            ) : knownContacts.length === 0 ? (
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{t('aDeux.inviteKnownEmpty')}</p>
            ) : (
              <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {knownContacts.map((contact) => (
                  <li key={contact.userId}>
                    <button
                      type="button"
                      onClick={() => inviteKnownContact(contact)}
                      disabled={loading || invitingUserId != null}
                      className="w-full flex items-center gap-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/80 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-left hover:border-emerald-400/60 disabled:opacity-50 transition-colors"
                    >
                      <span className="text-lg shrink-0" aria-hidden>
                        {contact.avatarEmoji || '🌸'}
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-medium text-emerald-900 dark:text-emerald-100 truncate">
                        {contact.pseudo}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        {invitingUserId === contact.userId ? '…' : t('aDeux.inviteKnownCta')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">
              {t('aDeux.inviteEmailSection')}
            </p>
            <input
              type="email"
              className="w-full px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-slate-800 text-sm"
              placeholder={t('aDeux.partnerEmailPlaceholder')}
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
            />
            <button
              type="button"
              onClick={() => createInvite()}
              disabled={loading || invitingUserId != null}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? sendingLabel : partnerEmail.trim() ? t('aDeux.createInvite') : t('aDeux.inviteLinkOnlyCta')}
            </button>
          </section>

          <InvitePartnerHint />
        </div>
      )}

      {(message && showInviteLink && message === t('aDeux.linkCopied')) && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <Link
        href="/a-deux"
        className="inline-flex text-sm font-medium text-emerald-800 dark:text-emerald-200 underline"
      >
        {t('aDeux.viewMesDuos')}
      </Link>
    </div>
  )
}
