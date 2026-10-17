<script setup>
import { RouterLink } from 'vue-router'
import StatusBadge from './StatusBadge.vue'

defineProps({
  listing: Object,
  // Optional: shown on the Discover page for smart matches
  score: Number,
  mutual: Boolean,
  showStatus: Boolean,
})
</script>

<template>
  <div class="card h-100 shadow-sm">
    <div class="position-relative">
      <img
        v-if="listing.imageUrl"
        :src="listing.imageUrl"
        :alt="listing.title"
        class="card-img-top listing-img"
      />
      <div v-else class="listing-img bg-secondary-subtle d-flex align-items-center justify-content-center">
        <span class="text-secondary">No photo</span>
      </div>
      <span v-if="score" class="badge bg-dark position-absolute top-0 start-0 m-2">{{ score }}% match</span>
      <span v-if="mutual" class="badge bg-success position-absolute top-0 end-0 m-2">Mutual match</span>
    </div>

    <div class="card-body">
      <div class="d-flex justify-content-between small text-uppercase text-secondary mb-1">
        <span>{{ listing.category }}</span>
        <span class="badge bg-light text-dark border">{{ listing.condition }}</span>
      </div>
      <h6 class="card-title mb-1">
        <RouterLink :to="`/listings/${listing._id}`" class="stretched-link text-decoration-none text-dark">
          {{ listing.title }}
        </RouterLink>
      </h6>
      <p v-if="listing.lookingFor" class="card-text small text-secondary mb-1">
        Looking for: {{ listing.lookingFor }}
      </p>
      <p v-if="listing.owner?.name" class="card-text small mb-0">by {{ listing.owner.name }}</p>
      <StatusBadge v-if="showStatus" :status="listing.status" />
    </div>

    <!-- Parent pages put their own buttons here -->
    <div v-if="$slots.default" class="card-footer bg-white position-relative z-1">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.listing-img {
  height: 180px;
  object-fit: cover;
}
</style>
