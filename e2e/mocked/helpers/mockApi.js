// Fake backend for the e2e tests.
// Every request to /api/* is answered here, so the tests need no Express server and no MongoDB.
// State lives in memory for the length of one test, so log in, create listing, reload all behave like the real app.

export const DEMO_USER = {
  _id: 'u1',
  name: 'Theo Tan',
  email: 'theo@demo.com',
  wants: ['Music'],
  blocked: [],
  avatarUrl: '',
}
const DEMO_PASSWORD = 'password123'

const OTHER_OWNER = { _id: 'u2', name: 'Mei Lin', avatarUrl: '' }

function makeListing(n, title, category, condition, lookingFor, owner = OTHER_OWNER) {
  return {
    _id: `l${n}`,
    title,
    category,
    condition,
    description: `${title} in ${condition.toLowerCase()} condition.`,
    lookingFor,
    status: 'available',
    images: [],
    imageUrl: '',
    owner,
    likeCount: 0,
    saveCount: 0,
    liked: false,
    saved: false,
  }
}

export const SEED_LISTINGS = [
  makeListing(1, 'Canon AE-1 Program', 'Cameras', 'Excellent', 'turntable'),
  makeListing(2, 'Logitech MX Keys keyboard', 'Tech', 'Good', 'film lens'),
  makeListing(3, 'Vinyl record collection', 'Music', 'Like new', 'bluetooth speaker'),
]

/**
 * Install the fake API on a page. Call this BEFORE page.goto().
 * @param page Playwright page
 * @param {{ loggedIn?: boolean }} options loggedIn = start with a session (like having a login cookie)
 * @returns the in-memory state, so a test can inspect it (state.listings, state.user)
 */
export async function mockApi(page, { loggedIn = false } = {}) {
  const state = {
    user: loggedIn ? { ...DEMO_USER } : null,
    listings: SEED_LISTINGS.map((l) => ({ ...l })),
    nextId: 100,
  }

  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname.replace(/^\/api/, '')
      const method = request.method()
      const body = () => request.postDataJSON() ?? {}
      const json = (data, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      const fail = (status, error) => json({ error }, status)

      // ---- auth ----
      // Like the real server: 200 with the user, or 200 with null when logged out
      if (path === '/auth/me') return json(state.user)

      if (path === '/auth/login' && method === 'POST') {
        const { email, password } = body()
        if (email === DEMO_USER.email && password === DEMO_PASSWORD) {
          state.user = { ...DEMO_USER }
          return json(state.user)
        }
        return fail(401, 'Invalid email or password')
      }

      if (path === '/auth/register' && method === 'POST') {
        const { name, email } = body()
        if (email === DEMO_USER.email) return fail(409, 'That email is already registered')
        state.user = { _id: 'u-new', name, email, wants: [], blocked: [], avatarUrl: '' }
        return json(state.user, 201)
      }

      if (path === '/auth/logout' && method === 'POST') {
        state.user = null
        return json({ ok: true })
      }

      // ---- listings ----
      if (path === '/listings' && method === 'GET') {
        const search = (url.searchParams.get('search') || '').toLowerCase()
        const category = url.searchParams.get('category') || 'All'
        const items = state.listings.filter(
          (l) => (category === 'All' || l.category === category) && l.title.toLowerCase().includes(search),
        )
        return json({ items, total: items.length, page: 1, pages: 1 })
      }

      if (path === '/listings' && method === 'POST') {
        if (!state.user) return fail(401, 'Not logged in')
        const listing = {
          ...makeListing(state.nextId++, '', '', 'Good', '', {
            _id: state.user._id,
            name: state.user.name,
            avatarUrl: '',
          }),
          ...body(),
        }
        state.listings.unshift(listing)
        return json(listing, 201)
      }

      if (path === '/listings/mine') return json(state.listings.filter((l) => l.owner._id === state.user?._id))
      if (path === '/listings/matches') return json([])
      if (path === '/listings/saved' || path === '/listings/liked') return json([])

      const offers = path.match(/^\/listings\/([^/]+)\/offers$/)
      if (offers) return json([])

      const one = path.match(/^\/listings\/([^/]+)$/)
      if (one && method === 'GET') {
        const found = state.listings.find((l) => l._id === one[1])
        return found ? json(found) : fail(404, 'Listing not found')
      }

      // ---- trades / notifications / everything else ----
      if (path === '/trades') return json([])
      if (path === '/notifications/stream') {
        return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': connected\n\n' })
      }
      if (path === '/notifications') return json([])

      // Anything not mocked: harmless empty answer, and print it so a missing mock is easy to spot
      console.warn(`[mockApi] unmocked ${method} ${path}`)
      return json(method === 'GET' ? [] : {})
    },
  )

  return state
}
