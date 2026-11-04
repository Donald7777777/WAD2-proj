// Core feature: several people bidding for the same item (competing offers), and the alerts they get
import { test, expect, uid, acceptNextDialog } from './fixtures.js'

/** One seller with one item, and two buyers who each offer an item for it. */
async function setUpBidding(makeUser) {
  const seller = await makeUser('Seller')
  const bidder1 = await makeUser('Bidderone')
  const bidder2 = await makeUser('Biddertwo')
  const wanted = await seller.createListing({ title: `Prized camera ${uid()}`, category: 'Cameras' })
  const give1 = await bidder1.createListing({ title: `First offer ${uid()}`, category: 'Music' })
  const give2 = await bidder2.createListing({ title: `Second offer ${uid()}`, category: 'Books' })
  const trade1 = await bidder1.api('POST', '/trades', { requestedListingIds: [wanted._id], offeredListingIds: [give1._id] })
  const trade2 = await bidder2.api('POST', '/trades', { requestedListingIds: [wanted._id], offeredListingIds: [give2._id] })
  return { seller, bidder1, bidder2, wanted, give1, give2, trade1, trade2 }
}

test.describe('competing offers', () => {
  test('a second bidder sees the competition and can still make an offer', async ({ makeUser }) => {
    const seller = await makeUser('Seller')
    const bidder1 = await makeUser('Bidderone')
    const bidder2 = await makeUser('Biddertwo')
    const wanted = await seller.createListing({ title: `Prized camera ${uid()}`, category: 'Cameras' })
    const give1 = await bidder1.createListing()
    const give2 = await bidder2.createListing({ title: `Second offer ${uid()}` })
    await bidder1.api('POST', '/trades', { requestedListingIds: [wanted._id], offeredListingIds: [give1._id] })

    await bidder2.page.goto(`/listings/${wanted._id}`)
    await expect(bidder2.page.getByRole('heading', { name: /Offers on this item/ })).toBeVisible()
    await bidder2.page.getByRole('link', { name: 'Make a competing offer' }).first().click()
    await expect(bidder2.page.getByRole('heading', { name: 'Make a competing offer' })).toBeVisible()
    await expect(bidder2.page.getByText('1 other offer for this item.')).toBeVisible()

    await bidder2.page.locator('label.th-pick', { hasText: give2.title }).click()
    await bidder2.page.getByRole('button', { name: /Send proposal/ }).click()
    await expect(bidder2.page).toHaveURL(/\/trades\/[0-9a-f]{24}$/)
  })

  test('when the owner accepts one bid, the other bidder is told the item is reserved', async ({ makeUser }) => {
    const { seller, bidder2, wanted, trade1, trade2 } = await setUpBidding(makeUser)
    await seller.api('POST', `/trades/${trade1._id}/accept`)

    await bidder2.page.goto(`/trades/${trade2._id}`)
    await expect(bidder2.page.getByText(/now reserved for another trade/)).toBeVisible()
    // Their offer stays open
    await expect(bidder2.page.getByText(`Waiting for ${seller.name} to respond.`)).toBeVisible()

    // The listing shows as Reserved to everyone
    await bidder2.page.goto(`/listings/${wanted._id}`)
    await expect(bidder2.page.getByText('Reserved', { exact: true }).first()).toBeVisible()
  })

  test('if the accepted deal is cancelled, the other bidder hears the item is available again', async ({ makeUser }) => {
    const { seller, bidder1, bidder2, trade1, trade2 } = await setUpBidding(makeUser)
    await seller.api('POST', `/trades/${trade1._id}/accept`)
    await bidder1.api('POST', `/trades/${trade1._id}/cancel`)

    await bidder2.page.goto(`/trades/${trade2._id}`)
    await expect(bidder2.page.getByText(/available again\. Your offer is still open\./)).toBeVisible()
  })

  test('if a rival withdraws, the remaining bidder is told', async ({ makeUser }) => {
    const { bidder1, bidder2, trade1, trade2 } = await setUpBidding(makeUser)
    await bidder2.api('POST', `/trades/${trade2._id}/cancel`)

    await bidder1.page.goto(`/trades/${trade1._id}`)
    await expect(bidder1.page.getByText(/a rival withdrew their offer .* \(1 offer left\)/)).toBeVisible()
  })

  test('when a bidder changes their offer, the rival hears about it', async ({ makeUser }) => {
    const { bidder1, bidder2, trade1, trade2 } = await setUpBidding(makeUser)
    const extra = await bidder2.createListing({ title: `Sweetener ${uid()}` })
    const better = await bidder2.api('GET', `/trades/${trade2._id}`)
    await bidder2.api('PUT', `/trades/${trade2._id}/offer`, {
      offeredListingIds: [...better.offeredListings.map((l) => l._id), extra._id],
    })

    await bidder1.page.goto(`/trades/${trade1._id}`)
    await expect(bidder1.page.getByText(new RegExp(`${bidder2.name} changed their offer`))).toBeVisible()
  })

  test('the owner can switch to a competing offer, which cancels the first deal', async ({ makeUser }) => {
    const { seller, bidder1, trade1, trade2 } = await setUpBidding(makeUser)
    await seller.api('POST', `/trades/${trade1._id}/accept`)

    await seller.page.goto(`/trades/${trade2._id}`)
    await expect(seller.page.getByText('This is a competing offer.')).toBeVisible()
    acceptNextDialog(seller.page) // "Accept this offer instead? The other trade will be cancelled."
    await seller.page.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(seller.page.getByRole('heading', { name: "It's a deal!" })).toBeVisible()
    await seller.page.getByRole('button', { name: 'Pick a meetup spot' }).click()
    await expect(seller.page.getByRole('heading', { name: 'Meetup point' })).toBeVisible()

    // The first bidder's deal is cancelled, with a reason
    await bidder1.page.goto(`/trades/${trade1._id}`)
    await expect(bidder1.page.getByText(/cancelled the trade to go with another offer/)).toBeVisible()
    await expect(bidder1.page.getByText(/The items are available again/)).toBeVisible()
  })

  test('a counter offer is paused when the owner accepts someone else', async ({ makeUser }) => {
    const { seller, bidder1, bidder2, wanted, give2, trade1, trade2 } = await setUpBidding(makeUser)

    // Seller counters bidder 2: bidder 1 is told the owner is negotiating
    await seller.api('POST', `/trades/${trade2._id}/counter`, {
      offeredListingIds: [give2._id],
      requestedListingIds: [wanted._id],
    })
    await bidder1.page.goto(`/trades/${trade1._id}`)
    await expect(bidder1.page.getByText(/is negotiating with another bidder/)).toBeVisible()

    // Then the seller accepts bidder 1: the counter to bidder 2 goes on hold
    await seller.api('POST', `/trades/${trade1._id}/accept`)

    await seller.page.goto(`/trades/${trade2._id}`)
    await expect(seller.page.getByText(new RegExp(`Your counter offer to ${bidder2.name} is paused`))).toBeVisible()
    await bidder2.page.goto(`/trades/${trade2._id}`)
    await expect(bidder2.page.getByText(/counter offer is paused/).first()).toBeVisible()
  })

  test('a bidder cannot accept a counter after the item went to someone else', async ({ makeUser }) => {
    const { seller, bidder2, wanted, give2, trade1, trade2 } = await setUpBidding(makeUser)
    await seller.api('POST', `/trades/${trade2._id}/counter`, { offeredListingIds: [give2._id], requestedListingIds: [wanted._id] })
    await seller.api('POST', `/trades/${trade1._id}/accept`)

    // Refused: it is not the bidder's turn any more (400), or the item is already in another deal (409)
    const response = await bidder2.context.request.post(`/api/trades/${trade2._id}/accept`)
    expect([400, 409]).toContain(response.status())
  })
})
