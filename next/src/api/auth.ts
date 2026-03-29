import { api } from '@/lib/api-client'

export const authApi = {
  login: (login: string, password: string) =>
    api.post('/api/auth/login', { login, password }) as Promise<{ token: string; user: Record<string, unknown> }>,
  register: (email: string, password: string, name = '', inviteToken?: string) =>
    api.post('/api/auth/register', { email, password, name, invite_token: inviteToken }) as Promise<{
      token: string
      user: Record<string, unknown>
    }>,
  refresh: () => api.post('/api/auth/refresh', {}) as Promise<{ token: string }>,
  logout: () => api.post('/api/auth/logout', {}) as Promise<{ ok: boolean }>,
  me: () => api.get('/api/auth/me') as Promise<Record<string, unknown>>,
  users: (params: { page?: number; per_page?: number; search?: string; role?: string } = {}) => {
    const p = new URLSearchParams()
    if (params.page) p.set('page', String(params.page))
    if (params.per_page) p.set('per_page', String(params.per_page))
    if (params.search) p.set('search', params.search)
    if (params.role) p.set('role', params.role)
    const qs = p.toString()
    return api.get(`/api/auth/users${qs ? '?' + qs : ''}`)
  },
  updateUser: (data: Record<string, unknown>) => api.post('/api/auth/users/update', data),
  deleteUser: (id: string) => api.post('/api/auth/users/delete', { id }),
  deleteMyAccount: () => api.post('/api/auth/account/delete'),
  getMyProfile: () => api.get('/api/account/profile'),
  updateMyProfile: (data: Record<string, unknown>) => api.post('/api/account/profile', data),
  impersonate: (userId: string) => api.post('/api/auth/admin/impersonate', { user_id: userId }),
}
