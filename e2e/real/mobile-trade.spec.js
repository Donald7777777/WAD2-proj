// Phones: an accepted trade is split into a hub plus one page each for meetup, checklist and chat
import { test, expect, setUpTrade, dismissDealPopup } from './fixtures.js'

test('phone: accepted trade shows a hub that opens meetup, checklist and chat pages', async ({ makeUser }) => {
  const seller = await makeUser('Seller')
  const buyer = await makeUser('Buyer')
  const { trade } = await setUpTrade(seller, buyer, { accept: true })
  const page = seller.page
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/trades/${trade._id}`)
  await dismissDealPopup(page) // on a phone this button opens the meetup page, so go back to the hub
  await page.goto(`/trades/${trade._id}`)

  const hub = page.getByRole('navigation', { name: 'Trade pages' })
  await expect(hub).toBeVisible()
  await expect(page.getByRole('region', { name: 'The trade' })).toBeVisible()
  // The long sections are not on the hub
  await expect(page.getByRole('heading', { name: /Chat with/ })).toHaveCount(0)
  await expect(hub.getByText('Not chosen yet')).toBeVisible()

  // Meetup page
  await hub.getByRole('button', { name: /Meetup point and time/ }).click()
  await expect(page).toHaveURL(new RegExp(`/trades/${trade._id}/meetup$`))
  await expect(page.locator('h2.th-sub-title', { hasText: 'Meetup point and time' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'The trade' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Chat with/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Back to trade' }).click()
  await expect(hub).toBeVisible()

  // Checklist page
  await hub.getByRole('button', { name: /Inspection checklist/ }).click()
  await expect(page).toHaveURL(new RegExp(`/trades/${trade._id}/checklist$`))
  await expect(page.locator('h2.th-sub-title', { hasText: 'Inspection checklist' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to trade' }).click()

  // Chat page: send a message
  await hub.getByRole('button', { name: /Chat/ }).click()
  await expect(page).toHaveURL(new RegExp(`/trades/${trade._id}/chat$`))
  await expect(page.getByRole('heading', { name: /Chat with/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to trade' })).toBeVisible()
  await page.getByLabel('Message', { exact: true }).fill('On my way')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('On my way')).toBeVisible()
  // The chat is a full-screen page: the bottom tab bar is hidden, and the back arrow returns to the hub
  await page.getByRole('link', { name: 'Back to trade' }).click()
  await expect(hub).toBeVisible()
})

test('desktop: accepted trade keeps everything on one page', async ({ makeUser }) => {
  const seller = await makeUser('Seller')
  const buyer = await makeUser('Buyer')
  const { trade } = await setUpTrade(seller, buyer, { accept: true })
  const page = seller.page
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(`/trades/${trade._id}`)
  await dismissDealPopup(page)
  await expect(page.getByRole('navigation', { name: 'Trade pages' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Chat with/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'The trade' })).toBeVisible()
})
