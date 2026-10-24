<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import { CATEGORIES } from '@/lib/constants'
import ListingCard from '@/components/ListingCard.vue'
import AppIcon from '@/components/AppIcon.vue'

const auth = useAuthStore()

const listings = ref([])
const matches = ref([])
const category = ref('All')
const search = ref('')
const sort = ref('newest')
const loading = ref(false)
const error = ref('')

async function loadListings() {
  loading.value = true
  error.value = ''
  try {
    const response = await api.get('/listings', {
      params: { category: category.value, search: search.value, sort: sort.value },
    })
    listings.value = response.data
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function loadMatches() {
  if (!auth.user) return
  try {
    const response = await api.get('/listings/matches')
    matches.value = response.data.slice(0, 4)
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
      <RouterLink to="/profile" class="th-link">Improve my matches</RouterLink>
    </div>
    <div v-if="auth.user.wants.length === 0" class="th-empty">
      <strong>Tell us what you're looking for</strong>
      <p>Add a few wants on your profile and we'll find people who have them.</p>
      <RouterLink to="/profile" class="btn btn-primary btn-sm mt-2">Add wants</RouterLink>
    </div>
    <div v-else-if="matches.length === 0" class="th-empty">
      <strong>No matches yet</strong>
      <p>Nothing lines up right now. Add more wants and we'll look again.</p>
    </div>
    <div class="th-strip">
      <div v-for="match in matches" :key="match.listing._id">
        <ListingCard :listing="match.listing" :score="match.score" :mutual="match.mutual" />
      </div>
    </div>
  </section>

  <!-- Browse and search -->
  <section id="browse" class="th-section">
    <div class="th-section-head">
      <div>
        <h2>Browse listings</h2>
        <p v-if="!loading">{{ listings.length }} item{{ listings.length === 1 ? '' : 's' }} up for trade</p>
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

    <div v-else class="th-grid">
      <div v-for="listing in listings" :key="listing._id">
        <ListingCard :listing="listing" />
      </div>
    </div>
  </section>
</template>
