<script setup>
import { computed } from 'vue'

// Initials in a circle. `you` tints it lime (your side); everyone else is lagoon (their side).
const props = defineProps({
  name: { type: String, default: '' },
  you: Boolean,
  size: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
})

const initials = computed(() =>
  props.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join(''),
)
</script>

<template>
  <span class="th-avatar" :class="[`th-avatar-${size}`, { 'th-avatar-you': you }]" aria-hidden="true">
    {{ initials || '?' }}
  </span>
</template>
