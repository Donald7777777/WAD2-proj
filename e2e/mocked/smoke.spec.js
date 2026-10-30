import { test, expect } from '@playwright/test'
import { mockApi } from './helpers/mockApi.js'

test('shows the login page', async ({ page }) => {
  await mockApi(page)
  await page.goto('/login')
  await expect(page.locator('h1')).toHaveText('Log in')
})
