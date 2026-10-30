// Core feature: listings (create, browse and search, edit, delete)
import { test, expect, uid, acceptNextDialog } from './fixtures.js'

test.describe('listings', () => {
  test('create a listing, find it on Discover, edit it, then delete it', async ({ makeUser }) => {
    const owner = await makeUser('Lister')
    const { page } = owner
    const token = `zzlamp${uid()}`
    const title = `Brass lamp ${token}`

    // Create
    await page.goto('/listings/new')
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Category').selectOption('Home')
    await page.getByLabel('Condition').selectOption('Excellent')
    await page.getByLabel('Description').fill('Works perfectly, small scratch on the base.')
    await page.getByLabel(/What would you take for it/).fill('desk plant')
    await page.getByRole('button', { name: 'Create listing' }).click()
    await expect(page).toHaveURL(/\/listings\/[0-9a-f]{24}$/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByText('Your listing')).toBeVisible()

    // Shows up on My listings
    await page.goto('/my-listings')
    await expect(page.getByRole('link', { name: title })).toBeVisible()

    // Another user finds it with the search box on Discover
    const visitor = await makeUser('Visitor')
    await visitor.page.goto('/discover')
    await visitor.page.getByLabel('Search listings').fill(token)
    await visitor.page.getByLabel('Search listings').press('Enter')
    await expect(visitor.page.getByRole('link', { name: title })).toBeVisible()
    await expect(visitor.page.getByText('1 item up for trade')).toBeVisible()

    // Edit the title
    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit listing' })).toBeVisible()
    await page.getByLabel('Title').fill(`${title} (edited)`)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('heading', { name: `${title} (edited)` })).toBeVisible()

    // Delete it
    await page.goto('/my-listings')
    acceptNextDialog(page)
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('link', { name: `${title} (edited)` })).toHaveCount(0)
  })

  test('the category filter on Discover only shows that category', async ({ makeUser }) => {
    const owner = await makeUser('Cat')
    const visitor = await makeUser('Browser') // Discover hides your own listings, so someone else browses
    const token = `zzcat${uid()}`
    await owner.createListing({ title: `Guitar ${token}`, category: 'Music' })
    await owner.createListing({ title: `Camera ${token}`, category: 'Cameras' })

    await visitor.page.goto('/discover')
    await visitor.page.getByLabel('Search listings').fill(token)
    await visitor.page.getByLabel('Search listings').press('Enter')
    await expect(visitor.page.getByText('2 items up for trade')).toBeVisible()

    await visitor.page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Music' }).click()
    await expect(visitor.page.getByRole('link', { name: `Guitar ${token}` })).toBeVisible()
    await expect(visitor.page.getByRole('link', { name: `Camera ${token}` })).toHaveCount(0)
  })

  test('a listing needs a title, category, condition and description', async ({ makeUser }) => {
    const owner = await makeUser('Empty')
    await owner.page.goto('/listings/new')
    await owner.page.getByRole('button', { name: 'Create listing' }).click()
    // The browser blocks the empty required fields, so we stay on the form
    await expect(owner.page).toHaveURL(/\/listings\/new/)
  })
})
