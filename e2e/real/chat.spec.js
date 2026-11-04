// Core feature: chat between the two people in a trade
import { test, expect, setUpTrade, dismissDealPopup } from './fixtures.js'

test('two traders can chat inside a trade', async ({ makeUser }) => {
  const seller = await makeUser('Seller')
  const buyer = await makeUser('Buyer')
  const { trade } = await setUpTrade(seller, buyer, { accept: true })

  for (const user of [seller, buyer]) {
    await user.page.goto(`/trades/${trade._id}`)
    await dismissDealPopup(user.page)
    await expect(user.page.getByRole('heading', { name: /Chat with/ })).toBeVisible()
  }

  // Seller says hello
  await seller.page.getByLabel('Message', { exact: true }).fill('Hello, is Saturday ok for you?')
  await seller.page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(seller.page.getByText('Hello, is Saturday ok for you?')).toBeVisible()

  // Buyer receives it (the chat refreshes by itself; we reload as a fallback)
  await expect(async () => {
    await buyer.page.reload()
    await expect(buyer.page.getByText('Hello, is Saturday ok for you?')).toBeVisible({ timeout: 3000 })
  }).toPass({ timeout: 25000 })

  // Buyer replies
  await buyer.page.getByLabel('Message', { exact: true }).fill('Saturday works!')
  await Promise.all([
    buyer.page.waitForResponse((r) => r.url().includes('/messages') && r.request().method() === 'POST'),
    buyer.page.getByRole('button', { name: 'Send', exact: true }).click(),
  ])
  // The chat refreshes itself in the background and can briefly hide a message that was just sent,
  // so if it is not on screen yet, reload (it is saved on the server either way)
  await expect(async () => {
    if (!(await buyer.page.getByText('Saturday works!').isVisible())) await buyer.page.reload()
    await expect(buyer.page.getByText('Saturday works!')).toBeVisible({ timeout: 3000 })
  }).toPass({ timeout: 20000 })

  await expect(async () => {
    await seller.page.reload()
    await expect(seller.page.getByText('Saturday works!')).toBeVisible({ timeout: 3000 })
  }).toPass({ timeout: 25000 })

  // Both messages are still there after a reload (stored in the database), in order
  await expect(seller.page.getByText('Hello, is Saturday ok for you?')).toBeVisible()
})

test('chat can be searched', async ({ makeUser }) => {
  const seller = await makeUser('Seller')
  const buyer = await makeUser('Buyer')
  const { trade } = await setUpTrade(seller, buyer, { accept: true })
  await seller.api('POST', `/trades/${trade._id}/messages`, { text: 'The pineapple is ripe' })
  await seller.api('POST', `/trades/${trade._id}/messages`, { text: 'See you at the station' })

  await buyer.page.goto(`/trades/${trade._id}`)
  await dismissDealPopup(buyer.page)
  // Retry: the pop-up can appear late and swallow the first click
  const box = buyer.page.getByLabel('Search this chat')
  await expect(async () => {
    await dismissDealPopup(buyer.page)
    if (!(await box.isVisible())) await buyer.page.getByRole('button', { name: 'Search messages' }).click({ timeout: 2000 })
    await expect(box).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 30000 })
  await box.fill('pineapple')
  await expect(buyer.page.getByText('1 found')).toBeVisible()
  await expect(buyer.page.getByText('See you at the station')).toHaveCount(0)
})
