import { test, expect } from '@playwright/test'

const email = process.env.SMOKE_EMAIL || process.env.SMOKE_LOGIN || ''
const password = process.env.SMOKE_PASSWORD || ''

async function loginViaApi(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post('/api/auth/login', {
    data: { login: email, password },
  })
  expect(res.ok()).toBeTruthy()
  const { token } = await res.json()
  return token as string
}

test.describe('Grand Jardin / Prairie', () => {
  test.skip(!email || !password, 'SMOKE_EMAIL et SMOKE_PASSWORD requis')

  test('API prairie retourne des fleurs @auth', async ({ request }) => {
    const token = await loginViaApi(request)
    const res = await request.get('/api/prairie/fleurs', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data.fleurs)).toBe(true)
  })

  test('page prairie charge la galaxie @auth', async ({ page, request }) => {
    const token = await loginViaApi(request)
    await page.goto('/login')
    await page.evaluate((t) => localStorage.setItem('auth_token', t), token)
    await page.goto('/prairie')

    await expect(page.locator('body')).toBeVisible({ timeout: 30_000 })
    const hasGalaxy = await page.locator('canvas').count()
    const hasLoading = await page.getByText(/chargement|loading|galaxie/i).count()
    expect(hasGalaxy + hasLoading).toBeGreaterThan(0)
  })
})
