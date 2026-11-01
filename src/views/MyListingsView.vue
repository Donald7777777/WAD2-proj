<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import { deleteImage } from '@/lib/storage'
import ListingCard from '@/components/ListingCard.vue'
import AppIcon from '@/components/AppIcon.vue'

const listings = ref([])
const error = ref('')
const loading = ref(true)
const search = ref('')

// Search your own listings as you type: matches the title, category, description,
// what you're looking for, or the status (e.g. "reserved"). Every word must match.
const shown = computed(() => {
  const words = search.value.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return listings.value
  return listings.value.filter((l) => {
    const text = [l.title, l.category, l.description, l.lookingFor, l.status].join(' ').toLowerCase()
    return words.every((w) => text.includes(w))
  })
})

async function load() {
  loading.value = true
  try {
    const response = await api.get('/listings/mine')
    // Available first (you can still edit or delete them), then reserved (in an accepted trade),
    // then traded (history). The server sends newest first, and sort() keeps that order within each group.
    const ORDER = { available: 0, reserved: 1, traded: 2 }
    listings.value = [...response.data].sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3))
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function remove(listing) {
  if (!confirm(`Delete "${listing.title}"?`)) return
  try {
    const response = await api.delete(`/listings/${listing._id}`)
    // Also remove the photo from Supabase Storage
    const paths = response.data.imagePaths || [response.data.imagePath].filter(Boolean)
    for (const path of paths) {
      deleteImage(path).catch(() => {})
    }
    listings.value = listings.value.filter((l) => l._id !== listing._id)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

onMounted(load)
</script>

<template>
  <div class="th-page-head">
    <div>
      <h1>My listings</h1>
      <p v-if="!loading">{{ listings.length }} item{{ listings.length === 1 ? '' : 's' }} you've put up for trade.</p>
    </div>
    <RouterLink to="/listings/new" class="btn btn-offer"><AppIcon name="plus" />New listing</RouterLink>
  </div>

  <div v-if="error" class="alert alert-danger">{{ error }}</div>
  <div v-if="loading" class="th-grid" aria-label="Loading your listings">
    <div v-for="n in 4" :key="n" class="th-skeleton"></div>
  </div>
  <div v-else-if="!error && listings.length === 0" class="th-empty">
    <strong>You haven't listed anything yet</strong>
    <p>Add something you no longer use. It takes about two minutes.</p>
    <RouterLink to="/listings/new" class="btn btn-primary btn-sm mt-2">List an item</RouterLink>
  </div>

  <label v-if="!loading && listings.length > 0" class="th-search mb-4">
    <AppIcon name="search" />
    <input v-model="search" type="search" placeholder="Search your listings, e.g. camera" aria-label="Search your listings" @keydown.esc="search = ''" />
    <span v-if="search.trim()" class="th-muted small text-nowrap pe-3">{{ shown.length }} of {{ listings.length }}</span>
  </label>

  <div v-if="!loading && listings.length > 0 && shown.length === 0" class="th-empty">
    <strong>No listings match "{{ search.trim() }}"</strong>
    <p>Try another word, like the item's name or category.</p>
    <button class="btn btn-outline-dark btn-sm mt-2" @click="search = ''">Clear search</button>
  </div>

  <div class="th-grid">
    <div v-for="(listing, index) in shown" :key="listing._id" v-reveal="index">
      <ListingCard :listing="listing" show-status>
        <!-- Buttons passed into the card's slot -->
        <template v-if="listing.status === 'available'">
          <RouterLink :to="`/listings/${listing._id}/edit`" class="btn btn-sm btn-outline-dark">
            <AppIcon name="edit" :size="16" />Edit
          </RouterLink>
          <button class="btn btn-sm btn-outline-danger" @click="remove(listing)">
            <AppIcon name="trash" :size="16" />Delete
          </button>
        </template>
        <small v-else class="th-muted">Part of a trade</small>
      </ListingCard>
    </div>
  </div>
</template>
