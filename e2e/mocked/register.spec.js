import { test, expect } from '@playwright/test'
import { mockApi } from './helpers/mockApi.js'

test.describe('register', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto('/register')
  })

  async function fill(page, { name = 'Ann Lee', email = 'ann@example.com', password = 'Secret123!', confirm = 'Secret123!' } = {}) {
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
    await fill(page, { confirm: 'Different123!' })
    await expect(page.getByRole('alert')).toHaveText('Passwords do not match.')
    await expect(page).toHaveURL(/\/register/)
  })

  test('password needs 8 characters, a capital and a special character', async ({ page }) => {
    await fill(page, { password: 'Ab1!', confirm: 'Ab1!' })
    await expect(page.getByRole('alert')).toHaveText('Password must be at least 8 characters.')
    await fill(page, { password: 'secret123!', confirm: 'secret123!' })
    await expect(page.getByRole('alert')).toHaveText('Password must contain at least 1 capital letter.')
    await fill(page, { password: 'Secret1234', confirm: 'Secret1234' })
    await expect(page.getByRole('alert')).toContainText('Password must contain at least 1 special character')
    await expect(page).toHaveURL(/\/register/)
  })

  test('an email without a proper domain is rejected', async ({ page }) => {
    await fill(page, { email: 'ann@example' })
    await expect(page.getByRole('alert')).toHaveText('Please enter a valid email address.')
    await expect(page).toHaveURL(/\/register/)
  })

  test('email already in use shows the server error', async ({ page }) => {
    await fill(page, { email: 'theo@demo.com' })
    await expect(page.getByRole('alert')).toContainText('already registered')
  })
})
