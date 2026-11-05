// Show/hide password buttons, and the full-screen photo viewer
import { test, expect } from '@playwright/test'
import { mockApi } from './helpers/mockApi.js'

test('login: the eye button shows and hides the password', async ({ page }) => {
  await mockApi(page)
  await page.goto('/login')
  const box = page.getByLabel('Password', { exact: true })
  await box.fill('Secret-123')
  await expect(box).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show characters' }).click()
  await expect(box).toHaveAttribute('type', 'text')
  await expect(box).toHaveValue('Secret-123')
  await page.getByRole('button', { name: 'Hide characters' }).click()
  await expect(box).toHaveAttribute('type', 'password')
})

test('sign up: both password boxes have their own eye button', async ({ page }) => {
  await mockApi(page)
  await page.goto('/register')
  await expect(page.getByRole('button', { name: 'Show characters' })).toHaveCount(2)
  await page.getByLabel('Confirm password').fill('Abc!defg1')
  await page.getByRole('button', { name: 'Show characters' }).nth(1).click()
  await expect(page.getByLabel('Confirm password')).toHaveAttribute('type', 'text')
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')
})

const dot = (color) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${color}"/></svg>`)}`

test('listing photo opens full screen, can be paged and closed', async ({ page }) => {
  const state = await mockApi(page, { loggedIn: true })
  const listing = state.listings[0]
  listing.images = [{ url: dot('#cc4444') }, { url: dot('#4466cc') }]
  listing.imageUrl = listing.images[0].url
  await page.goto(`/listings/${listing._id}`)

  await page.getByRole('button', { name: 'View photo full screen' }).click()
  const viewer = page.getByRole('dialog', { name: /photo viewer/ })
  await expect(viewer).toBeVisible()
  await expect(viewer.getByText('1 / 2')).toBeVisible()
  await viewer.getByRole('button', { name: 'Next photo' }).click()
  await expect(viewer.getByText('2 / 2')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(viewer).toHaveCount(0)

  // Clicking the photo itself works too, and the backdrop closes it
  await page.locator('.th-gallery-main img').click()
  await expect(viewer).toBeVisible()
  await viewer.click({ position: { x: 5, y: 300 } })
  await expect(viewer).toHaveCount(0)
})
