import { api } from '@/lib/api-client'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/jardin'

export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${basePath}`
}

export function getDuoInviteUrl(token: string): string {
  return getAppBaseUrl() + '/duo?token=' + encodeURIComponent(token)
}

export const fleurApi = {
  getQuestions: (slug: string, locale: string | null = null) => {
    const url =
      locale && ['fr', 'en', 'es'].includes(locale)
        ? `/api/fleur/questions/${slug}?locale=${locale}`
        : `/api/fleur/questions/${slug}`
    return api.get(url)
  },
  submit: (payload: Record<string, unknown>) =>
    api.post('/api/fleur/submit', {
      ...payload,
      ...(payload.partner_token ? { app_base_url: getAppBaseUrl() } : {}),
    }),
  getMyResults: () => api.get('/api/fleur/my-results'),
  deleteResult: (item: { type: string; token?: string; id?: string }) =>
    api.post(
      '/api/fleur/delete',
      item.type === 'duo' ? { token: item.token } : { id: item.id }
    ),
  getResult: (resultId: string) => api.get(`/api/fleur/result/${resultId}`),
  getAnswers: (resultId: string) => api.get(`/api/fleur/answers/${resultId}`),
  getDuoResult: (token: string) => api.get(`/api/fleur/duo-result/${token}`),
  getDuoExplanation: (payload: Record<string, unknown>) =>
    api.post('/api/fleur/duo-explanation', payload),
  invitePartner: (partnerEmail: string, token: string) =>
    api.post('/api/duo/invite', {
      partner_email: partnerEmail,
      token,
      app_base_url: getAppBaseUrl(),
    }),
  invitePartnerByUserId: (token: string, toUserId: string) =>
    api.post('/api/duo/invite-by-user-id', {
      token,
      to_user_id: toUserId,
      app_base_url: getAppBaseUrl(),
    }),
  getStatsByQuestion: (slug: string) =>
    api.get(`/api/fleur/stats/by-question/${slug}`),
}
