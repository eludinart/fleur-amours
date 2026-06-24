import { test, expect } from '@playwright/test'

const email = process.env.SMOKE_EMAIL || process.env.SMOKE_LOGIN || ''
const password = process.env.SMOKE_PASSWORD || ''

test.describe('Authentification', () => {
  test.skip(!email || !password, 'SMOKE_EMAIL et SMOKE_PASSWORD requis (.env.smoke)')

  test('login et accès au tableau de bord @auth', async ({ page }) => {
    await page.goto('login')
    await page.getByRole('textbox').first().fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.getByRole('button', { name: /Se connecter|Connect|Login/i }).click()

    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
    await expect(page.locator('body')).not.toContainText(/identifiant ou mot de passe incorrect/i)
  })

  test('token API après login @auth', async ({ page, request }) => {
    const loginRes = await request.post('api/auth/login', {
      data: { login: email, password },
    })
    expect(loginRes.ok()).toBeTruthy()
    const { token } = await loginRes.json()
    expect(token).toBeTruthy()

    const meRes = await request.get('api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(meRes.ok()).toBeTruthy()
  })
})
