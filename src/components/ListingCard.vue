<script setup>
import { RouterLink } from 'vue-router'
import StatusBadge from './StatusBadge.vue'
import ConditionBadge from './ConditionBadge.vue'
import UserAvatar from './UserAvatar.vue'
import AppIcon from './AppIcon.vue'

defineProps({
  listing: Object,
  // Optional: shown on the Discover page for smart matches
  score: Number,
  mutual: Boolean,
  showStatus: Boolean,
})
</script>

<template>
  <article class="card th-listing h-100">
    <div class="th-listing-media">
      <img v-if="listing.imageUrl" :src="listing.imageUrl" :alt="listing.title" loading="lazy" />
      <div v-else class="th-listing-noimg">
        <AppIcon name="image" :size="28" />
        <span>No photo yet</span>
      </div>
      <span v-if="score" class="th-match-pill">{{ score }}% match</span>
      <span v-if="mutual" class="th-badge th-badge-mutual th-listing-mutual">Mutual match</span>
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
