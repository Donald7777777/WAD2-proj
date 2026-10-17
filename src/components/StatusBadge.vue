<script setup>
import { computed } from 'vue'

const props = defineProps({ status: String })

// Bootstrap background colour for each listing or trade status
const colours = {
  available: 'bg-success',
  reserved: 'bg-warning text-dark',
  traded: 'bg-secondary',
  pending: 'bg-info text-dark',
  countered: 'bg-warning text-dark',
  accepted: 'bg-primary',
  completed: 'bg-success',
  rejected: 'bg-danger',
  cancelled: 'bg-secondary',
}

const badgeClass = computed(() => colours[props.status] || 'bg-light text-dark')
</script>

<template>
  <span class="badge text-capitalize" :class="badgeClass">{{ status }}</span>
</template>
