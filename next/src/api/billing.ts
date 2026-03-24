import { api } from '@/lib/api-client'

export const sapApi = {
  deduct: (action: string) => api.post('/api/sap/deduct', { action }),
  preview: (action: string) => api.get(`/api/sap/preview?action=${encodeURIComponent(action)}`),
}

export const billingApi = {
  getAccess: () => api.get('/api/user/access'),
  redeemPromo: (code: string) => api.post('/api/promo/redeem', { code }),
  getProducts: () => api.get('/api/billing/products'),
  createCheckoutSession: (data: Record<string, unknown>) =>
    api.post('/api/billing/create-checkout-session', data),

  // Admin
  listPromoCodes: () => api.get('/api/promo/codes'),
  createPromoCode: (data: Record<string, unknown>) => api.post('/api/promo/codes/create', data),
  updatePromoCode: (data: Record<string, unknown>) => api.post('/api/promo/codes/update', data),
  deletePromoCode: (id: number) => api.post('/api/promo/codes/delete', { id }),
  listRedemptions: (params?: Record<string, unknown>) => {
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ) as Record<string, string>
    ).toString()
    return api.get(`/api/promo/redemptions${q ? '?' + q : ''}`)
  },
  getUserRedemptions: (userId: number) =>
    api.get(`/api/promo/user-redemptions?user_id=${userId}`),
  getUserUsage: (userId: number) =>
    api.get(`/api/admin/user-usage?user_id=${userId}`),
  adminAssignAccess: (data: Record<string, unknown>) =>
    api.post('/api/promo/admin-assign', data),
  removeRedemption: (id: number) =>
    api.post('/api/promo/remove-redemption', { id }),
  adminCreditUsage: (
    userId: number,
    credits: Record<string, number>
  ) =>
    api.post('/api/admin/credit-usage', { user_id: userId, ...credits }),
  adminCreditSap: (
    userId: number,
    { sablier = 0, cristal = 0 }: { sablier?: number; cristal?: number }
  ) =>
    api.post('/api/admin/credit-sap', { user_id: userId, sablier, cristal }),
}
