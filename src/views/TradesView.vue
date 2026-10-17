<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge.vue'

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
  <h1 class="h4 mb-3">My trades</h1>
  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <ul class="nav nav-pills mb-3">
    <li v-for="t in tabs" :key="t.key" class="nav-item">
      <button class="nav-link" :class="{ active: tab === t.key }" @click="tab = t.key">
        {{ t.label }}
        <span v-if="grouped[t.key].length" class="badge bg-secondary ms-1">{{ grouped[t.key].length }}</span>
      </button>
    </li>
  </ul>

  <p v-if="grouped[tab].length === 0" class="text-secondary">Nothing here.</p>

  <div class="list-group">
    <RouterLink
      v-for="trade in grouped[tab]"
      :key="trade._id"
      :to="`/trades/${trade._id}`"
      class="list-group-item list-group-item-action"
    >
      <div class="d-flex justify-content-between">
        <strong>Trading with {{ otherUser(trade) }}</strong>
        <StatusBadge :status="trade.status" />
      </div>
      <div class="small text-secondary">{{ summary(trade) }}</div>
      <div v-if="trade.meetup?.name" class="small">Meetup: {{ trade.meetup.name }}, {{ trade.meetup.date }} {{ trade.meetup.time }}</div>
    </RouterLink>
  </div>
</template>
