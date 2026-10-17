import { test, expect } from '@playwright/test'

// See here how to get started:
// https://playwright.dev/docs/intro
test('shows the login page', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('h1')).toHaveText('Log in')
})
