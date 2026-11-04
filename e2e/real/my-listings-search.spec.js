// Core feature: My listings (search, and available items listed first)
import { test, expect, setUpTrade } from './fixtures.js'

const titles = (page) => page.locator('h3.th-listing-title').allTextContents()

test('search your own listings by name, category or status', async ({ makeUser }) => {
  const owner = await makeUser('Owner')
  const buyer = await makeUser('Buyer')
  const bike = await owner.createListing({ title: `Red bicycle ${owner.id}`, category: 'Sports' })
  const guitar = await owner.createListing({ title: `Silver guitar ${owner.id}`, category: 'Music' })
  const books = await owner.createListing({ title: `Paper books ${owner.id}`, category: 'Books' })
  // One more item that ends up "reserved" (in an accepted trade). It is the newest listing.
  const { requested: reserved } = await setUpTrade(owner, buyer, { accept: true })

  const page = owner.page
  await page.goto('/my-listings')
  const search = page.getByLabel('Search your listings')
  await expect(page.getByRole('link', { name: guitar.title })).toBeVisible()

  // By name
  await search.fill('guitar')
  await expect(page.getByRole('link', { name: guitar.title })).toBeVisible()
  await expect(page.getByRole('link', { name: bike.title })).toHaveCount(0)
  await expect(page.getByText('1 of 4')).toBeVisible()

  // By category (the word "Music" is not in the title)
  await search.fill('music')
  await expect(page.getByRole('link', { name: guitar.title })).toBeVisible()
  await expect(page.getByRole('link', { name: books.title })).toHaveCount(0)

  // By status
  await search.fill('reserved')
  await expect(page.getByRole('link', { name: reserved.title })).toBeVisible()
  await expect(page.getByText('1 of 4')).toBeVisible()
  await expect(page.getByRole('link', { name: guitar.title })).toHaveCount(0)

  // Every word has to match
  await search.fill('silver bicycle')
  await expect(page.getByText(/No listings match/)).toBeVisible()

  // Nothing found: message, then clear the search to get everything back
  await search.fill('zzzz')
  await expect(page.getByText('No listings match "zzzz"')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByRole('link', { name: bike.title })).toBeVisible()
  await expect(page.getByRole('link', { name: reserved.title })).toBeVisible()
})

test('available items come first, reserved items last', async ({ makeUser }) => {
  const owner = await makeUser('Owner')
  const buyer = await makeUser('Buyer')
  const first = await owner.createListing({ title: `Older item ${owner.id}` })
  const second = await owner.createListing({ title: `Newer item ${owner.id}` })
  const { requested: reserved } = await setUpTrade(owner, buyer, { accept: true }) // newest, but reserved

  await owner.page.goto('/my-listings')
  await expect(owner.page.getByRole('link', { name: reserved.title })).toBeVisible()
  const order = (await titles(owner.page)).map((t) => t.trim())
  expect(order).toEqual([second.title, first.title, reserved.title])
})

test('the search box is hidden until you have a listing', async ({ makeUser }) => {
  const owner = await makeUser('Empty')
  await owner.page.goto('/my-listings')
  await expect(owner.page.getByLabel('Search your listings')).toHaveCount(0)
})
