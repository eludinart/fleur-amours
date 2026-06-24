import { test, expect } from '@playwright/test'

const email = process.env.SMOKE_EMAIL || process.env.SMOKE_LOGIN || ''
const password = process.env.SMOKE_PASSWORD || ''

test.describe('Parcours session', () => {
  test.skip(!email || !password, 'SMOKE_EMAIL et SMOKE_PASSWORD requis')

  test('liste des sessions accessible @auth', async ({ request }) => {
    const loginRes = await request.post('api/auth/login', {
      data: { login: email, password },
    })
    expect(loginRes.ok()).toBeTruthy()
    const { token } = await loginRes.json()

    const res = await request.get('api/sessions/list', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data).toHaveProperty('items')
  })

  test('statut IA accessible pour utilisateur connecté @auth', async ({ request }) => {
    const loginRes = await request.post('api/auth/login', {
      data: { login: email, password },
    })
    const { token } = await loginRes.json()
    const res = await request.get('api/ai/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(data).toHaveProperty('ok')
  })
})
