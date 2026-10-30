// Core feature: accounts (register, log in, log out, protected pages)
import { test, expect } from './fixtures.js'

test.describe('accounts', () => {
  test('a new user can register, log out and log back in', async ({ makeUser }) => {
    const user = await makeUser('Reg', { register: false })
    const { page } = user

    // Register through the form
    await page.goto('/register')
    await page.getByLabel('Name').fill(user.name)
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password', { exact: true }).fill(user.password)
    await page.getByLabel('Confirm password').fill(user.password)
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page).toHaveURL(/\/profile\?tab=wants/)
    await expect(page.getByRole('button', { name: `Account menu for ${user.name}` })).toBeVisible()

    // Log out from the account menu
    await page.getByRole('button', { name: `Account menu for ${user.name}` }).click()
    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()

    // Log back in
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password', { exact: true }).fill(user.password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/discover/)
    await expect(page.getByRole('button', { name: `Account menu for ${user.name}` })).toBeVisible()
  })

  test('wrong password is rejected', async ({ makeUser }) => {
    const user = await makeUser('Wrong', { register: false })
    await user.api('POST', '/auth/register', { name: user.name, email: user.email, password: user.password })
    await user.api('POST', '/auth/logout')

    await user.page.goto('/login')
    await user.page.getByLabel('Email').fill(user.email)
    await user.page.getByLabel('Password', { exact: true }).fill('not-the-password')
    await user.page.getByRole('button', { name: 'Log in' }).click()
    await expect(user.page.getByRole('alert')).toHaveText('Incorrect email or password.')
    await expect(user.page).toHaveURL(/\/login/)
  })

  test('registering with an email that is already used shows an error', async ({ makeUser }) => {
    const existing = await makeUser('Taken')
    const user = await makeUser('Copy', { register: false })

    await user.page.goto('/register')
    await user.page.getByLabel('Name').fill(user.name)
    await user.page.getByLabel('Email').fill(existing.email)
    await user.page.getByLabel('Password', { exact: true }).fill(user.password)
    await user.page.getByLabel('Confirm password').fill(user.password)
    await user.page.getByRole('button', { name: 'Sign up' }).click()
    await expect(user.page.getByRole('alert')).toHaveText('An account with this email already exists.')
  })

  test('logged-out visitors are sent to login, then back to the page they wanted', async ({ makeUser }) => {
    const user = await makeUser('Guard', { register: false })
    await user.api('POST', '/auth/register', { name: user.name, email: user.email, password: user.password })
    await user.api('POST', '/auth/logout')

    await user.page.goto('/trades')
    await expect(user.page).toHaveURL(/\/login\?redirect=\/trades/)

    await user.page.getByLabel('Email').fill(user.email)
    await user.page.getByLabel('Password', { exact: true }).fill(user.password)
    await user.page.getByRole('button', { name: 'Log in' }).click()
    await expect(user.page).toHaveURL(/\/trades$/)
    await expect(user.page.getByRole('heading', { name: 'My trades' })).toBeVisible()
  })
})
