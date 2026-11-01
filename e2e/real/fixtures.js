// Helpers for the real-stack tests.
// Every test makes its own users and listings with unique names, so tests never clash and nothing has to be reset.
import process from 'node:process'
import { test as base, expect } from '@playwright/test'

export { expect }

const PASSWORD = 'e2e-pass-123'

/** Short unique string, e.g. "m3k9x2ab" */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/** Close the "It's a deal!" pop-up if it shows (it appears the first time someone opens an accepted trade). */
export async function dismissDealPopup(page) {
  const next = page.getByRole('button', { name: 'Pick a meetup spot' })
  await next.waitFor({ state: 'visible', timeout: 4000 }).then(() => next.click()).catch(() => {})
}

/** Accept the browser's confirm() dialogs (Cancel trade, Delete listing...) for the next action. */
export function acceptNextDialog(page) {
  page.once('dialog', (dialog) => dialog.accept())
}

export const test = base.extend({
  /**
   * makeUser('Anna') -> a brand new registered, logged-in user with their own browser window.
   *   user.page                 Playwright page, already logged in
   *   user.name / .email / .password
   *   user.api(method, path, data)       call the real API as this user (for quick set-up)
   *   user.createListing({...})          make a listing through the API, returns the listing
   */
  makeUser: async ({ browser, baseURL }, use) => {
    const contexts = []

    await use(async (label, { register = true } = {}) => {
      const id = uid()
      // These windows are made by hand, so turn video on here too when running in demo mode
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 1280, height: 800 },
        ...(process.env.DEMO ? { recordVideo: { dir: test.info().outputDir, size: { width: 1280, height: 800 } } } : {}),
      })
      contexts.push(context)
      const page = await context.newPage()
      const user = {
        id,
        page,
        context,
        name: `E2E ${label} ${id}`,
        email: `e2e-${label.toLowerCase()}-${id}@example.com`,
        password: PASSWORD,
        async api(method, path, data) {
          const response = await context.request.fetch(`/api${path}`, { method, data })
          const body = await response.json().catch(() => null)
          if (!response.ok()) throw new Error(`${method} /api${path} failed (${response.status()}): ${JSON.stringify(body)}`)
          return body
        },
        createListing(fields = {}) {
          return user.api('POST', '/listings', {
            title: `Item ${uid()}`,
            description: 'Made by an automated test.',
            category: 'Other',
            condition: 'Good',
            lookingFor: '',
            ...fields,
          })
        },
      }
      if (register) {
        user.profile = await user.api('POST', '/auth/register', { name: user.name, email: user.email, password: user.password })
      }
      return user
    })

    for (const context of contexts) await context.close()
  },
})

/**
 * Set up a trade through the API: `buyer` offers one of their items for one of `seller`'s items.
 * Returns { trade, offered, requested } (listings are created fresh).
 * Pass accept: true to also have the seller accept it.
 */
export async function setUpTrade(seller, buyer, { accept = false } = {}) {
  const requested = await seller.createListing({ title: `Seller item ${uid()}`, category: 'Cameras' })
  const offered = await buyer.createListing({ title: `Buyer item ${uid()}`, category: 'Music' })
  const trade = await buyer.api('POST', '/trades', {
    requestedListingIds: [requested._id],
    offeredListingIds: [offered._id],
  })
  if (accept) await seller.api('POST', `/trades/${trade._id}/accept`)
  return { trade, offered, requested }
}
