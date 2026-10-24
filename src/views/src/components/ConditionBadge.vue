<script setup>
import { computed } from 'vue'

// Condition label with a coloured dot. The word carries the meaning; the dot is a quick visual cue.
const props = defineProps({ condition: String })

const levels = {
  'Like new': 'new',
  Excellent: 'excellent',
  Good: 'good',
  Fair: 'fair',
}

const level = computed(() => levels[props.condition] || 'good')
</script>

<template>
  <span v-if="condition" class="th-badge th-badge-cond" :data-level="level">{{ condition }}</span>
</template>
