import { api } from '@/lib/api-client'

// ⚠ STUB : les routes /api/promo/* n'ont pas de handler Next.js dédié.
// Implémenter next/src/app/api/promo/**/route.ts pour une persistance réelle.
const warnPromoStub = (fn: string) =>
  console.warn(`[billing/promo] ${fn} : route stub (pas de backend réel)`)

type SapPreviewResult = {
  ok: boolean
  available: boolean
  cost: number
  balance: number
  from_sablier: number
  from_cristal: number
}

export const sapApi = {
  deduct: (action: string) => api.post('/api/sap/deduct', { action }),
  balance: () =>
    api.get('/api/sap/balance') as Promise<{ success: boolean; data?: { balance: number }; error?: string }>,
  preview: async (action: string): Promise<SapPreviewResult> => {
    const r = (await api.get(`/api/sap/preview?action=${encodeURIComponent(action)}`)) as {
      success?: boolean
      data?: { ok?: boolean; available?: boolean; cost?: number; balance?: number }
    }
    const d = r?.data
    if (r?.success && d) {
      const cost = d.cost ?? 0
      return {
        ok: d.ok ?? true,
        available: !!d.available,
        cost,
        balance: d.balance ?? 0,
        from_sablier: cost,
        from_cristal: 0,
      }
    }
    return { ok: false, available: false, cost: 0, balance: 0, from_sablier: 0, from_cristal: 0 }
  },
  bonusPatient: (patientUserId: number, amount: number, reason?: string) =>
    api.post('/api/sap/bonus', { patient_user_id: patientUserId, amount, reason }),
}

export const billingApi = {
  getAccess: () => api.get('/api/user/access'),
  redeemPromo: (code: string) => {
    warnPromoStub('redeemPromo'); return api.post('/api/promo/redeem', { code })
  },
  getProducts: () => api.get('/api/billing/products'),
  createCheckoutSession: (data: Record<string, unknown>) =>
    api.post('/api/billing/create-checkout-session', data),

  // Admin — routes promo (stubs, pas de handler dédié)
  listPromoCodes: () => { warnPromoStub('listPromoCodes'); return api.get('/api/promo/codes') },
  createPromoCode: (data: Record<string, unknown>) => {
    warnPromoStub('createPromoCode'); return api.post('/api/promo/codes/create', data)
  },
  updatePromoCode: (data: Record<string, unknown>) => {
    warnPromoStub('updatePromoCode'); return api.post('/api/promo/codes/update', data)
  },
  deletePromoCode: (id: number) => {
    warnPromoStub('deletePromoCode'); return api.post('/api/promo/codes/delete', { id })
  },
  listRedemptions: (params?: Record<string, unknown>) => {
    warnPromoStub('listRedemptions')
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
      ) as Record<string, string>
    ).toString()
    return api.get(`/api/promo/redemptions${q ? '?' + q : ''}`)
  },
  getUserRedemptions: (userId: number) => {
    warnPromoStub('getUserRedemptions'); return api.get(`/api/promo/user-redemptions?user_id=${userId}`)
  },
  getUserUsage: (userId: number) =>
    api.get(`/api/admin/user-usage?user_id=${userId}`),
  adminAssignAccess: (data: Record<string, unknown>) => {
    warnPromoStub('adminAssignAccess'); return api.post('/api/promo/admin-assign', data)
  },
  removeRedemption: (id: number) => {
    warnPromoStub('removeRedemption'); return api.post('/api/promo/remove-redemption', { id })
  },
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
