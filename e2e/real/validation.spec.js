// Core feature: sign-up and password rules (checked in the browser AND again on the server)
import { test, expect } from './fixtures.js'

async function fillRegister(page, { name, email, password, confirm = password }) {
  await page.goto('/register')
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(confirm)
  await page.getByRole('button', { name: 'Sign up' }).click()
}

test.describe('sign-up rules', () => {
  const badPasswords = [
    ['too short', 'Ab1!', 'Password must be at least 8 characters.'],
    ['no capital letter', 'abcdef1!', 'Password must contain at least 1 capital letter.'],
    ['no special character', 'Abcdefg1', 'Password must contain at least 1 special character (e.g. ! @ # $).'],
  ]

  for (const [label, password, message] of badPasswords) {
    test(`password with ${label} is rejected`, async ({ makeUser }) => {
      const user = await makeUser('Weak', { register: false })
      await fillRegister(user.page, { name: user.name, email: user.email, password })
      await expect(user.page.getByRole('alert')).toHaveText(message)
      await expect(user.page).toHaveURL(/\/register/)
    })
  }

  test('the sign-up form shows the password rule', async ({ makeUser }) => {
    const user = await makeUser('Hint', { register: false })
    await user.page.goto('/register')
    await expect(user.page.getByText(/At least 8 characters, with 1 capital letter and 1 special character/)).toBeVisible()
  })

  test('an email without a dot after the @ is rejected', async ({ makeUser }) => {
    const user = await makeUser('Mail', { register: false })
    await fillRegister(user.page, { name: user.name, email: 'nobody@nodot', password: user.password })
    await expect(user.page.getByRole('alert')).toHaveText('Please enter a valid email address.')
  })

  test('a one-letter name is rejected', async ({ makeUser }) => {
    const user = await makeUser('Short', { register: false })
    await fillRegister(user.page, { name: 'A', email: user.email, password: user.password })
    await expect(user.page.getByRole('alert')).toHaveText('Your name should be 2 to 40 characters.')
  })

  test('two people cannot have the same name', async ({ makeUser }) => {
    const first = await makeUser('Twin')
    const second = await makeUser('Other', { register: false })
    await fillRegister(second.page, { name: first.name.toUpperCase(), email: second.email, password: second.password })
    await expect(second.page.getByRole('alert')).toContainText('is already called')
  })

  test('the server checks the rules too, not only the browser', async ({ makeUser }) => {
    const user = await makeUser('Direct', { register: false })
    const response = await user.context.request.post('/api/auth/register', {
      data: { name: user.name, email: user.email, password: 'weakpass' },
    })
    expect(response.status()).toBe(400)
    expect((await response.json()).error).toMatch(/capital letter|special character/)
  })
})

test.describe('change password', () => {
  async function fillChange(page, { current, next, again = next }) {
    await page.goto('/account')
    await page.getByLabel('Current password').fill(current)
    await page.getByLabel('New password', { exact: true }).fill(next)
    await page.getByLabel('New password again').fill(again)
    await page.getByRole('button', { name: 'Change password' }).click()
  }

  test('a weak new password is rejected', async ({ makeUser }) => {
    const user = await makeUser('Change')
    await fillChange(user.page, { current: user.password, next: 'abc' })
    // The browser itself blocks a too-short password (minlength 6), so nothing is sent
    const tooShort = await user.page.getByLabel('New password', { exact: true }).evaluate((el) => el.validity.tooShort)
    expect(tooShort).toBe(true)
    await expect(user.page).toHaveURL(/\/account/)
  })

  test('a valid new password works and the old one stops working', async ({ makeUser }) => {
    const user = await makeUser('Change')
    const next = 'Brand-new-pass-9'
    await fillChange(user.page, { current: user.password, next })
    await expect(user.page.getByText('Password changed.')).toBeVisible()

    const withNew = await user.context.request.post('/api/auth/login', { data: { email: user.email, password: next } })
    expect(withNew.status()).toBe(200)
    const withOld = await user.context.request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
    expect(withOld.status()).toBe(401)
  })

  test('the new password must be typed twice the same', async ({ makeUser }) => {
    const user = await makeUser('Change')
    await fillChange(user.page, { current: user.password, next: 'Brand-new-pass-9', again: 'Brand-new-pass-8' })
    await expect(user.page.getByText("The new passwords don't match.")).toBeVisible()
  })
})
