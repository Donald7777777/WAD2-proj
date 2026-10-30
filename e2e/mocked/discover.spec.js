import { test, expect } from '@playwright/test'
import { mockApi } from './helpers/mockApi.js'

test.describe('discover / browse listings', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto('/discover')
  })

  test('lists all items up for trade', async ({ page }) => {
    await expect(page.getByText('3 items up for trade')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Canon AE-1 Program' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Logitech MX Keys keyboard' })).toBeVisible()
  })

  test('search narrows the list', async ({ page }) => {
    await page.getByLabel('Search listings').fill('canon')
    await page.getByLabel('Search listings').press('Enter')
    await expect(page.getByRole('link', { name: 'Canon AE-1 Program' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Logitech MX Keys keyboard' })).toHaveCount(0)
    await expect(page.getByText('1 item up for trade')).toBeVisible()
  })

  test('category chip filters the list', async ({ page }) => {
    await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Music' }).click()
    await expect(page.getByRole('link', { name: 'Vinyl record collection' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Canon AE-1 Program' })).toHaveCount(0)
  })

  test('opening a card shows the listing detail', async ({ page }) => {
    await page.getByRole('link', { name: 'Canon AE-1 Program' }).click()
    await expect(page).toHaveURL(/\/listings\/l1$/)
    await expect(page.getByRole('heading', { name: 'Canon AE-1 Program' })).toBeVisible()
    await expect(page.getByText('turntable')).toBeVisible()
  })

  test('logged-out visitor is sent to login to offer a trade', async ({ page }) => {
    await page.goto('/listings/l1')
    await page.getByRole('main').getByRole('link', { name: /Log in/ }).click()
    await expect(page).toHaveURL(/\/login\?redirect=\/listings\/l1/)
  })
})
