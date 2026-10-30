import { test, expect } from '@playwright/test'
import { mockApi } from './helpers/mockApi.js'

test.describe('register', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto('/register')
  })

  async function fill(page, { name = 'Ann Lee', email = 'ann@example.com', password = 'secret123', confirm = 'secret123' } = {}) {
    await page.getByLabel('Name').fill(name)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm password').fill(confirm)
    await page.getByRole('button', { name: 'Sign up' }).click()
  }

  test('new user is sent to set their wants', async ({ page }) => {
    await fill(page)
    await expect(page).toHaveURL(/\/profile\?tab=wants/)
  })

  test('mismatched passwords show an error', async ({ page }) => {
    await fill(page, { confirm: 'different123' })
    await expect(page.getByRole('alert')).toHaveText('Passwords do not match.')
    await expect(page).toHaveURL(/\/register/)
  })

  test('email already in use shows the server error', async ({ page }) => {
    await fill(page, { email: 'theo@demo.com' })
    await expect(page.getByRole('alert')).toContainText('already registered')
  })
})
