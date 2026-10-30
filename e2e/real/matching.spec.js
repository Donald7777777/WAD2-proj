// Core feature: wants and smart matching
import { test, expect, uid } from './fixtures.js'

test('adding a want brings matching listings into "Fresh matches"', async ({ makeUser }) => {
  const owner = await makeUser('Owner')
  const seeker = await makeUser('Seeker')
  const token = `zzwant${uid()}` // unique word, so only this one listing can match
  const listing = await owner.createListing({ title: `Vintage radio ${token}`, category: 'Tech' })

  // Before adding the want there is nothing for this word
  await seeker.page.goto('/discover')
  await expect(seeker.page.getByRole('heading', { name: 'Fresh matches for you' })).toBeVisible()
  // (the listing is in the big "Browse listings" grid below, but not in the matches strip yet)
  const matches = seeker.page.locator('section.th-matches')
  await expect(matches.getByRole('link', { name: listing.title })).toHaveCount(0)

  // Add the want on the profile page and save
  await seeker.page.goto('/profile?tab=wants')
  await seeker.page.getByLabel('Add a keyword').fill(token)
  await seeker.page.getByRole('button', { name: 'Add', exact: true }).click()
  await seeker.page.getByRole('button', { name: 'Save wants' }).click()
  await expect(seeker.page.getByText('Saved!')).toBeVisible()

  // The listing now appears as a match, with a score
  await seeker.page.goto('/discover')
  await expect(matches.getByRole('link', { name: listing.title })).toBeVisible()
  await expect(matches.getByText(/\d+% match/)).toBeVisible()
})

test('a want can be removed again', async ({ makeUser }) => {
  const user = await makeUser('Remover')
  const word = `zzgone${uid()}`
  await user.page.goto('/profile?tab=wants')
  await user.page.getByLabel('Add a keyword').fill(word)
  await user.page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(user.page.getByText(word)).toBeVisible()
  await user.page.getByRole('button', { name: `Remove ${word}` }).click()
  await expect(user.page.getByText(word)).toHaveCount(0)
})
