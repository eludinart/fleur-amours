import { defineConfig, devices } from '@playwright/test'

const baseURL = `${(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001/jardin').replace(/\/+$/, '')}/`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.SMOKE_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run start --prefix next',
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          PORT: '3001',
          JWT_SECRET: process.env.JWT_SECRET || 'smoke-test-jwt-secret-min-32-chars-long',
          USE_NODE_API: 'true',
          NEXT_PUBLIC_BASE_PATH: '/jardin',
          MARIADB_HOST: process.env.MARIADB_HOST || '',
          MARIADB_PORT: process.env.MARIADB_PORT || '3306',
          MARIADB_DATABASE: process.env.MARIADB_DATABASE || '',
          MARIADB_USER: process.env.MARIADB_USER || '',
          MARIADB_PASSWORD: process.env.MARIADB_PASSWORD || '',
          OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
        },
      },
})
