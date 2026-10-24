<script setup>
import AppIcon from './AppIcon.vue'
import ConditionBadge from './ConditionBadge.vue'

// A grid of listings the user can tick, used when proposing or countering a trade
defineProps({
  listings: Array,
  selectedIds: Array,
  // Which side these items are on: 'you' (persimmon) or 'them' (cobalt)
  side: { type: String, default: 'you' },
})
const emit = defineEmits(['toggle'])
</script>

<template>
  <p v-if="listings.length === 0" class="th-muted">No available items.</p>
  <div class="th-picker" :data-side="side">
    <label
      v-for="listing in listings"
      :key="listing._id"
      class="th-pick"
      :class="{ 'is-selected': selectedIds.includes(listing._id) }"
    >
      <input
        class="visually-hidden"
        type="checkbox"
        :checked="selectedIds.includes(listing._id)"
        @change="emit('toggle', listing._id)"
      />
      <span class="th-pick-thumb">
        <img v-if="listing.imageUrl" :src="listing.imageUrl" :alt="listing.title" />
        <AppIcon v-else name="image" />
      </span>
      <span class="th-pick-text">
        <span class="th-pick-title">{{ listing.title }}</span>
        <span class="th-pick-meta">{{ listing.category }} · <ConditionBadge :condition="listing.condition" /></span>
      </span>
      <span class="th-pick-check" aria-hidden="true"><AppIcon name="check" :size="16" /></span>
    </label>
  </div>
</template>
