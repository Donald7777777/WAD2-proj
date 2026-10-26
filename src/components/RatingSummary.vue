<script setup>
import StarRating from './StarRating.vue'

// "★★★★½ 4.5 · 12 reviews", or "No reviews yet"
defineProps({
  rating: { type: Object, default: () => ({ average: 0, count: 0 }) },
  size: { type: Number, default: 16 },
})
</script>

<template>
  <span class="th-rating">
    <template v-if="rating.count">
      <StarRating :model-value="rating.average" :size="size" />
      <b>{{ rating.average.toFixed(1) }}</b>
      <span class="th-muted">· {{ rating.count }} review{{ rating.count === 1 ? '' : 's' }}</span>
    </template>
    <span v-else class="th-muted">No reviews yet</span>
  </span>
</template>

<style>
.th-rating { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; flex-wrap: wrap; }
</style>
