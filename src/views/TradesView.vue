<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { api, errorMessage } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge.vue'
import AppIcon from '@/components/AppIcon.vue'
import { formatMeetup, placeName } from '@/lib/format'

// My trades, sorted by what needs me:
//   Needs action: it's your turn (reply to an offer, pick a meetup, tick the checklist, confirm)
//   In progress:  waiting on the other person
//   Done:         completed, declined or cancelled
// Each row also shows unread chat messages and whether other offers compete for the same items.
const auth = useAuthStore()
const notes = useNotificationStore()

const trades = ref([])
const loaded = ref(false)
const tab = ref('')
const error = ref('')

const tabs = [
  { key: 'action', label: 'Needs action', icon: 'alert' },
  { key: 'progress', label: 'In progress', icon: 'clock' },
  { key: 'done', label: 'Done', icon: 'check' },
]

const me = computed(() => auth.user._id)
const isOpen = (t) => t.status === 'pending' || t.status === 'countered'
const iAmProposer = (t) => t.proposer._id === me.value

// The next thing *I* need to do on a trade, or '' if it's on them
function myStep(t) {
  if (isOpen(t)) return t.turn === me.value ? (t.status === 'countered' ? 'Reply to their counter offer' : 'Reply to the offer') : ''
  if (t.status !== 'accepted') return ''
  if (!t.meetup?.name) return 'Pick a meetup spot'
  const mine = iAmProposer(t) ? 'proposerChecked' : 'receiverChecked'
  const confirmed = iAmProposer(t) ? t.proposerConfirmed : t.receiverConfirmed
  if (t.checklist.some((c) => !c[mine])) return 'Tick the checklist at the meetup'
  if (!confirmed) return 'Confirm the handover'
  return ''
}
// What we're waiting for, when it's on them
function theirStep(t) {
  const name = otherUser(t)
  if (isOpen(t)) return `Waiting for ${name} to reply`
  if (t.status === 'accepted') return t.meetup?.name ? `Waiting for ${name} to confirm the handover` : `Waiting for ${name} to pick a meetup`
  return ''
}

const grouped = computed(() => {
  const live = trades.value.filter((t) => isOpen(t) || t.status === 'accepted')
  return {
    action: live.filter((t) => myStep(t)),
    progress: live.filter((t) => !myStep(t)),
    done: trades.value.filter((t) => ['completed', 'rejected', 'cancelled'].includes(t.status)),
  }
})
const shown = computed(() => grouped.value[tab.value] || [])
const unreadIn = (key) => grouped.value[key].reduce((sum, t) => sum + (t.unread || 0), 0)

function otherUser(trade) {
  return iAmProposer(trade) ? trade.receiver.name : trade.proposer.name
}

// Items on each side, for the thumbnails
function sides(trade) {
  return {
    mine: iAmProposer(trade) ? trade.offeredListings : trade.requestedListings,
    theirs: iAmProposer(trade) ? trade.requestedListings : trade.offeredListings,
  }
}

// My items and their items, whichever side I'm on
function summary(trade) {
  const titles = (list) => list.map((l) => l.title).join(', ')
  return `Your ${titles(sides(trade).mine)} for their ${titles(sides(trade).theirs)}`
}

async function load() {
  try {
    const response = await api.get('/trades')
    trades.value = response.data
    error.value = ''
    // Start on the first tab that has something in it
    if (!tab.value) tab.value = grouped.value.action.length ? 'action' : grouped.value.progress.length ? 'progress' : 'done'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loaded.value = true
  }
}
onMounted(load)

// Something happened (a message, an answer…): refresh the list, at most once a second
let refreshTimer = null
function refreshSoon() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(load, 800)
}
watch(() => notes.ringKey, refreshSoon)
const stop = notes.onTradeEvent((event) => event.type === 'chat' && refreshSoon())
onUnmounted(() => {
  stop()
  clearTimeout(refreshTimer)
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

  <div class="th-chips mb-4" role="tablist" aria-label="Trade lists">
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      role="tab"
      class="th-chip"
      :class="{ 'th-chip-urgent': t.key === 'action' && grouped.action.length }"
      :aria-selected="tab === t.key ? 'true' : 'false'"
      :aria-pressed="tab === t.key ? 'true' : 'false'"
      @click="tab = t.key"
    >
      <AppIcon :name="t.icon" :size="15" />{{ t.label }}
      <span v-if="grouped[t.key].length" class="th-count">{{ grouped[t.key].length }}</span>
      <span v-if="unreadIn(t.key)" class="th-unread-dot" :aria-label="`${unreadIn(t.key)} unread messages`"></span>
    </button>
  </div>

  <div v-if="!loaded" class="th-trade-list">
    <div v-for="n in 3" :key="n" class="th-skeleton" style="aspect-ratio: auto; height: 92px"></div>
  </div>
  <div v-else-if="shown.length === 0" class="th-empty">
    <strong>Nothing here</strong>
    <p v-if="tab === 'action'">Nothing is waiting on you right now.</p>
    <p v-else-if="tab === 'progress'">No trades in progress. Find something on Discover to offer a trade.</p>
    <p v-else>Finished, declined and cancelled trades show up here.</p>
    <RouterLink v-if="tab !== 'done'" to="/discover" class="btn btn-primary btn-sm mt-2">Browse listings</RouterLink>
  </div>

  <div class="th-trade-list">
    <RouterLink
      v-for="trade in shown"
      :key="trade._id"
      :to="`/trades/${trade._id}`"
      class="card th-trade-row"
      :class="{ 'is-action': tab === 'action', 'has-unread': trade.unread }"
    >
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
          <span v-if="trade.unread" class="th-trade-flag th-flag-unread">
            <AppIcon name="chat" :size="13" />{{ trade.unread }} new
          </span>
          <span v-if="trade.competing" class="th-trade-flag th-flag-compete" :title="`${trade.competing} other offer(s) involve the same items`">
            <AppIcon name="swap" :size="13" />{{ trade.competing }} competing
          </span>
        </span>
        <span class="th-trade-row-summary">{{ summary(trade) }}</span>
        <span v-if="myStep(trade)" class="th-trade-next is-mine"><AppIcon name="spark" :size="14" />Your turn: {{ myStep(trade) }}</span>
        <span v-else-if="theirStep(trade)" class="th-trade-next"><AppIcon name="clock" :size="14" />{{ theirStep(trade) }}</span>
        <span v-if="trade.meetup?.name" class="th-trade-row-meet">
          <AppIcon name="pin" :size="16" />{{ placeName(trade.meetup.name) }} · {{ formatMeetup(trade.meetup.date, trade.meetup.time) }}
        </span>
      </span>
      <AppIcon name="chevron" class="th-trade-row-chev d-none d-sm-block" />
    </RouterLink>
  </div>
</template>

<style>
.th-chip-urgent:not([aria-pressed="true"]) { border-color: var(--brick); }
.th-unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--brick); }
.th-trade-row.is-action { box-shadow: inset 4px 0 0 var(--lime-ink), var(--shadow-card); }
.th-trade-flag {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font: 700 11px/16px var(--font-sans);
}
.th-flag-unread { background: var(--brick); color: #fff; }
.th-flag-compete { background: #FBEFCB; color: #7A5500; }
[data-theme="dark"] .th-flag-compete { background: #3A3215; color: #F6E7B8; }
.th-trade-next { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-muted); }
.th-trade-next.is-mine { color: var(--lime-ink); font-weight: 700; }
[data-theme="dark"] .th-trade-next.is-mine { color: var(--lime); }
.th-trade-row-top { flex-wrap: wrap; justify-content: flex-start; gap: 6px 8px; }
.th-trade-row-top > b { margin-right: 4px; }
</style>
