<script setup>
import { computed } from 'vue'

import AppIcon from './AppIcon.vue'

const props = defineProps({
  // Shown instead of "Other user"
  otherName: { type: String, default: 'Other user' },
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
  <section class="card th-checklist" aria-labelledby="checklist-title">
    <div class="th-card-head">
      <span class="th-card-icon"><AppIcon name="check" /></span>
      <div>
        <h2 id="checklist-title">Inspection checklist</h2>
        <p>Check each item at the meetup. The trade completes only when both of you tick everything and confirm.</p>
      </div>
    </div>

    <div class="th-check-progress">
      <div class="th-progress-row th-progress-you">
        <span>You</span>
        <div class="progress" role="progressbar" :aria-valuenow="myCount" :aria-valuemax="checklist.length" aria-label="Your progress">
          <div class="progress-bar" :style="{ width: (myCount / checklist.length) * 100 + '%' }"></div>
        </div>
        <span class="data">{{ myCount }}/{{ checklist.length }}</span>
      </div>
      <div class="th-progress-row th-progress-them">
        <span>{{ otherName }}</span>
        <div class="progress" role="progressbar" :aria-valuenow="theirCount" :aria-valuemax="checklist.length" :aria-label="`${otherName}'s progress`">
          <div class="progress-bar" :style="{ width: (theirCount / checklist.length) * 100 + '%' }"></div>
        </div>
        <span class="data">{{ theirCount }}/{{ checklist.length }}</span>
      </div>
    </div>

    <ul class="th-checks">
      <li v-for="(item, index) in checklist" :key="item.text">
        <label class="th-check" :for="`check-${index}`">
          <input
            :id="`check-${index}`"
            class="form-check-input"
            type="checkbox"
            :checked="myTick(item)"
            :disabled="locked"
            @change="emit('toggle', index, $event.target.checked)"
          />
          <span class="th-check-text">{{ item.text }}</span>
          <span v-if="theirTick(item)" class="th-badge th-badge-them th-check-them">
            <AppIcon name="check" :size="14" />{{ otherName }}
          </span>
        </label>
      </li>
    </ul>

    <div v-if="!locked" class="th-checklist-foot">
      <button class="btn btn-primary" :disabled="!allMine || myConfirmed" @click="emit('confirm')">
        <AppIcon name="check" />{{ myConfirmed ? 'You confirmed' : 'Confirm handover' }}
      </button>
      <span class="small th-muted">
        {{ theirConfirmed ? `${otherName} has confirmed.` : `Waiting for ${otherName} to confirm.` }}
        <template v-if="!allMine"> Tick every item to unlock.</template>
      </span>
    </div>
    <div v-else-if="myConfirmed && theirConfirmed" class="th-checklist-foot">
      <div class="alert alert-success mb-0 w-100" role="status">
        <strong>Trade complete.</strong> Both of you confirmed the handover.
      </div>
    </div>
  </section>
</template>
