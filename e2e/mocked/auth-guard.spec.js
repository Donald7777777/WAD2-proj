import { test, expect } from '@playwright/test'
import { mockApi } from './helpers/mockApi.js'

const PROTECTED = ['/trades', '/profile', '/my-listings', '/listings/new', '/activity', '/account']

test.describe('protected pages when logged out', () => {
  for (const path of PROTECTED) {
    test(`${path} redirects to login`, async ({ page }) => {
      await mockApi(page)
      await page.goto(path)
      await expect(page).toHaveURL(/\/login\?redirect=/)
      await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
    })
  }

  test('after logging in, user returns to the page they wanted', async ({ page }) => {
    await mockApi(page)
    await page.goto('/trades')
    await page.getByLabel('Email').fill('theo@demo.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/trades$/)
    await expect(page.getByRole('heading', { name: 'My trades' })).toBeVisible()
  })

  test('public pages open without an account', async ({ page }) => {
    await mockApi(page)
    await page.goto('/discover')
    await expect(page).toHaveURL(/\/discover/)
    await page.goto('/people')
    await expect(page).toHaveURL(/\/people/)
  })
})
