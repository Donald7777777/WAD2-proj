import { test, expect } from '@playwright/test'
import { mockApi } from './helpers/mockApi.js'

test.describe('logged-in user', () => {
  test('can create a listing and see its detail page', async ({ page }) => {
    await mockApi(page, { loggedIn: true })
    await page.goto('/listings/new')

    await expect(page.getByRole('heading', { name: 'List an item' })).toBeVisible()
    await page.getByLabel('Title').fill('Fujifilm Instax Mini 11')
    await page.getByLabel('Category').selectOption('Cameras')
    await page.getByLabel('Condition').selectOption('Like new')
    await page.getByLabel('Description').fill('Used twice, comes with the strap.')
    await page.getByLabel(/What would you take for it/).fill('bluetooth speaker')
    await page.getByRole('button', { name: 'Create listing' }).click()

    await expect(page).toHaveURL(/\/listings\/l?\d+$/)
    await expect(page.getByRole('heading', { name: 'Fujifilm Instax Mini 11' })).toBeVisible()
    await expect(page.getByText('Your listing')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit listing' })).toBeVisible()
  })

  test('new listing shows up on My listings', async ({ page }) => {
    const api = await mockApi(page, { loggedIn: true })
    await page.goto('/listings/new')
    await page.getByLabel('Title').fill('Old guitar')
    await page.getByLabel('Category').selectOption('Music')
    await page.getByLabel('Condition').selectOption('Good')
    await page.getByLabel('Description').fill('Needs new strings.')
    await page.getByRole('button', { name: 'Create listing' }).click()
    await expect(page).toHaveURL(/\/listings\//)

    await page.goto('/my-listings')
    await expect(page.getByText('Old guitar')).toBeVisible()
    expect(api.listings[0].title).toBe('Old guitar')
  })

  test('cannot submit the form without a title', async ({ page }) => {
    await mockApi(page, { loggedIn: true })
    await page.goto('/listings/new')
    await page.getByRole('button', { name: 'Create listing' }).click()
    await expect(page).toHaveURL(/\/listings\/new/) // browser blocked the empty required field
  })

  test('someone else’s listing offers a trade', async ({ page }) => {
    await mockApi(page, { loggedIn: true })
    await page.goto('/listings/l1')
    await expect(page.getByRole('link', { name: 'Offer a trade' })).toBeVisible()
  })

  test('can log out from the account menu', async ({ page }) => {
    await mockApi(page, { loggedIn: true })
    await page.goto('/discover')
    await page.getByRole('button', { name: /Account menu for Theo Tan/ }).click()
    await page.getByRole('button', { name: 'Log out' }).click()

    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()
    await page.goto('/trades')
    await expect(page).toHaveURL(/\/login/)
  })
})
