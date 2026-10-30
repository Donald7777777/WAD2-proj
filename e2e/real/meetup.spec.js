// Core feature: choose a public meetup place and time
import { test, expect, setUpTrade, dismissDealPopup } from './fixtures.js'

// The place search uses OneMap, a free public API on the internet. We answer that one call ourselves so the test
// does not depend on the internet (everything else, including our own server and database, is real).
async function fakeOneMap(page) {
  await page.route('https://www.onemap.gov.sg/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        results: [
          { SEARCHVAL: 'BISHAN MRT STATION', ADDRESS: '200 BISHAN ROAD SINGAPORE 579827', LATITUDE: '1.3510', LONGITUDE: '103.8483' },
          { SEARCHVAL: 'BISHAN LIBRARY', ADDRESS: '5 BISHAN PLACE SINGAPORE 579841', LATITUDE: '1.3506', LONGITUDE: '103.8503' },
        ],
      }),
    }),
  )
}

test('set a meetup place and time, and the other person sees it', async ({ makeUser }) => {
  const seller = await makeUser('Seller')
  const buyer = await makeUser('Buyer')
  const { trade } = await setUpTrade(seller, buyer, { accept: true })
  await fakeOneMap(seller.page)

  await seller.page.goto(`/trades/${trade._id}`)
  await dismissDealPopup(seller.page)
  await expect(seller.page.getByRole('heading', { name: 'Meetup point' })).toBeVisible()

  // Search, pick a result
  await seller.page.getByLabel('Search for a meetup place').fill('Bishan')
  await seller.page.getByRole('button', { name: 'Search', exact: true }).click()
  await seller.page.locator('.th-results').getByRole('button', { name: /BISHAN MRT STATION/i }).click()

  // Pick tomorrow and the first free time slot
  await seller.page.getByRole('group', { name: 'Meetup day' }).getByRole('button', { name: 'Tomorrow' }).click()
  await seller.page.locator('.th-time-slot:not([disabled])').first().click()
  await seller.page.getByRole('button', { name: 'Save meetup' }).click()

  // Saved: directions link and the place name are shown
  await expect(seller.page.getByRole('link', { name: 'Get directions' })).toBeVisible()
  await expect(seller.page.getByRole('heading', { name: /bishan mrt station/i })).toBeVisible()

  // The buyer sees the same meetup, and a chat note about it
  await buyer.page.goto(`/trades/${trade._id}`)
  await dismissDealPopup(buyer.page)
  await expect(buyer.page.getByRole('heading', { name: /bishan mrt station/i })).toBeVisible()
  await expect(buyer.page.getByRole('link', { name: 'Get directions' })).toBeVisible()
  await expect(buyer.page.getByText(/set the meetup: BISHAN MRT STATION/i)).toBeVisible()
})

test('the meetup can be changed afterwards', async ({ makeUser }) => {
  const seller = await makeUser('Seller')
  const buyer = await makeUser('Buyer')
  const { trade } = await setUpTrade(seller, buyer, { accept: true })
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  await seller.api('PUT', `/trades/${trade._id}/meetup`, {
    name: 'OLD PLACE', address: '1 Old Road', lat: 1.3, lng: 103.8, date, time: '15:00',
  })
  await fakeOneMap(seller.page)

  await seller.page.goto(`/trades/${trade._id}`)
  await dismissDealPopup(seller.page)
  await expect(seller.page.getByRole('heading', { name: /old place/i })).toBeVisible()
  await seller.page.getByRole('button', { name: 'Change meetup' }).click()
  await seller.page.getByLabel('Search for a meetup place').fill('Bishan')
  await seller.page.getByRole('button', { name: 'Search', exact: true }).click()
  await seller.page.locator('.th-results').getByRole('button', { name: /BISHAN LIBRARY/i }).click()
  await seller.page.getByRole('button', { name: 'Save meetup' }).click()
  await expect(seller.page.getByRole('heading', { name: /bishan library/i })).toBeVisible()
  await expect(seller.page.getByText(/changed the meetup to BISHAN LIBRARY/i)).toBeVisible()
})
