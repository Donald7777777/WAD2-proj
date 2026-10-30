// Core feature: find people and view their public profile
import { test, expect } from './fixtures.js'

test('search for a person by name and open their profile', async ({ makeUser }) => {
  const target = await makeUser('Findable')
  const searcher = await makeUser('Searcher')
  const listing = await target.createListing({ title: `Profile item ${target.id}` })

  await searcher.page.goto('/people')
  await searcher.page.getByLabel('Search people by name').fill(target.name)
  const card = searcher.page.getByRole('link', { name: new RegExp(target.name) })
  await expect(card).toBeVisible()
  await card.click()

  await expect(searcher.page).toHaveURL(/\/users\/[0-9a-f]{24}/)
  await expect(searcher.page.getByText(target.name).first()).toBeVisible()
  await expect(searcher.page.getByRole('link', { name: listing.title })).toBeVisible()
})

test('searching for a name nobody has shows an empty message', async ({ makeUser }) => {
  const user = await makeUser('Nobody')
  await user.page.goto('/people')
  await user.page.getByLabel('Search people by name').fill('zzzznobodyhasthisname')
  await expect(user.page.getByText('No one called')).toBeVisible()
})
