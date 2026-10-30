// Core feature: trade proposals (propose, accept, reject, counter, withdraw, cancel)
import { test, expect, setUpTrade, uid, dismissDealPopup, acceptNextDialog } from './fixtures.js'

const tradeLink = (page, otherName) => page.getByRole('link', { name: new RegExp(`Trading with ${otherName}`) })

test.describe('trade proposals', () => {
  test('propose a trade in the app, and the other person accepts it', async ({ makeUser }) => {
    const seller = await makeUser('Seller')
    const buyer = await makeUser('Buyer')
    const wanted = await seller.createListing({ title: `Wanted camera ${uid()}`, category: 'Cameras' })
    const mine = await buyer.createListing({ title: `My guitar ${uid()}`, category: 'Music' })

    // Buyer: open the listing, offer one of their own items
    await buyer.page.goto(`/listings/${wanted._id}`)
    await buyer.page.getByRole('link', { name: 'Offer a trade' }).click()
    await expect(buyer.page.getByRole('heading', { name: 'Offer a trade' })).toBeVisible()
    await buyer.page.locator('label.th-pick', { hasText: mine.title }).click()
    await buyer.page.getByRole('button', { name: /Send proposal \(1 item\)/ }).click()
    await expect(buyer.page).toHaveURL(/\/trades\/[0-9a-f]{24}$/)
    await expect(buyer.page.getByText(`Waiting for ${seller.name} to respond.`)).toBeVisible()

    // Seller: sees it under "Needs action", opens it and accepts
    await seller.page.goto('/trades')
    await tradeLink(seller.page, buyer.name).click()
    await expect(seller.page.getByText('You received a proposal.')).toBeVisible()
    await seller.page.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(seller.page.getByRole('heading', { name: "It's a deal!" })).toBeVisible()
    await seller.page.getByRole('button', { name: 'Pick a meetup spot' }).click()
    await expect(seller.page.getByRole('heading', { name: 'Meetup point' })).toBeVisible()

    // Buyer: the trade is now accepted too
    await buyer.page.reload()
    await dismissDealPopup(buyer.page)
    await expect(buyer.page.getByRole('heading', { name: 'Meetup point' })).toBeVisible()
    await expect(buyer.page.getByRole('heading', { name: 'Inspection checklist' })).toBeVisible()
  })

  test('the other person can reject a proposal', async ({ makeUser }) => {
    const seller = await makeUser('Seller')
    const buyer = await makeUser('Buyer')
    const { trade } = await setUpTrade(seller, buyer)

    await seller.page.goto(`/trades/${trade._id}`)
    await expect(seller.page.getByText('You received a proposal.')).toBeVisible()
    await seller.page.getByRole('button', { name: 'Reject' }).click()
    await expect(seller.page.getByText(/This trade was declined/)).toBeVisible()

    await buyer.page.goto(`/trades/${trade._id}`)
    await expect(buyer.page.getByText(/This trade was declined/)).toBeVisible()
  })

  test('counter offer: add another item, the other person accepts it', async ({ makeUser }) => {
    const seller = await makeUser('Seller')
    const buyer = await makeUser('Buyer')
    const { trade } = await setUpTrade(seller, buyer)
    const extra = await buyer.createListing({ title: `Extra item ${uid()}`, category: 'Books' })

    // Seller counters: "also add your extra item"
    await seller.page.goto(`/trades/${trade._id}`)
    await seller.page.getByRole('button', { name: 'Counter' }).click()
    await expect(seller.page.getByRole('heading', { name: 'Make a counter offer' })).toBeVisible()
    await seller.page.locator('label.th-pick', { hasText: extra.title }).click()
    await seller.page.getByRole('button', { name: 'Send counter offer' }).click()
    await expect(seller.page.getByText(`Waiting for ${buyer.name} to respond.`)).toBeVisible()

    // Buyer sees the counter, with both items, and accepts
    await buyer.page.goto(`/trades/${trade._id}`)
    await expect(buyer.page.getByText('You received a counter offer.')).toBeVisible()
    await expect(buyer.page.getByText(extra.title).first()).toBeVisible()
    await buyer.page.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(buyer.page.getByRole('heading', { name: "It's a deal!" })).toBeVisible()
  })

  test('the proposer can withdraw a proposal', async ({ makeUser }) => {
    const seller = await makeUser('Seller')
    const buyer = await makeUser('Buyer')
    const { trade } = await setUpTrade(seller, buyer)

    await buyer.page.goto(`/trades/${trade._id}`)
    acceptNextDialog(buyer.page)
    await buyer.page.getByRole('button', { name: 'Withdraw proposal' }).click()
    await expect(buyer.page.getByText(/The items are available again/)).toBeVisible()

    await seller.page.goto(`/trades/${trade._id}`)
    await expect(seller.page.getByText(/The items are available again/)).toBeVisible()
  })

  test('an accepted trade can still be cancelled', async ({ makeUser }) => {
    const seller = await makeUser('Seller')
    const buyer = await makeUser('Buyer')
    const { trade } = await setUpTrade(seller, buyer, { accept: true })

    await buyer.page.goto(`/trades/${trade._id}`)
    await dismissDealPopup(buyer.page)
    acceptNextDialog(buyer.page)
    await buyer.page.getByRole('button', { name: 'Cancel trade' }).click()
    await expect(buyer.page.getByText(/The items are available again/)).toBeVisible()
  })

  test('trades are listed under the right tab on My trades', async ({ makeUser }) => {
    const seller = await makeUser('Seller')
    const buyer = await makeUser('Buyer')
    await setUpTrade(seller, buyer)

    // Seller has to respond ("Needs action"), buyer is waiting ("In progress")
    await seller.page.goto('/trades')
    await expect(tradeLink(seller.page, buyer.name)).toBeVisible()
    await buyer.page.goto('/trades')
      await buyer.page.getByRole('tab', { name: /In progress/ }).click()
    await expect(tradeLink(buyer.page, seller.name)).toBeVisible()
  })
})
