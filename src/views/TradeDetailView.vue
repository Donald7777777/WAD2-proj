<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import ItemPicker from '@/components/ItemPicker.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ChatBox from '@/components/ChatBox.vue'
import MeetupPicker from '@/components/MeetupPicker.vue'
import InspectionChecklist from '@/components/InspectionChecklist.vue'
import TradeTimeline from '@/components/TradeTimeline.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import AppIcon from '@/components/AppIcon.vue'
import TradeMoment from '@/components/TradeMoment.vue'
import AddMoreRequests from '@/components/AddMoreRequests.vue'
import { showToast } from '@/lib/toast'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const trade = ref(null)
const error = ref('')

// Counter-offer state
const countering = ref(false)
const proposerItems = ref([])
const receiverItems = ref([])
const counterOffered = ref([])
const counterRequested = ref([])

const isProposer = computed(() => trade.value.proposer._id === auth.user._id)
const otherName = computed(() => (isProposer.value ? trade.value.receiver.name : trade.value.proposer.name))
const myItems = computed(() => (isProposer.value ? trade.value.offeredListings : trade.value.requestedListings))
const theirItems = computed(() => (isProposer.value ? trade.value.requestedListings : trade.value.offeredListings))
const isOpen = computed(() => ['pending', 'countered'].includes(trade.value.status))
const myTurn = computed(() => isOpen.value && trade.value.turn === auth.user._id)
const showMeetup = computed(() => ['accepted', 'completed'].includes(trade.value.status))
const myConfirmed = computed(() =>
  isProposer.value ? trade.value.proposerConfirmed : trade.value.receiverConfirmed,
)
const theirConfirmed = computed(() =>
  isProposer.value ? trade.value.receiverConfirmed : trade.value.proposerConfirmed,
)

// Which of the five timeline steps is in progress (display only)
const timelineStep = computed(() => {
  const t = trade.value
  if (t.status === 'completed') return 5
  if (isOpen.value) return 1
  if (!t.meetup?.name) return 2
  const allTicked = t.checklist.length > 0 && t.checklist.every((c) => c.proposerChecked && c.receiverChecked)
  return allTicked ? 4 : 3
})
const isClosed = computed(() => ['rejected', 'cancelled'].includes(trade.value.status))

// ---------- The pop-up moment (TradeMoment.vue) ----------
// Shown when the trade is accepted (the smile connects you both) or called off (it snaps).
// Both sides see it: live if the page is open, or once the next time they open an accepted trade.
const moment = ref(null) // null | { kind: 'linked' | 'broken', title }
let iDidIt = false // so your own decline/withdraw gets a quiet toast instead of the full pop-up

const seenKey = () => `th-linked-${trade.value._id}`
function markSeen() {
  try {
    localStorage.setItem(seenKey(), '1')
  } catch {
    // Private mode etc.: worst case the pop-up shows again next time
  }
}
function alreadySeen() {
  try {
    return localStorage.getItem(seenKey()) === '1'
  } catch {
    return false
  }
}

function showLinked() {
  moment.value = { kind: 'linked' }
  markSeen()
}

watch(
  () => trade.value?.status,
  (now, before) => {
    if (!now) return
    // First load: celebrate an accepted trade you haven't seen yet (e.g. the seller accepted while you were away)
    if (!before) {
      if (now === 'accepted' && !alreadySeen()) showLinked()
      return
    }
    const wasOpen = ['pending', 'countered'].includes(before)
    if (wasOpen && now === 'accepted') showLinked()
    else if (before === 'accepted' && now === 'cancelled') moment.value = { kind: 'broken', title: 'Trade cancelled' }
    else if (wasOpen && (now === 'rejected' || now === 'cancelled') && !iDidIt) {
      moment.value =
        now === 'rejected'
          ? { kind: 'declined', title: 'Proposal declined' }
          : { kind: 'broken', title: 'Proposal withdrawn' }
    }
    iDidIt = false
  },
)

// Declined pop-up: try again for the same item, or go back to browsing
function retryOffer() {
  const item = theirItems.value[0]
  moment.value = null
  router.push(item ? `/listings/${item._id}/propose` : '/discover')
}
function keepBrowsing() {
  moment.value = null
  router.push('/discover')
}

// "Pick a meetup spot": close the pop-up and scroll to the meetup card
async function goToMeetup() {
  moment.value = null
  await nextTick()
  document.querySelector('.th-meetup')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function loadTrade() {
  try {
    const response = await api.get(`/trades/${route.params.id}`)
    trade.value = response.data
    findNewerTrade()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// On a cancelled/declined trade: is there a newer trade with the same person for the same item?
// (e.g. you cancelled, then made a new offer.) If so, show a link to it.
const newerTrade = ref(null)
async function findNewerTrade() {
  newerTrade.value = null
  if (!isClosed.value) return
  try {
    const { data: trades } = await api.get('/trades')
    const people = (t) => [t.proposer._id, t.receiver._id].sort().join(':')
    const items = (t) => [...t.requestedListings, ...t.offeredListings].filter(Boolean).map((l) => l._id)
    const mine = new Set(items(trade.value))
    newerTrade.value =
      trades
        .filter(
          (t) =>
            t._id !== trade.value._id &&
            new Date(t.createdAt) > new Date(trade.value.createdAt) &&
            people(t) === people(trade.value) &&
            items(t).some((id) => mine.has(id)),
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  } catch {
    // Not important enough to show an error
  }
}

// Shared helper for accept / reject / cancel / confirm etc.
async function action(method, path, body) {
  error.value = ''
  try {
    const response = await api[method](`/trades/${trade.value._id}/${path}`, body)
    trade.value = response.data
    return true
  } catch (e) {
    error.value = errorMessage(e)
    return false
  }
}

async function acceptTrade() {
  // The pop-up appears from the status watcher above
  await action('post', 'accept')
}

async function rejectTrade() {
  iDidIt = true
  if (await action('post', 'reject')) showToast('Proposal declined.', { tone: 'info', icon: 'x' })
}

async function confirmHandover() {
  if ((await action('post', 'confirm')) && trade.value.status === 'completed') {
    showToast('Traded! Enjoy your new item.')
  }
}

async function cancelTrade() {
  if (!confirm('Cancel this trade?')) return
  // Withdrawing your own open proposal is quiet; cancelling an accepted trade shows the link snapping
  iDidIt = isOpen.value
  if ((await action('post', 'cancel')) && iDidIt) {
    showToast('Proposal withdrawn.', { tone: 'info', icon: 'x' })
  }
}

// Counter offer: load both users' available items so either side can be changed
async function startCounter() {
  const [proposerResponse, receiverResponse] = await Promise.all([
    api.get('/listings', { params: { owner: trade.value.proposer._id } }),
    api.get('/listings', { params: { owner: trade.value.receiver._id } }),
  ])
  proposerItems.value = proposerResponse.data
  receiverItems.value = receiverResponse.data
  counterOffered.value = trade.value.offeredListings.map((l) => l._id)
  counterRequested.value = trade.value.requestedListings.map((l) => l._id)
  countering.value = true
}

function toggleIn(list, id) {
  const index = list.indexOf(id)
  if (index === -1) list.push(id)
  else list.splice(index, 1)
}

async function sendCounter() {
  const ok = await action('post', 'counter', {
    offeredListingIds: counterOffered.value,
    requestedListingIds: counterRequested.value,
  })
  if (ok) countering.value = false
}

onMounted(loadTrade)
</script>

<template>
  <RouterLink to="/trades" class="th-back"><AppIcon name="back" :size="18" />My trades</RouterLink>
  <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

  <template v-if="trade">
    <header class="th-trade-head">
      <UserAvatar :name="otherName" size="lg" />
      <div class="th-trade-head-text">
        <h1>Trade with {{ otherName }}</h1>
        <StatusBadge :status="trade.status" />
      </div>
    </header>
    <!-- Pop-up when the trade is accepted (smile connects) or called off (smile snaps) -->
    <TradeMoment
      v-if="moment"
      :kind="moment.kind"
      :broken-title="moment.title"
      :you="auth.user.name"
      :them="otherName"
      :give="myItems.map((l) => l.title)"
      :get="theirItems.map((l) => l.title)"
      @close="moment = null"
      @next="goToMeetup"
      @retry="retryOffer"
      @browse="keepBrowsing"
    />
    <TradeTimeline v-if="!isClosed" :current="timelineStep" class="mb-4" />
    <div v-else class="alert alert-light mb-4">
      This trade was {{ trade.status === 'rejected' ? 'declined' : 'cancelled' }}. The items are available again.
    </div>
    <!-- You made a new offer for the same item after this one was closed: point to it -->
    <RouterLink v-if="newerTrade" :to="`/trades/${newerTrade._id}`" class="th-newer-trade mb-4">
      <span class="th-newer-icon"><AppIcon name="swap" :size="18" /></span>
      <span class="th-newer-text">
        <b>There's a newer trade for this item</b>
        <span>This one is closed. Your latest offer with {{ otherName }} is {{ newerTrade.status === 'accepted' ? 'accepted' : newerTrade.status === 'completed' ? 'complete' : 'open' }}.</span>
      </span>
      <span class="th-newer-go">Go to it<AppIcon name="back" :size="16" class="th-flip" /></span>
    </RouterLink>

    <div class="row g-4">
      <!-- Left: the offer and actions -->
      <div class="col-lg-7 d-flex flex-column gap-4">
        <section class="card th-proposal" aria-label="The trade">
          <div class="th-proposal-sides">
            <div class="th-side th-side-you">
              <span class="th-side-label"><UserAvatar :name="auth.user.name" you size="sm" />You give</span>
              <RouterLink v-for="l in myItems" :key="l._id" :to="`/listings/${l._id}`" class="th-pick th-pick-static th-pick-link">
                <span class="th-pick-thumb">
                  <img v-if="l.imageUrl" :src="l.imageUrl" :alt="l.title" />
                  <AppIcon v-else name="image" />
                </span>
                <span class="th-pick-text">
                  <span class="th-pick-title">{{ l.title }}</span>
                  <span class="th-pick-meta">{{ l.category }} · {{ l.condition }}</span>
                </span>
              </RouterLink>
            </div>
            <span class="th-swap-disc" aria-hidden="true"><AppIcon name="swap" /></span>
            <div class="th-side th-side-them">
              <span class="th-side-label"><UserAvatar :name="otherName" size="sm" />You get</span>
              <RouterLink v-for="l in theirItems" :key="l._id" :to="`/listings/${l._id}`" class="th-pick th-pick-static th-pick-link">
                <span class="th-pick-thumb">
                  <img v-if="l.imageUrl" :src="l.imageUrl" :alt="l.title" />
                  <AppIcon v-else name="image" />
                </span>
                <span class="th-pick-text">
                  <span class="th-pick-title">{{ l.title }}</span>
                  <span class="th-pick-meta">{{ l.category }} · {{ l.condition }}</span>
                </span>
              </RouterLink>
            </div>
          </div>

          <!-- "Could you add more?": ask the other trader to add items, or answer their request -->
          <AddMoreRequests
            v-if="isOpen && !countering"
            :trade="trade"
            :me-id="auth.user._id"
            :other-name="otherName"
            @updated="trade = $event"
          />

          <!-- Respond to an open proposal -->
          <div v-if="isOpen" class="th-proposal-foot">
            <template v-if="myTurn && !countering">
              <p class="mb-0 fw-semibold">
                {{ trade.status === 'countered' ? 'You received a counter offer.' : 'You received a proposal.' }}
              </p>
              <div class="th-proposal-actions">
                <button class="btn btn-ghost" @click="rejectTrade">Reject</button>
                <button class="btn btn-outline-dark" @click="startCounter">Counter</button>
                <button class="btn btn-primary" @click="acceptTrade"><AppIcon name="check" />Accept</button>
              </div>
            </template>
            <template v-else-if="!myTurn">
              <p class="th-muted mb-0">
                <AppIcon name="clock" :size="16" class="me-1" />Waiting for {{ otherName }} to respond.
              </p>
              <div class="th-proposal-actions">
                <button class="btn btn-outline-danger btn-sm" @click="cancelTrade">Withdraw proposal</button>
              </div>
            </template>
          </div>

          <!-- Counter offer editor -->
          <div v-if="countering" class="th-proposal-foot th-counter">
            <h2 class="th-counter-title">Make a counter offer</h2>
            <span class="th-side-label th-label-you">{{ isProposer ? 'Your items' : `${trade.proposer.name}'s items` }}</span>
            <ItemPicker
              :listings="proposerItems"
              :selected-ids="counterOffered"
              :side="isProposer ? 'you' : 'them'"
              @toggle="toggleIn(counterOffered, $event)"
            />
            <span class="th-side-label mt-2" :class="isProposer ? 'th-label-them' : 'th-label-you'">
              {{ isProposer ? `${trade.receiver.name}'s items` : 'Your items' }}
            </span>
            <ItemPicker
              :listings="receiverItems"
              :selected-ids="counterRequested"
              :side="isProposer ? 'them' : 'you'"
              @toggle="toggleIn(counterRequested, $event)"
            />
            <div class="th-proposal-actions">
              <button class="btn btn-ghost" @click="countering = false">Back</button>
              <button
                class="btn btn-primary"
                :disabled="counterOffered.length === 0 || counterRequested.length === 0"
                @click="sendCounter"
              >
                Send counter offer
              </button>
            </div>
          </div>

          <div v-if="trade.status === 'accepted'" class="th-proposal-foot th-proposal-foot-quiet">
            <span class="th-muted small">Changed your mind? Let {{ otherName }} know in the chat first.</span>
            <button class="btn btn-outline-danger btn-sm" @click="cancelTrade">Cancel trade</button>
          </div>
        </section>

        <!-- Features 4 and 5: meetup and inspection checklist -->
        <template v-if="showMeetup">
          <MeetupPicker
            :meetup="trade.meetup"
            :can-edit="trade.status === 'accepted'"
            @save="action('put', 'meetup', $event)"
          />
          <InspectionChecklist
            :checklist="trade.checklist"
            :is-proposer="isProposer"
            :my-confirmed="myConfirmed"
            :their-confirmed="theirConfirmed"
            :locked="trade.status !== 'accepted'"
            :other-name="otherName"
            @toggle="(index, checked) => action('put', 'checklist', { index, checked })"
            @confirm="confirmHandover"
          />
        </template>
      </div>

      <!-- Right: feature 3, chat -->
      <div class="col-lg-5">
        <ChatBox
          class="th-chat-sticky"
          :trade-id="trade._id"
          :current-user-id="auth.user._id"
          :other-name="otherName"
          :disabled="isClosed"
          @system-message="loadTrade"
        />
      </div>
    </div>
  </template>
</template>
