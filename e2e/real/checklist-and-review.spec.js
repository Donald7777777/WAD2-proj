// Core features: inspection checklist, confirming the handover (trade complete), and reviews
import { test, expect, setUpTrade, dismissDealPopup } from './fixtures.js'

async function tickEverything(page) {
  const checklist = page.getByRole('region', { name: 'Inspection checklist' })
  const boxes = checklist.getByRole('checkbox')
  await expect(boxes.first()).toBeVisible() // count() does not wait, so wait for the list to load first
  const count = await boxes.count()
  expect(count).toBeGreaterThan(0)
  // One box at a time, waiting for each save, so the test also checks every tick reaches the server
  for (let i = 0; i < count; i++) {
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/checklist') && r.request().method() === 'PUT'),
      boxes.nth(i).check(),
    ])
  }
  return checklist
}

test('both people tick the checklist and confirm, the trade completes, then they review each other', async ({ makeUser }) => {
  const seller = await makeUser('Seller')
  const buyer = await makeUser('Buyer')
  const { trade, offered } = await setUpTrade(seller, buyer, { accept: true })

  for (const user of [seller, buyer]) {
    await user.page.goto(`/trades/${trade._id}`)
    await dismissDealPopup(user.page)
    await expect(user.page.getByRole('heading', { name: 'Inspection checklist' })).toBeVisible()
  }

  // Confirm is locked until every box is ticked
  const sellerChecklist = seller.page.getByRole('region', { name: 'Inspection checklist' })
  await expect(sellerChecklist.getByRole('button', { name: 'Confirm handover' })).toBeDisabled()

  // Seller ticks everything and confirms
  await tickEverything(seller.page)
  await sellerChecklist.getByRole('button', { name: 'Confirm handover' }).click()
  await expect(sellerChecklist.getByRole('button', { name: 'Confirm handover' })).toHaveCount(0) // locked once confirmed
  await expect(seller.page.getByText(`${seller.name} confirmed the handover. Waiting for the other user.`)).toBeVisible()

  // Buyer ticks everything and confirms: the trade completes
  await buyer.page.reload()
  const buyerChecklist = await tickEverything(buyer.page)
  await expect(buyerChecklist.getByText(`${seller.name} has confirmed.`)).toBeVisible()
  await buyerChecklist.getByRole('button', { name: 'Confirm handover' }).click()
  await expect(buyerChecklist.getByText('Trade complete.')).toBeVisible()

  // Both items are now marked Traded
  await buyer.page.goto('/my-listings')
  await expect(buyer.page.getByText('Traded', { exact: true }).first()).toBeVisible()
  await expect(buyer.page.getByRole('link', { name: offered.title })).toBeVisible()

  // Buyer reviews the seller from the trade page
  await buyer.page.goto(`/trades/${trade._id}`)
  const popup = buyer.page.getByRole('dialog')
  await popup.getByRole('button', { name: '5 stars' }).click()
  await popup.getByPlaceholder(/Say something about/).fill('Friendly and on time')
  await popup.getByRole('button', { name: 'Submit review' }).click()
  await expect(buyer.page.getByText(`You rated ${seller.name}`)).toBeVisible()

  // The seller sees the review on their own profile, with the rating
  await seller.page.goto('/profile?tab=reviews')
  await expect(seller.page.getByText('Friendly and on time')).toBeVisible()
})

test('the checklist is saved: ticks are still there after a reload', async ({ makeUser }) => {
  const seller = await makeUser('Seller')
  const buyer = await makeUser('Buyer')
  const { trade } = await setUpTrade(seller, buyer, { accept: true })

  await seller.page.goto(`/trades/${trade._id}`)
  await dismissDealPopup(seller.page)
  const checklist = seller.page.getByRole('region', { name: 'Inspection checklist' })
  const first = checklist.getByRole('checkbox').first()
  // The tick shows at once; wait for the server to save it before reloading
  await Promise.all([
    seller.page.waitForResponse((r) => r.url().includes('/checklist') && r.request().method() === 'PUT'),
    first.check(),
  ])
  await expect(first).toBeChecked()

  await seller.page.reload()
  await expect(seller.page.getByRole('region', { name: 'Inspection checklist' }).getByRole('checkbox').first()).toBeChecked()
})
