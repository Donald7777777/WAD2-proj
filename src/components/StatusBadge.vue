<script setup>
import { computed } from 'vue'

const props = defineProps({ status: String })

// Design-system badge style and wording for each listing or trade status
const styles = {
  available: ['success', 'Available'],
  reserved: ['neutral', 'Reserved'],
  traded: ['muted', 'Traded'],
  pending: ['neutral', 'Pending'],
  countered: ['them', 'Countered'],
  accepted: ['them', 'Accepted'],
  completed: ['success', 'Completed'],
  rejected: ['danger', 'Declined'],
  cancelled: ['muted', 'Cancelled'],
}

const style = computed(() => styles[props.status] || ['neutral', props.status])
</script>

<template>
  <span class="th-badge" :class="`th-badge-${style[0]}`">{{ style[1] }}</span>
</template>
