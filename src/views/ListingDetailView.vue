<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge.vue'

const auth = useAuthStore()
const route = useRoute()

const listing = ref(null)
const error = ref('')

const isOwner = computed(() => auth.user && listing.value?.owner._id === auth.user._id)

onMounted(async () => {
  try {
    const response = await api.get(`/listings/${route.params.id}`)
    listing.value = response.data
  } catch (e) {
    error.value = errorMessage(e)
  }
})
</script>

<template>
  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <div v-if="listing" class="row g-4">
    <div class="col-md-6">
      <img v-if="listing.imageUrl" :src="listing.imageUrl" :alt="listing.title" class="img-fluid rounded shadow-sm w-100" />
      <div v-else class="bg-secondary-subtle rounded d-flex align-items-center justify-content-center placeholder-img">
        <span class="text-secondary">No photo</span>
      </div>
    </div>

    <div class="col-md-6">
      <p class="text-uppercase small text-secondary mb-1">{{ listing.category }}</p>
      <h1 class="h3">{{ listing.title }}</h1>
      <p>
        <span class="badge bg-light text-dark border me-1">{{ listing.condition }}</span>
        <StatusBadge :status="listing.status" />
      </p>
      <p style="white-space: pre-line">{{ listing.description }}</p>
      <p v-if="listing.lookingFor"><strong>Looking for:</strong> {{ listing.lookingFor }}</p>
      <p class="text-secondary small">Listed by {{ listing.owner.name }}</p>

      <RouterLink v-if="isOwner" :to="`/listings/${listing._id}/edit`" class="btn btn-outline-dark">
        Edit listing
      </RouterLink>
      <template v-else-if="listing.status === 'available'">
        <RouterLink v-if="auth.user" :to="`/listings/${listing._id}/propose`" class="btn btn-success btn-lg">
          Offer a trade
        </RouterLink>
        <RouterLink v-else :to="{ name: 'login', query: { redirect: route.fullPath } }" class="btn btn-success">
          Log in to offer a trade
        </RouterLink>
      </template>
      <p v-else class="text-secondary">This item is no longer available.</p>
    </div>
  </div>
</template>

<style scoped>
.placeholder-img {
  height: 320px;
}
</style>
