<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { vTilt, countUp, whenVisible, prefersReducedMotion } from '@/lib/motion'
import StatusBadge from './StatusBadge.vue'
import ConditionBadge from './ConditionBadge.vue'
import UserAvatar from './UserAvatar.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  listing: Object,
  // Optional: shown on the Discover page for smart matches
  score: Number,
  mutual: Boolean,
  showStatus: Boolean,
})

// The match % counts up from 0 the first time the card scrolls into view
const shownScore = ref(props.score)
const pill = ref(null)
let stopWatching = () => {}
onMounted(() => {
  if (!props.score || prefersReducedMotion() || !('IntersectionObserver' in window)) return
  shownScore.value = 0
  stopWatching = whenVisible(pill.value, () => countUp(props.score, (n) => (shownScore.value = n)))
})
onUnmounted(() => stopWatching())
</script>

<template>
  <article v-tilt class="card th-listing h-100">
    <div class="th-listing-media">
      <img v-if="listing.imageUrl" :src="listing.imageUrl" :alt="listing.title" loading="lazy" />
      <div v-else class="th-listing-noimg">
        <AppIcon name="image" :size="28" />
        <span>No photo yet</span>
      </div>
      <span v-if="score" ref="pill" class="th-match-pill">{{ shownScore }}% match</span>
      <span v-if="mutual" class="th-badge th-badge-mutual th-listing-mutual">
        <!-- Mini logo smile: draws from one dot to the other when you hover the card -->
        <svg class="th-mini-smile" width="22" height="14" viewBox="0 0 22 14" aria-hidden="true">
          <circle cx="4" cy="4" r="2.6" fill="#10302A" />
          <circle cx="18" cy="4" r="2.6" fill="#10302A" />
          <path d="M4 4 C2 13 20 13 18 4" pathLength="1" />
        </svg>
        Mutual match
      </span>
    </div>

    <div class="card-body th-listing-body">
      <div class="th-listing-meta">
        <span class="eyebrow">{{ listing.category }}</span>
        <ConditionBadge :condition="listing.condition" />
      </div>
      <h3 class="th-listing-title">
        <RouterLink :to="`/listings/${listing._id}`" class="stretched-link">{{ listing.title }}</RouterLink>
      </h3>
      <p v-if="listing.lookingFor" class="th-listing-wants">
        Looking for: <b>{{ listing.lookingFor }}</b>
      </p>
      <div class="th-listing-owner">
        <template v-if="listing.owner?.name">
          <UserAvatar :name="listing.owner.name" size="sm" />
          <span>by {{ listing.owner.name }}</span>
        </template>
        <StatusBadge v-if="showStatus" :status="listing.status" class="ms-auto" />
      </div>
    </div>

    <!-- Parent pages put their own buttons here -->
    <div v-if="$slots.default" class="card-footer th-listing-foot position-relative z-1">
      <slot></slot>
    </div>
  </article>
</template>
