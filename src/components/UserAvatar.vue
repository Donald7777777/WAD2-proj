<script setup>
import { ref, computed, watch } from 'vue'

// Profile picture in a circle, or initials if there is no picture (or it fails to load).
// `you` tints the initials lime (your side); everyone else is lagoon (their side).
const props = defineProps({
  name: { type: String, default: '' },
  src: { type: String, default: '' },
  you: Boolean,
  size: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg' | 'xl'
})

const broken = ref(false)
watch(
  () => props.src,
  () => (broken.value = false),
)

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
  <span class="th-avatar" :class="[`th-avatar-${size}`, { 'th-avatar-you': you, 'has-photo': src && !broken }]" aria-hidden="true">
    <img v-if="src && !broken" :src="src" alt="" loading="lazy" @error="broken = true" />
    <template v-else>{{ initials || '?' }}</template>
  </span>
</template>

<style>
.th-avatar { overflow: hidden; }
.th-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.th-avatar.has-photo { background: var(--paper-sunk); }
.th-avatar-xl { width: 112px; height: 112px; font-size: 38px; }
</style>
