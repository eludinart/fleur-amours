import { api } from '@/lib/api-client'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${basePath}`
}

export function getADeuxInviteUrl(token: string): string {
  return `${getAppBaseUrl()}/a-deux/invitation?token=${encodeURIComponent(token)}`
}

export function getADeuxResultUrl(token: string): string {
  return `${getAppBaseUrl()}/a-deux/result?token=${encodeURIComponent(token)}`
}

export const aDeuxApi = {
  getDashboard: () => api.get('/api/a-deux/dashboard') as Promise<{
    anchors: Record<string, unknown>[]
    pairings: Record<string, unknown>[]
  }>,

  listAnchors: () => api.get('/api/a-deux/anchors') as Promise<{ anchors: Record<string, unknown>[] }>,

  getAnchor: (id: number) => api.get(`/api/a-deux/anchor/${id}`),

  submitAnchorPorte: (payload: {
    porte: string
    answers: Array<{ questionId: string; value: number }>
    label?: string
  }) => api.post('/api/a-deux/anchor', { ...payload, questionnaire_type: 'porte' }),

  submitAnchorComplet: (payload: {
    answers: Array<{ question_id: number; dimension_chosen: string; choice_label?: string }>
    label?: string
  }) => api.post('/api/a-deux/anchor', { ...payload, questionnaire_type: 'complet' }),

  createPairing: (anchorId: number, invitedEmail?: string) =>
    api.post('/api/a-deux/pairing', {
      anchor_id: anchorId,
      invited_email: invitedEmail,
      app_base_url: getAppBaseUrl() || undefined,
    }),

  listPairings: () => api.get('/api/a-deux/pairings') as Promise<{ pairings: Record<string, unknown>[] }>,

  getPairing: (token: string) => api.get(`/api/a-deux/pairing/${encodeURIComponent(token)}`),

  getDuoResult: (token: string) =>
    api.get(`/api/a-deux/duo-result/${encodeURIComponent(token)}`),

  submitPartnerPorte: (
    token: string,
    payload: { porte: string; answers: Array<{ questionId: string; value: number }> }
  ) => api.post(`/api/a-deux/pairing/${encodeURIComponent(token)}/submit`, payload),

  submitPartnerComplet: (
    token: string,
    payload: {
      answers: Array<{ question_id: number; dimension_chosen: string; choice_label?: string }>
    }
  ) => api.post(`/api/a-deux/pairing/${encodeURIComponent(token)}/submit`, {
    ...payload,
    questionnaire_type: 'complet',
  }),

  inviteByEmail: (inviteToken: string, partnerEmail: string) =>
    api.post('/api/a-deux/pairing/invite', {
      invite_token: inviteToken,
      partner_email: partnerEmail,
      app_base_url: getAppBaseUrl(),
    }),

  deleteAnchor: (id: number) => api.post('/api/a-deux/delete', { type: 'anchor', id }),

  deletePairing: (id: number) => api.post('/api/a-deux/delete', { type: 'pairing', id }),

  getWorkspace: (token: string) =>
    api.get(`/api/a-deux/pairing/${encodeURIComponent(token)}/workspace`),

  postWorkspace: (token: string, body: Record<string, unknown>) =>
    api.post(`/api/a-deux/pairing/${encodeURIComponent(token)}/workspace`, body),
}
