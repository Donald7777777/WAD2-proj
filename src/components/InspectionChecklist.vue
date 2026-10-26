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

// Checks are grouped by item (each item gets its own category's checks), then the general ones.
// Older trades have no item on their checks: they show as one list.
const groups = computed(() => {
  const out = []
  props.checklist.forEach((check, index) => {
    const key = check.item ? `${check.listing || check.item}` : '__general'
    let group = out.find((g) => g.key === key)
    if (!group) {
      group = { key, item: check.item, category: check.category, owner: check.owner, checks: [] }
      out.push(group)
    }
    group.checks.push({ ...check, index })
  })
  return out
})
const CATEGORY_ICON = { Cameras: 'camera', Tech: 'box', Clothing: 'spark', Books: 'bookmark' }
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

    <div v-for="group in groups" :key="group.key" class="th-check-group">
      <div v-if="groups.length > 1 || group.item" class="th-check-group-head">
        <template v-if="group.item">
          <AppIcon :name="CATEGORY_ICON[group.category] || 'box'" :size="16" />
          <b>{{ group.item }}</b>
          <span class="th-check-cat">{{ group.category }} checks</span>
          <span v-if="group.owner" class="th-muted small">· {{ group.owner }}'s item</span>
        </template>
        <template v-else><AppIcon name="check" :size="16" /><b>Before you swap</b></template>
      </div>
      <ul class="th-checks">
        <li v-for="item in group.checks" :key="item.index">
          <label class="th-check" :for="`check-${item.index}`">
            <input
              :id="`check-${item.index}`"
              class="form-check-input"
              type="checkbox"
              :checked="myTick(item)"
              :disabled="locked"
              @change="emit('toggle', item.index, $event.target.checked)"
            />
            <span class="th-check-text">{{ item.text }}</span>
            <span v-if="theirTick(item)" class="th-badge th-badge-them th-check-them">
              <AppIcon name="check" :size="14" />{{ otherName }}
            </span>
          </label>
        </li>
      </ul>
    </div>

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

<style>
/* One group of checks per item, headed by the item and its category */
.th-check-group + .th-check-group { border-top: 1px solid var(--line); }
.th-check-group-head {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; padding: 12px var(--space-4) 4px; font-size: 14px;
}
.th-check-cat { padding: 1px 8px; border-radius: 999px; background: var(--paper-sunk); color: var(--ink-muted); font: 600 11px/18px var(--font-sans); }
</style>
