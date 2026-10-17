<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import { deleteImage } from '@/lib/storage'
import ListingCard from '@/components/ListingCard.vue'

const listings = ref([])
const error = ref('')

async function load() {
  try {
    const response = await api.get('/listings/mine')
    listings.value = response.data
  } catch (e) {
    error.value = errorMessage(e)
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
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h1 class="h4 mb-0">My listings</h1>
    <RouterLink to="/listings/new" class="btn btn-success">+ New listing</RouterLink>
  </div>

  <div v-if="error" class="alert alert-danger">{{ error }}</div>
  <p v-if="listings.length === 0" class="text-secondary">You haven't listed anything yet.</p>

  <div class="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
    <div v-for="listing in listings" :key="listing._id" class="col">
      <ListingCard :listing="listing" show-status>
        <!-- Buttons passed into the card's slot -->
        <template v-if="listing.status === 'available'">
          <RouterLink :to="`/listings/${listing._id}/edit`" class="btn btn-sm btn-outline-dark me-2">Edit</RouterLink>
          <button class="btn btn-sm btn-outline-danger" @click="remove(listing)">Delete</button>
        </template>
        <small v-else class="text-secondary">Part of a trade</small>
      </ListingCard>
    </div>
  </div>
</template>
