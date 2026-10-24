<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import { deleteImage } from '@/lib/storage'
import ListingCard from '@/components/ListingCard.vue'
import AppIcon from '@/components/AppIcon.vue'

const listings = ref([])
const error = ref('')
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const response = await api.get('/listings/mine')
    listings.value = response.data
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
    if (response.data.imagePath) {
      deleteImage(response.data.imagePath).catch(() => {})
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

  <div class="th-grid">
    <div v-for="(listing, index) in listings" :key="listing._id" v-reveal="index">
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
