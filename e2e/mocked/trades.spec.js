import { test, expect } from '@playwright/test'
import { mockApi } from './helpers/mockApi.js'

test('trades page shows an empty state for a new account', async ({ page }) => {
  await mockApi(page, { loggedIn: true })
  await page.goto('/trades')
  await expect(page.getByRole('heading', { name: 'My trades' })).toBeVisible()
  await expect(page.getByText('Nothing here')).toBeVisible()
})
