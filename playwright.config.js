import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

/**
 * Two kinds of E2E tests live in e2e/:
 *
 *   e2e/mocked  fast UI tests with a fake API (no backend, no database needed)
 *   e2e/real    the real thing: browser -> Vue app -> Express -> MongoDB, one spec file per core feature
 *
 * Run them:   pnpm test:e2e                  everything
 *             pnpm test:e2e --project=real   only the real-stack tests
 *             HEADED=1 pnpm test:e2e         watch the browser
 *
 * The real tests NEVER touch your normal data. Playwright starts its own copies of the app on its own ports
 * (Vite on 5174, Express on 8100) and points Express at a separate database called "tradehappy_e2e"
 * (same MongoDB server as server/config.env, different database name). Each test registers its own
 * brand new users and listings, so nothing needs resetting.
 */

const VITE_PORT = 5174
const API_PORT = 8100

// Work out the test database from server/config.env (or E2E_DB when set, e.g. in CI)
function testDatabaseUrl() {
  if (process.env.E2E_DB) return process.env.E2E_DB
  const file = path.resolve('server/config.env')
  const line = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DB=')) : ''
  const uri = (line || '').slice(3).trim()
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+\/)([^?]*)(\?.*)?$/)
  if (!match) {
    throw new Error('Could not find DB=... in server/config.env. Set E2E_DB to a MongoDB connection string for the tests.')
  }
  return `${match[1]}tradehappy_e2e${match[3] || ''}`
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: { timeout: 10000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? 'html' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: `http://localhost:${VITE_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Headless by default; run `HEADED=1 pnpm test:e2e` to watch the browser
    headless: !process.env.HEADED,
    // Demo mode (pnpm test:e2e:demo): watch the browser, slowed down, and save a video of every test
    video: process.env.DEMO ? 'on' : 'off',
    launchOptions: { slowMo: process.env.DEMO ? 400 : 0 },
  },

  projects: [
    { name: 'mocked', testDir: './e2e/mocked', use: { ...devices['Desktop Chrome'] } },
    { name: 'real', testDir: './e2e/real', timeout: 90 * 1000, use: { ...devices['Desktop Chrome'] } },
    // More browsers if you want them:
    // { name: 'firefox', testDir: './e2e/real', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', testDir: './e2e/real', use: { ...devices['Desktop Safari'] } },
  ],

  webServer: [
    // Express API on its own port, using the separate test database.
    // (Set E2E_NO_API=1 to skip it when you only run the mocked tests, e.g. without internet / MongoDB.)
    ...(process.env.E2E_NO_API
      ? []
      : [
          {
            command: 'node server.js',
            cwd: './server',
            url: `http://localhost:${API_PORT}/api/auth/me`,
            reuseExistingServer: !process.env.CI,
            timeout: 60 * 1000,
            env: { DB: testDatabaseUrl(), PORT: String(API_PORT) },
          },
        ]),
    {
      // Vue app (Vite). Its /api proxy points at the test API above.
      command: `npx vite --port ${VITE_PORT} --strictPort`,
      port: VITE_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
      env: {
        API_URL: `http://localhost:${API_PORT}`,
        // Fake Supabase settings: photo upload isn't tested, and tests must never touch the real project
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_ANON_KEY: 'e2e-test-key',
      },
    },
  ],
})
