<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge.vue'
import AppIcon from '@/components/AppIcon.vue'
import { formatMeetup, placeName } from '@/lib/format'

const auth = useAuthStore()

const trades = ref([])
const tab = ref('action')
const error = ref('')

const tabs = [
  { key: 'action', label: 'Needs your reply' },
  { key: 'waiting', label: 'Waiting on them' },
  { key: 'active', label: 'Active trades' },
  { key: 'history', label: 'History' },
]

function isOpen(trade) {
  return trade.status === 'pending' || trade.status === 'countered'
}

// Sort trades into the four tabs
const grouped = computed(() => ({
  action: trades.value.filter((t) => isOpen(t) && t.turn === auth.user._id),
  waiting: trades.value.filter((t) => isOpen(t) && t.turn !== auth.user._id),
  active: trades.value.filter((t) => t.status === 'accepted'),
  history: trades.value.filter((t) => ['completed', 'rejected', 'cancelled'].includes(t.status)),
}))

function otherUser(trade) {
  return trade.proposer._id === auth.user._id ? trade.receiver.name : trade.proposer.name
}

// Items on each side, for the thumbnails
function sides(trade) {
  const iAmProposer = trade.proposer._id === auth.user._id
  return {
    mine: iAmProposer ? trade.offeredListings : trade.requestedListings,
    theirs: iAmProposer ? trade.requestedListings : trade.offeredListings,
  }
}

// My items and their items, whichever side I'm on
function summary(trade) {
  const iAmProposer = trade.proposer._id === auth.user._id
  const mine = iAmProposer ? trade.offeredListings : trade.requestedListings
  const theirs = iAmProposer ? trade.requestedListings : trade.offeredListings
  const titles = (list) => list.map((l) => l.title).join(', ')
  return `Your ${titles(mine)} for their ${titles(theirs)}`
}

onMounted(async () => {
  try {
    const response = await api.get('/trades')
    trades.value = response.data
  } catch (e) {
    error.value = errorMessage(e)
  }
})
</script>

<template>
  <div class="th-page-head">
    <div>
      <h1>My trades</h1>
      <p>Proposals, meetups and everything you've swapped.</p>
    </div>
  </div>
  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <div class="th-chips mb-4" role="group" aria-label="Trade lists">
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      class="th-chip"
      :aria-pressed="tab === t.key ? 'true' : 'false'"
      @click="tab = t.key"
    >
      {{ t.label }}
      <span v-if="grouped[t.key].length" class="th-count">{{ grouped[t.key].length }}</span>
    </button>
  </div>

  <div v-if="grouped[tab].length === 0" class="th-empty">
    <strong>Nothing here</strong>
    <p v-if="tab === 'action'">No one is waiting on you. Find something on Discover to offer a trade.</p>
    <p v-else>Trades will show up here as they move along.</p>
  </div>

  <div class="th-trade-list">
    <RouterLink v-for="trade in grouped[tab]" :key="trade._id" :to="`/trades/${trade._id}`" class="card th-trade-row">
      <span class="th-trade-thumbs" aria-hidden="true">
        <span class="th-thumb th-thumb-you">
          <img v-if="sides(trade).mine[0]?.imageUrl" :src="sides(trade).mine[0].imageUrl" alt="" />
          <AppIcon v-else name="image" :size="18" />
        </span>
        <span class="th-thumb-swap"><AppIcon name="swap" :size="14" /></span>
        <span class="th-thumb th-thumb-them">
          <img v-if="sides(trade).theirs[0]?.imageUrl" :src="sides(trade).theirs[0].imageUrl" alt="" />
          <AppIcon v-else name="image" :size="18" />
        </span>
      </span>
      <span class="th-trade-row-body">
        <span class="th-trade-row-top">
          <b>Trading with {{ otherUser(trade) }}</b>
          <StatusBadge :status="trade.status" />
        </span>
        <span class="th-trade-row-summary">{{ summary(trade) }}</span>
        <span v-if="trade.meetup?.name" class="th-trade-row-meet">
          <AppIcon name="pin" :size="16" />{{ placeName(trade.meetup.name) }} · {{ formatMeetup(trade.meetup.date, trade.meetup.time) }}
        </span>
      </span>
      <AppIcon name="chevron" class="th-trade-row-chev d-none d-sm-block" />
    </RouterLink>
  </div>
</template>
