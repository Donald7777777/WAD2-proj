<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import UserAvatar from './UserAvatar.vue'
import StarRating from './StarRating.vue'

// Reviews someone got from past trades: the average, a bar per star count, then each review.
// Used on the public profile page and on your own Profile page.
const props = defineProps({
  reviews: { type: Array, default: () => [] }, // [{ _id, rating, comment, from: { _id, name, avatarUrl }, createdAt }]
  rating: { type: Object, default: () => ({ average: 0, count: 0 }) },
  emptyText: { type: String, default: 'Reviews appear here after completed trades.' },
})

// How many reviews gave each number of stars (for the bars)
const breakdown = computed(() => {
  const counts = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0 }))
  for (const r of props.reviews) counts[5 - r.rating].count++
  return counts
})
const when = (date) => new Date(date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <section class="th-reviews" :class="{ 'has-reviews': reviews.length }">
    <div v-if="reviews.length" class="card th-panel th-review-summary">
      <div class="th-review-big">
        <b>{{ rating.average.toFixed(1) }}</b>
        <StarRating :model-value="rating.average" :size="20" />
        <span class="th-muted small">{{ rating.count }} review{{ rating.count === 1 ? '' : 's' }}</span>
      </div>
      <div class="th-review-bars">
        <div v-for="row in breakdown" :key="row.stars" class="th-review-bar">
          <span>{{ row.stars }}★</span>
          <span class="th-review-track"><span :style="{ width: `${(row.count / reviews.length) * 100}%` }"></span></span>
          <span class="th-muted">{{ row.count }}</span>
        </div>
      </div>
    </div>

    <div v-if="!reviews.length" class="th-empty">
      <strong>No reviews yet</strong>
      <p>{{ emptyText }}</p>
    </div>
    <div v-if="reviews.length" class="th-review-items">
    <article v-for="review in reviews" :key="review._id" class="card th-review">
      <RouterLink v-if="review.from" :to="`/users/${review.from._id}`" class="th-review-who">
        <UserAvatar :name="review.from.name" :src="review.from.avatarUrl" />
        <b>{{ review.from.name }}</b>
      </RouterLink>
      <div class="th-review-meta">
        <StarRating :model-value="review.rating" :size="16" />
        <span class="th-muted small">{{ when(review.createdAt) }}</span>
      </div>
      <p v-if="review.comment" class="th-review-text">“{{ review.comment }}”</p>
    </article>
    </div>
  </section>
</template>

<style>
.th-reviews { display: flex; flex-direction: column; gap: 12px; }
.th-review-items { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-content: start; }
/* Wide screens: the summary sits on the left (and stays put), reviews fill the rest */
@media (min-width: 992px) {
  .th-reviews.has-reviews { display: grid; grid-template-columns: 320px minmax(0, 1fr); align-items: start; gap: 20px; }
  .th-reviews.has-reviews .th-review-summary { position: sticky; top: 88px; flex-direction: column; align-items: stretch; gap: 18px; }
}
@media (min-width: 1400px) { .th-review-items { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.th-review-summary { display: flex; gap: 28px; align-items: center; flex-wrap: wrap; }
.th-review-big { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.th-review-big b { font: 750 44px/1 var(--font-display); }
.th-review-bars { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px; }
.th-review-bar { display: grid; grid-template-columns: 32px 1fr 24px; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
.th-review-track { height: 8px; border-radius: 999px; background: var(--paper-sunk); overflow: hidden; }
.th-review-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #F5B82E, #F6D84A); }
.th-review { padding: 16px; gap: 8px; }
.th-review-who { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; }
.th-review-who:hover { color: var(--ink); text-decoration: underline; }
.th-review-meta { display: flex; align-items: center; gap: 10px; }
.th-review-text { margin: 0; font-size: 15px; line-height: 22px; }
</style>
