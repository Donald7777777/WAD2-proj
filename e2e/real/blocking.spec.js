// Core feature: blocking someone. An accepted trade stays open, but chat between you is switched off.
import { test, expect, setUpTrade, dismissDealPopup, acceptNextDialog } from './fixtures.js'

test('block someone you have an accepted trade with: chat is off, the trade carries on', async ({ makeUser }) => {
  const seller = await makeUser('Seller')
  const buyer = await makeUser('Buyer')
  const { trade } = await setUpTrade(seller, buyer, { accept: true })

  // Block from their profile (the browser asks to confirm)
  await seller.page.goto(`/users/${buyer.profile._id}`)
  acceptNextDialog(seller.page)
  await seller.page.getByRole('button', { name: 'Block', exact: true }).click()
  await expect(seller.page.getByText('Accepted trade still open')).toBeVisible()
  await expect(seller.page.getByRole('status').filter({ hasText: `You've blocked ${buyer.name}` })).toBeVisible()

  // The trade page explains why chat is off, and the message box is disabled
  await seller.page.goto(`/trades/${trade._id}`)
  await dismissDealPopup(seller.page)
  await expect(seller.page.getByText(/so chat is off/)).toBeVisible()
  await expect(seller.page.getByLabel('Message', { exact: true })).toBeDisabled()
  await expect(seller.page.getByText('Changed your mind? You can cancel here.')).toBeVisible()

  // The checklist still works
  const first = seller.page.getByRole('region', { name: 'Inspection checklist' }).getByRole('checkbox').first()
  await Promise.all([
    seller.page.waitForResponse((r) => r.url().includes('/checklist') && r.request().method() === 'PUT'),
    first.check(),
  ])
  await expect(first).toBeChecked()

  // The other person cannot send a message either (the server refuses it)
  const response = await buyer.context.request.post(`/api/trades/${trade._id}/messages`, { data: { text: 'hello?' } })
  expect(response.status()).toBe(403)
  expect((await response.json()).error).toContain('Chat is turned off')
})

test('unblocking from Account settings', async ({ makeUser }) => {
  const user = await makeUser('Blocker')
  const other = await makeUser('Blocked')
  await user.api('POST', `/users/${other.profile._id}/block`)

  await user.page.goto('/account')
  const section = user.page.getByRole('region', { name: 'Blocked people' })
  await expect(section.getByText(other.name)).toBeVisible()
  await section.getByRole('button', { name: 'Unblock' }).click()
  await expect(user.page.getByText(`${other.name} is unblocked.`)).toBeVisible()
  await expect(section.getByText("You haven't blocked anyone.")).toBeVisible()
})

test('a blocked person cannot propose a trade for your item', async ({ makeUser }) => {
  const seller = await makeUser('Seller')
  const buyer = await makeUser('Buyer')
  const item = await seller.createListing({ title: `Blocked item ${seller.id}` })
  const mine = await buyer.createListing()
  await seller.api('POST', `/users/${buyer.profile._id}/block`)

  const response = await buyer.context.request.post('/api/trades', {
    data: { requestedListingIds: [item._id], offeredListingIds: [mine._id] },
  })
  expect(response.status()).toBe(403)
})
