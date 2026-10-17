<script setup>
// A grid of listings the user can tick, used when proposing or countering a trade
defineProps({
  listings: Array,
  selectedIds: Array,
})
const emit = defineEmits(['toggle'])
</script>

<template>
  <p v-if="listings.length === 0" class="text-secondary">No available items.</p>
  <div class="row row-cols-2 row-cols-md-3 g-2">
    <div v-for="listing in listings" :key="listing._id" class="col">
      <label
        class="card h-100 p-2 picker-card"
        :class="{ 'border-success border-2': selectedIds.includes(listing._id) }"
      >
        <div class="form-check">
          <input
            class="form-check-input"
            type="checkbox"
            :checked="selectedIds.includes(listing._id)"
            @change="emit('toggle', listing._id)"
          />
          <span class="form-check-label small fw-semibold">{{ listing.title }}</span>
        </div>
        <img v-if="listing.imageUrl" :src="listing.imageUrl" :alt="listing.title" class="rounded mt-2 picker-img" />
        <small class="text-secondary mt-1">{{ listing.category }} · {{ listing.condition }}</small>
      </label>
    </div>
  </div>
</template>

<style scoped>
.picker-card {
  cursor: pointer;
}
.picker-img {
  height: 90px;
  object-fit: cover;
}
</style>
