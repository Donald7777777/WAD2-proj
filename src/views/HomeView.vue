<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import { CATEGORIES } from '@/lib/constants'
import ListingCard from '@/components/ListingCard.vue'

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
  <div class="p-4 p-md-5 mb-4 bg-dark text-white rounded-3">
    <h1 class="display-6 fw-bold">Good things deserve a second story.</h1>
    <p class="lead mb-3">Trade what you have for what you'll love next.</p>
    <RouterLink v-if="auth.user" to="/listings/new" class="btn btn-success">List an item</RouterLink>
    <RouterLink v-else to="/register" class="btn btn-success">Get started</RouterLink>
  </div>

  <!-- Smart matches (logged-in users only) -->
  <section v-if="auth.user" class="mb-4">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h2 class="h5 mb-0">Fresh matches for you</h2>
      <RouterLink to="/profile" class="small">Improve my matches</RouterLink>
    </div>
    <p v-if="auth.user.wants.length === 0" class="text-secondary">
      Tell us what you're looking for on your <RouterLink to="/profile">profile</RouterLink> to see matches.
    </p>
    <p v-else-if="matches.length === 0" class="text-secondary">No matches yet. Check back soon!</p>
    <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
      <div v-for="match in matches" :key="match.listing._id" class="col">
        <ListingCard :listing="match.listing" :score="match.score" :mutual="match.mutual" />
      </div>
    </div>
  </section>

  <!-- Browse and search -->
  <section>
    <h2 class="h5">Browse listings</h2>
    <form class="row g-2 mb-3" @submit.prevent="loadListings">
      <div class="col-md-6">
        <input v-model.trim="search" type="search" class="form-control" placeholder="Search cameras, records, bikes…" />
      </div>
      <div class="col-6 col-md-3">
        <select v-model="sort" class="form-select" @change="loadListings">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      <div class="col-6 col-md-3">
        <button class="btn btn-dark w-100" type="submit">Search</button>
      </div>
    </form>

    <div class="mb-3">
      <button
        v-for="name in ['All', ...CATEGORIES]"
        :key="name"
        type="button"
        class="btn btn-sm rounded-pill me-1 mb-1"
        :class="category === name ? 'btn-dark' : 'btn-outline-dark'"
        @click="pickCategory(name)"
      >
        {{ name }}
      </button>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <p v-if="loading" class="text-secondary">Loading…</p>
    <p v-else-if="listings.length === 0" class="text-secondary">No listings found.</p>

    <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
      <div v-for="listing in listings" :key="listing._id" class="col">
        <ListingCard :listing="listing" />
      </div>
    </div>
  </section>
</template>
