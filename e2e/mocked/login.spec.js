import { test, expect } from '@playwright/test'
import { mockApi } from './helpers/mockApi.js'

test.describe('login', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page)
    await page.goto('/login')
  })

  test('shows the login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  })

  test('valid account lands on Discover and shows the account menu', async ({ page }) => {
    await page.getByLabel('Email').fill('theo@demo.com')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page).toHaveURL(/\/discover/)
    await expect(page.getByRole('button', { name: /Account menu for Theo Tan/ })).toBeVisible()
  })

  test('wrong password shows an error and stays on the page', async ({ page }) => {
    await page.getByLabel('Email').fill('theo@demo.com')
    await page.getByLabel('Password', { exact: true }).fill('wrongpass')
    await page.getByRole('button', { name: 'Log in' }).click()

    await expect(page.getByRole('alert')).toContainText('Invalid email or password')
    await expect(page).toHaveURL(/\/login/)
  })

  test('has links to sign up and to reset a password', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign up' }).last().click()
    await expect(page).toHaveURL(/\/register/)
    await page.goBack()
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await expect(page).toHaveURL(/\/forgot-password/)
  })
})
