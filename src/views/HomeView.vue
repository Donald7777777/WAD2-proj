<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { api, errorMessage } from '@/lib/api'
import { CATEGORIES } from '@/lib/constants'
import ListingCard from '@/components/ListingCard.vue'
import AppIcon from '@/components/AppIcon.vue'

const auth = useAuthStore()

const listings = ref([])
const matches = ref([])
// Matches are shown 5 at a time (one row), with back / next buttons to page through them.
// Keep this in sync with the 5 columns of .th-strip in components.css
const MATCHES_PER_PAGE = 5
const matchPage = ref(0)
const matchPageCount = computed(() => Math.ceil(matches.value.length / MATCHES_PER_PAGE))
const visibleMatches = computed(() =>
  matches.value.slice(matchPage.value * MATCHES_PER_PAGE, (matchPage.value + 1) * MATCHES_PER_PAGE),
)

// Shortcut cards that fill any empty slots on the last page, so the row is never half empty
const FILLERS = [
  { to: '/profile?tab=wants', icon: 'spark', title: 'Want more matches?', text: 'Add more wants on your profile and we will find more people.' },
  { to: '/listings/new', icon: 'plus', title: 'List another item', text: 'More items listed means more people who want what you have.' },
  { to: '#browse', icon: 'search', title: 'Browse everything', text: 'See every item up for trade, not just your matches.' },
  { to: '/trades', icon: 'swap', title: 'Your trades', text: 'Check on proposals you have sent and received.' },
]
const fillers = computed(() => FILLERS.slice(0, MATCHES_PER_PAGE - visibleMatches.value.length))

function changeMatchPage(step) {
  matchPage.value = Math.min(Math.max(matchPage.value + step, 0), matchPageCount.value - 1)
}
const category = ref('All')
const search = ref('')
const sort = ref('newest')
const loading = ref(false)
const error = ref('')
// Listings come in pages of 24; "Show more" (or scrolling to the bottom) loads the next one
const PAGE_SIZE = 24
const page = ref(1)
const pages = ref(1)
const total = ref(0)
const loadingMore = ref(false)
const hasMore = computed(() => page.value < pages.value)

// The server sends one page: { items, total, page, pages }. An older server sends the whole list
// as an array, so handle that too (then everything is on "page 1").
function readPage(data) {
  if (Array.isArray(data)) return { items: data, total: data.length, page: 1, pages: 1 }
  return { items: data?.items || [], total: data?.total || 0, page: data?.page || 1, pages: data?.pages || 1 }
}

function params(p) {
  return { category: category.value, search: search.value, sort: sort.value, page: p, limit: PAGE_SIZE }
}

async function loadListings() {
  loading.value = true
  error.value = ''
  try {
    const data = readPage((await api.get('/listings', { params: params(1) })).data)
    listings.value = data.items
    page.value = data.page
    pages.value = data.pages
    total.value = data.total
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const data = readPage((await api.get('/listings', { params: params(page.value + 1) })).data)
    // Skip anything already shown (a new listing can shift the pages)
    const shown = new Set(listings.value.map((l) => l._id))
    listings.value.push(...data.items.filter((l) => !shown.has(l._id)))
    page.value = data.page
    pages.value = data.pages
    total.value = data.total
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loadingMore.value = false
  }
}

// Load the next page by itself when the "Show more" button scrolls into view
const moreButton = ref(null)
let observer = null
watch(moreButton, (el) => {
  observer?.disconnect()
  if (!el || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: '300px' })
  observer.observe(el)
})
onUnmounted(() => observer?.disconnect())

async function loadMatches() {
  if (!auth.user) return
  try {
    const response = await api.get('/listings/matches')
    matches.value = response.data
    matchPage.value = 0
  } catch (e) {
    error.value = errorMessage(e)
  }
}

function pickCategory(name) {
  category.value = name
  loadListings()
}

onMounted(() => {
  loadListings()
  loadMatches()
})

// An item on screen was reserved, traded or freed up: update its card live
// (traded items leave Discover, like they would on a reload)
const notes = useNotificationStore()
const changed = new Set()
let refreshTimer = null
async function refreshChanged() {
  const ids = [...changed]
  changed.clear()
  await Promise.all(
    ids.map(async (id) => {
      let fresh = null
      try {
        fresh = (await api.get(`/listings/${id}`)).data
      } catch {
        // Deleted: drop it below
      }
      const gone = !fresh || fresh.status === 'traded'
      // Discover: plain listings
      const i = listings.value.findIndex((l) => l._id === id)
      if (i !== -1) {
        if (gone) listings.value.splice(i, 1)
        else listings.value[i] = { ...listings.value[i], status: fresh.status }
      }
      // Matches: { listing, score, mutual }
      const m = matches.value.findIndex((x) => x.listing?._id === id)
      if (m !== -1) {
        if (gone) matches.value.splice(m, 1)
        else matches.value[m] = { ...matches.value[m], listing: { ...matches.value[m].listing, status: fresh.status } }
      }
    }),
  )
}
const stopListening = notes.onTradeEvent((event) => {
  if (event.type !== 'listing') return
  const shown = new Set([...listings.value.map((l) => l._id), ...matches.value.map((x) => x.listing?._id)])
  const ids = (event.ids || []).filter((id) => shown.has(id))
  if (!ids.length) return
  ids.forEach((id) => changed.add(id))
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(refreshChanged, 400)
})
onUnmounted(() => {
  stopListening()
  clearTimeout(refreshTimer)
})
</script>

<template>
  <!-- Hero -->
  <section class="th-hero">
    <div class="th-hero-copy">
      <span class="eyebrow th-hero-eyebrow">Swap, don't shop</span>
      <h1 class="th-hero-title">Swap what you have for what you <em>want.</em></h1>
      <p class="th-hero-lead">
        List things you no longer use. We match you with people nearby who have what you're after, and want what
        you've got.
      </p>
      <div class="th-hero-actions">
        <RouterLink v-if="auth.user" to="/listings/new" class="btn btn-offer btn-lg">
          <AppIcon name="plus" />List an item
        </RouterLink>
        <RouterLink v-else to="/register" class="btn btn-offer btn-lg">Get started</RouterLink>
        <a href="#browse" class="btn btn-ghost btn-lg">Browse listings</a>
      </div>
    </div>

    <!-- Decorative: your item and their item meeting in the middle -->
    <div class="th-hero-art d-none d-md-flex" aria-hidden="true">
      <div class="th-hero-tile th-hero-you">
        <span class="eyebrow">You give</span>
        <AppIcon name="camera" :size="40" />
        <b>Film camera</b>
      </div>
      <span class="th-hero-swap"><AppIcon name="swap" :size="24" /></span>
      <div class="th-hero-tile th-hero-them">
        <span class="eyebrow">You get</span>
        <svg class="th-icon" width="40" height="40" viewBox="0 0 24 24">
          <path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3" /><rect x="3.5" y="14" width="4" height="6" rx="1.5" />
          <rect x="16.5" y="14" width="4" height="6" rx="1.5" />
        </svg>
        <b>Headphones</b>
      </div>
      <span class="th-match-pill th-hero-match">96% match</span>
    </div>
  </section>

  <!-- How it works (new visitors) -->
  <ol v-if="!auth.user" class="th-steps">
    <li><span class="th-step-num">1</span><b>List and set your wants</b>Add what you'd give away and what you're after.</li>
    <li><span class="th-step-num">2</span><b>Get matched, then propose</b>Offer one or more items. They accept, decline or counter.</li>
    <li><span class="th-step-num">3</span><b>Meet and inspect</b>Pick a public spot, tick the checklist, swap.</li>
  </ol>

  <!-- Smart matches (logged-in users only) -->
  <section v-if="auth.user" class="th-section th-matches">
    <div class="th-section-head">
      <div>
        <h2>Fresh matches for you</h2>
        <p>Based on what you want and what you've listed.</p>
      </div>
      <RouterLink to="/profile?tab=wants" class="th-link">Improve my matches</RouterLink>
    </div>
    <div v-if="auth.user.wants.length === 0" class="th-empty">
      <strong>Tell us what you're looking for</strong>
      <p>Add a few wants on your profile and we'll find people who have them.</p>
      <RouterLink to="/profile?tab=wants" class="btn btn-primary btn-sm mt-2">Add wants</RouterLink>
    </div>
    <div v-else-if="matches.length === 0" class="th-empty">
      <strong>No matches yet</strong>
      <p>Nothing lines up right now. Add more wants and we'll look again.</p>
    </div>
    <div class="th-strip">
      <div v-for="(match, index) in visibleMatches" :key="match.listing._id" v-reveal="index">
        <ListingCard :listing="match.listing" :score="match.score" :mutual="match.mutual" />
      </div>
      <div v-for="filler in matches.length ? fillers : []" :key="filler.title">
        <a v-if="filler.to.startsWith('#')" :href="filler.to" class="th-filler">
          <span class="th-filler-icon"><AppIcon :name="filler.icon" :size="22" /></span>
          <b>{{ filler.title }}</b>
          <span>{{ filler.text }}</span>
        </a>
        <RouterLink v-else :to="filler.to" class="th-filler">
          <span class="th-filler-icon"><AppIcon :name="filler.icon" :size="22" /></span>
          <b>{{ filler.title }}</b>
          <span>{{ filler.text }}</span>
        </RouterLink>
      </div>
    </div>
    <nav v-if="matchPageCount > 1" class="th-pager" aria-label="More matches">
      <button
        type="button"
        class="btn btn-outline-dark btn-sm th-pager-btn"
        :disabled="matchPage === 0"
        aria-label="Previous matches"
        @click="changeMatchPage(-1)"
      >
        <AppIcon name="chevron" :size="18" style="transform: rotate(180deg)" />
      </button>
      <span class="th-pager-label">{{ matchPage + 1 }} of {{ matchPageCount }}</span>
      <button
        type="button"
        class="btn btn-outline-dark btn-sm th-pager-btn"
        :disabled="matchPage === matchPageCount - 1"
        aria-label="Next matches"
        @click="changeMatchPage(1)"
      >
        <AppIcon name="chevron" :size="18" />
      </button>
    </nav>
  </section>

  <!-- Browse and search -->
  <section id="browse" class="th-section">
    <div class="th-section-head">
      <div>
        <h2>Browse listings</h2>
        <p v-if="!loading">{{ total }} item{{ total === 1 ? '' : 's' }} up for trade</p>
      </div>
    </div>

    <form class="th-toolbar" role="search" @submit.prevent="loadListings">
      <label class="th-search">
        <AppIcon name="search" />
        <input
          v-model.trim="search"
          type="search"
          placeholder="Search cameras, records, bikes…"
          aria-label="Search listings"
        />
        <button class="btn btn-primary btn-sm" type="submit">Search</button>
      </label>
      <select v-model="sort" class="form-select th-select-pill" aria-label="Sort listings" @change="loadListings">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </form>

    <div class="th-chips mb-4" role="group" aria-label="Category">
      <button
        v-for="name in ['All', ...CATEGORIES]"
        :key="name"
        type="button"
        class="th-chip"
        :aria-pressed="category === name ? 'true' : 'false'"
        @click="pickCategory(name)"
      >
        {{ name }}
      </button>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <div v-if="loading" class="th-grid" aria-label="Loading listings">
      <div v-for="n in 4" :key="n" class="th-skeleton"></div>
    </div>
    <div v-else-if="listings.length === 0" class="th-empty">
      <strong>No listings found</strong>
      <p>Try another category or a shorter search.</p>
    </div>

    <template v-else>
      <div class="th-grid">
        <div v-for="(listing, index) in listings" :key="listing._id" v-reveal="index % PAGE_SIZE">
          <ListingCard :listing="listing" />
        </div>
        <div v-for="n in loadingMore ? 4 : 0" :key="`more-${n}`" class="th-skeleton" aria-hidden="true"></div>
      </div>
      <div class="th-more">
        <span class="th-muted small">Showing {{ listings.length }} of {{ total }}</span>
        <button v-if="hasMore" ref="moreButton" type="button" class="btn btn-outline-dark" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? 'Loading…' : 'Show more' }}
        </button>
      </div>
    </template>
  </section>
</template>