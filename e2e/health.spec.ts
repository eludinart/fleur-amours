import { test, expect } from '@playwright/test'

test.describe('API publique @public', () => {
  test('health répond ok', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.api).toBe('fleur')
  })
})

test.describe('Pages publiques @public', () => {
  test('page login accessible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('form')).toBeVisible()
    await expect(page.getByRole('button', { name: /Se connecter|Connect|Login/i })).toBeVisible()
  })

  test('landing ou redirection auth', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBeLessThan(500)
  })
})
