<script setup>
import { computed } from 'vue'

const props = defineProps({
  checklist: Array,
  isProposer: Boolean,
  myConfirmed: Boolean,
  theirConfirmed: Boolean,
  // True once the trade is completed (or no longer accepted)
  locked: Boolean,
})
const emit = defineEmits(['toggle', 'confirm'])

function myTick(item) {
  return props.isProposer ? item.proposerChecked : item.receiverChecked
}

function theirTick(item) {
  return props.isProposer ? item.receiverChecked : item.proposerChecked
}

const myCount = computed(() => props.checklist.filter(myTick).length)
const theirCount = computed(() => props.checklist.filter(theirTick).length)
const allMine = computed(() => myCount.value === props.checklist.length)
</script>

<template>
  <div class="card">
    <div class="card-header fw-semibold">Inspection checklist</div>
    <div class="card-body">
      <p class="small text-secondary">
        Check each item at the meetup. The trade completes only when both of you tick everything and confirm.
      </p>

      <div class="small mb-1">You: {{ myCount }}/{{ checklist.length }}</div>
      <div class="progress mb-2" role="progressbar" :aria-valuenow="myCount" :aria-valuemax="checklist.length">
        <div class="progress-bar bg-success" :style="{ width: (myCount / checklist.length) * 100 + '%' }"></div>
      </div>
      <div class="small mb-1">Other user: {{ theirCount }}/{{ checklist.length }}</div>
      <div class="progress mb-3" role="progressbar" :aria-valuenow="theirCount" :aria-valuemax="checklist.length">
        <div class="progress-bar bg-info" :style="{ width: (theirCount / checklist.length) * 100 + '%' }"></div>
      </div>

      <ul class="list-group mb-3">
        <li v-for="(item, index) in checklist" :key="item.text" class="list-group-item d-flex align-items-center">
          <input
            :id="`check-${index}`"
            class="form-check-input me-2"
            type="checkbox"
            :checked="myTick(item)"
            :disabled="locked"
            @change="emit('toggle', index, $event.target.checked)"
          />
          <label class="form-check-label flex-grow-1" :for="`check-${index}`">{{ item.text }}</label>
          <span v-if="theirTick(item)" class="badge bg-info text-dark">Other user ✓</span>
        </li>
      </ul>

      <div v-if="!locked">
        <button class="btn btn-success" :disabled="!allMine || myConfirmed" @click="emit('confirm')">
          {{ myConfirmed ? 'You confirmed' : 'Confirm handover' }}
        </button>
        <span class="small text-secondary ms-2">
          {{ theirConfirmed ? 'The other user has confirmed.' : 'Waiting for the other user to confirm.' }}
        </span>
      </div>
    </div>
  </div>
</template>
