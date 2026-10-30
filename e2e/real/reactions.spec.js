// Core feature: like and save listings
import { test, expect } from './fixtures.js'

test('like and save a listing, then find it on your profile', async ({ makeUser }) => {
  const owner = await makeUser('Owner')
  const fan = await makeUser('Fan')
  const listing = await owner.createListing({ title: `Likeable thing ${owner.id}` })

  await fan.page.goto(`/listings/${listing._id}`)
  const like = fan.page.getByRole('button', { name: 'Like', exact: true })
  const save = fan.page.getByRole('button', { name: 'Save', exact: true })

  // Wait for each click to be saved on the server before the next one (a second click while the first is
  // still being saved is ignored by the buttons)
  const saved = (name) => fan.page.waitForResponse((r) => r.url().endsWith(`/${name}`) && r.request().method() === 'POST')
  await Promise.all([saved('like'), like.click()])
  await expect(fan.page.getByRole('button', { name: 'Unlike' })).toHaveAttribute('aria-pressed', 'true')
  await Promise.all([saved('save'), save.click()])
  await expect(fan.page.getByRole('button', { name: 'Remove from saved' })).toHaveAttribute('aria-pressed', 'true')

  // Still liked and saved after a reload (it is stored on the server)
  await fan.page.reload()
  await expect(fan.page.getByRole('button', { name: 'Unlike' })).toHaveAttribute('aria-pressed', 'true')
  await expect(fan.page.getByRole('button', { name: 'Remove from saved' })).toHaveAttribute('aria-pressed', 'true')

  // Listed under Liked and Saved on the profile
  for (const tab of ['liked', 'saved']) {
    await fan.page.goto(`/profile?tab=${tab}`)
    await expect(fan.page.getByRole('link', { name: listing.title })).toBeVisible()
  }

  // The owner is told on the Likes page
  await owner.page.goto('/activity')
  await expect(owner.page.getByRole('heading', { name: 'Likes on my listings' })).toBeVisible()
  await expect(owner.page.getByText(listing.title).first()).toBeVisible()
})

test('you cannot like your own listing', async ({ makeUser }) => {
  const owner = await makeUser('Self')
  const listing = await owner.createListing()
  await owner.page.goto(`/listings/${listing._id}`)
  await expect(owner.page.getByRole('button', { name: /^\d+ likes$/ })).toBeDisabled()
})
