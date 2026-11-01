<script setup>
import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue'
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
import ReviewForm from '@/components/ReviewForm.vue'
import StarRating from '@/components/StarRating.vue'
import { showToast } from '@/lib/toast'
import { useNotificationStore } from '@/stores/notifications'
import { formatMeetup, placeName } from '@/lib/format'

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
const otherUser = computed(() => (isProposer.value ? trade.value.receiver : trade.value.proposer))
const otherName = computed(() => otherUser.value.name)
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
// You blocked this person: the trade can still go ahead, but chat between you is off
const iBlockedThem = computed(() => (auth.user?.blocked || []).some((id) => String(id) === String(otherUser.value._id)))
const chatNote = computed(() =>
  iBlockedThem.value && !isClosed.value
    ? `You blocked ${otherName.value}, so chat is off. You can still set the meetup, tick the checklist and confirm here, or cancel the trade. Unblock them in Account settings to chat again.`
    : '',
)
// Competing offer: my items here are already reserved for another accepted trade.
// Accepting this one switches to it, and that other trade is cancelled.
const myReserved = computed(() => (isOpen.value ? myItems.value.filter((l) => l.status === 'reserved') : []))

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
    // Withdrawn (by you or them): the same snapping-smile pop-up as a cancelled trade
    else if (wasOpen && now === 'cancelled') moment.value = { kind: 'broken', title: 'Proposal withdrawn' }
    // Declined by them (declining someone yourself just shows a small notification)
    else if (wasOpen && now === 'rejected' && !iDidIt) moment.value = { kind: 'declined', title: 'Proposal declined' }
    // Handover done by both: the big "Congratulations!" pop-up with the rating form
    else if (before === 'accepted' && now === 'completed') showCompleted()
    iDidIt = false
  },
)

// ---------- After the handover: rate the other trader ----------
const myReview = ref(null) // the review I left on this trade (null = not yet)
const reviewChecked = ref(false)
const reviewKey = () => `th-rated-${trade.value._id}`
async function loadMyReview() {
  if (trade.value.status !== 'completed') return
  try {
    const { data } = await api.get(`/trades/${trade.value._id}/review`)
    myReview.value = data.review
  } catch {
    // The rating card just won't show
  }
  reviewChecked.value = true
}
async function showCompleted() {
  await loadMyReview()
  if (!myReview.value) moment.value = { kind: 'completed', title: 'Congratulations!' }
}
function onReviewed(review) {
  myReview.value = review
  showToast(`Thanks! Your review of ${otherName.value} is on their profile.`, { icon: 'star' })
}
// Closing the pop-up without rating: don't show it again on this device (the card on the page stays)
function closeMoment() {
  if (moment.value?.kind === 'completed') {
    try {
      localStorage.setItem(reviewKey(), '1')
    } catch {
      // Private mode: it may show once more
    }
  }
  moment.value = null
}
function dismissedRating() {
  try {
    return localStorage.getItem(reviewKey()) === '1'
  } catch {
    return false
  }
}

// ---------- Meetup changed by the other person ----------
// The bell stays quiet while you're on this trade, so say it here
// (When they first pick one, or change it.) The map and details update by themselves.
watch(
  () => (trade.value ? `${trade.value.meetup?.name || ''}|${trade.value.meetup?.date || ''}|${trade.value.meetup?.time || ''}` : null),
  async (now, before) => {
    const m = trade.value?.meetup
    // The first load isn't news
    if (before === null || now === null || now === before || !m?.name || String(m.setBy) === auth.user._id) return
    const first = !before.split('|')[0]
    showToast(`${placeName(m.name)}, ${formatMeetup(m.date, m.time)}`, {
      title: first ? `${otherName.value} picked the meetup` : `${otherName.value} changed the meetup`,
      icon: 'pin',
      tone: first ? 'success' : 'danger',
      duration: 8000,
      onClick: () => document.querySelector('.th-meetup')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    })
    // Make the meetup card glow for a moment so it's easy to spot
    await nextTick()
    const card = document.querySelector('.th-meetup')
    card?.classList.remove('is-updated')
    void card?.offsetWidth
    card?.classList.add('is-updated')
  },
)

// Declined pop-up: try again for the same item, or go back to browsing
function retryOffer() {
  const item = theirItems.value[0]
  moment.value = null
  router.push(item ? `/listings/${item._id}/propose` : '/discover')
}
// After a cancelled or completed trade: back to Home
function goHomeFromMoment() {
  closeMoment()
  router.push('/discover')
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
    const first = !trade.value
    trade.value = response.data
    findNewerTrade()
    // "Change my offer" from the listing page: open the right editor
    if (first && route.query.edit && isOpen.value) {
      if (myTurn.value) await startCounter()
      else if (isProposer.value) await startEditOffer()
      await nextTick()
      document.querySelector('.th-counter')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // Opening a completed trade you haven't rated yet: show the pop-up once
    if (first && trade.value.status === 'completed') {
      await loadMyReview()
      if (!myReview.value && !dismissedRating()) moment.value = { kind: 'completed', title: 'Congratulations!' }
    }
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
// Ticking the checklist and confirming are safe to repeat, so a clash just retries once
const RETRY_ON_CLASH = ['checklist', 'confirm']
async function action(method, path, body, retried = false) {
  error.value = ''
  try {
    const response = await api[method](`/trades/${trade.value._id}/${path}`, body)
    trade.value = response.data
    return true
  } catch (e) {
    // 409: the other person changed the trade at the same moment
    if (e.response?.status === 409) {
      await loadTrade()
      if (!retried && RETRY_ON_CLASH.includes(path)) return action(method, path, body, true)
    }
    error.value = errorMessage(e)
    return false
  }
}

// Date-only meetups count as valid until the end of that day
function isPastMeetup(date, time) {
  if (!date) return false
  return new Date(`${date}T${time || '23:59'}`) < new Date()
}

async function saveMeetup(data) {
  if (isPastMeetup(data.date, data.time)) {
    error.value = 'Please pick a meetup date and time in the future.'
    return
  }
  await action('put', 'meetup', data)
}

// ---------- Edit my offer (while waiting for their answer) ----------
const editingOffer = ref(false)
const editItems = ref([])
const editPicked = ref([])
async function startEditOffer() {
  error.value = ''
  try {
    const { data } = await api.get('/listings/mine')
    const inTrade = new Set(trade.value.offeredListings.map((l) => l._id))
    // Your free items, plus the ones already in this offer
    editItems.value = data.filter((l) => l.status === 'available' || inTrade.has(l._id))
    editPicked.value = [...inTrade]
    editingOffer.value = true
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function saveEditOffer() {
  if (await action('put', 'offer', { offeredListingIds: editPicked.value })) {
    editingOffer.value = false
    showToast(`Offer updated. ${otherName.value} will see the change.`, { icon: 'edit' })
  }
}

async function acceptTrade() {
  if (
    myReserved.value.length &&
    !confirm(`${myReserved.value.map((l) => l.title).join(', ')} is reserved for another accepted trade. Accept this offer instead? The other trade will be cancelled.`)
  ) {
    return
  }
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
  // The status watcher above shows the "better luck next time" pop-up
  await action('post', 'cancel')
}

// Counter offer: load both users' available items so either side can be changed
async function startCounter() {
  const [proposerResponse, receiverResponse] = await Promise.all([
    api.get('/listings', { params: { owner: trade.value.proposer._id } }),
    api.get('/listings', { params: { owner: trade.value.receiver._id } }),
  ])
  // The proposer's items must be free; the receiver's may be reserved (a competing offer)
  proposerItems.value = proposerResponse.data.filter((l) => l.status === 'available')
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

// Anything new on this trade from the other person (accept, meetup, checklist…): refresh at once,
// so the meetup map, checklist and status update without reloading the page
const notes = useNotificationStore()
let refreshTimer = null
const stopListening = notes.onTradeEvent((event) => {
  if (!trade.value) return
  // One of this trade's items changed in another trade (e.g. reserved, or freed up again)
  if (event.type === 'listing') {
    const mine = [...trade.value.requestedListings, ...trade.value.offeredListings].map((l) => String(l._id))
    if (!event.ids?.some((id) => mine.includes(id))) return
  } else {
    if (String(event.tradeId) !== String(trade.value._id)) return
    if (event.type !== 'notification' && event.type !== 'chat') return
  }
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(loadTrade, 250)
})
onUnmounted(() => {
  stopListening()
  clearTimeout(refreshTimer)
})
</script>

<template>
  <RouterLink to="/trades" class="th-back"><AppIcon name="back" :size="18" />My trades</RouterLink>
  <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>

  <template v-if="trade">
    <header class="th-trade-head">
      <UserAvatar :name="otherName" :src="otherUser.avatarUrl" size="lg" />
      <div class="th-trade-head-text">
        <h1>Trade with <RouterLink :to="`/users/${otherUser._id}`" class="th-name-link">{{ otherName }}</RouterLink></h1>
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
      :trade-id="trade._id"
      :you-src="auth.user.avatarUrl || ''"
      :them-src="otherUser.avatarUrl || ''"
      @close="closeMoment"
      @home="goHomeFromMoment"
      @reviewed="onReviewed"
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
              <span class="th-side-label"><UserAvatar :name="auth.user.name" :src="auth.user.avatarUrl" you size="sm" />You give</span>
              <RouterLink v-for="l in myItems" :key="l._id" :to="`/listings/${l._id}`" class="th-pick th-pick-static th-pick-link" :class="{ 'is-traded': trade.status === 'completed' }">
                <span class="th-pick-thumb">
                  <span v-if="trade.status === 'completed'" class="th-traded-mini">Traded</span>
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
              <span class="th-side-label"><UserAvatar :name="otherName" :src="otherUser.avatarUrl" size="sm" />You get</span>
              <RouterLink v-for="l in theirItems" :key="l._id" :to="`/listings/${l._id}`" class="th-pick th-pick-static th-pick-link" :class="{ 'is-traded': trade.status === 'completed' }">
                <span class="th-pick-thumb">
                  <span v-if="trade.status === 'completed'" class="th-traded-mini">Traded</span>
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
                {{
                  trade.paused
                    ? `Your counter offer to ${otherName} is paused because you accepted another offer.`
                    : trade.status === 'countered'
                      ? 'You received a counter offer.'
                      : 'You received a proposal.'
                }}
              </p>
              <p v-if="myReserved.length" class="th-switch-note">
                <AppIcon name="alert" :size="16" />
                <span>
                  <b>This is a competing offer.</b> {{ myReserved.map((l) => l.title).join(', ') }}
                  {{ myReserved.length === 1 ? 'is' : 'are' }} reserved for a trade you already accepted. Accepting this one cancels that trade.
                  <RouterLink :to="`/listings/${myReserved[0]._id}#offers`">Compare all offers</RouterLink>
                </span>
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
              <p v-if="trade.paused" class="th-switch-note">
                <AppIcon name="alert" :size="16" />
                <span>
                  {{ otherName }} accepted another offer, so their counter offer is paused. Your offer is still open, and
                  {{ otherName }} can still switch to it if they change their mind.
                </span>
              </p>
              <div v-if="!editingOffer" class="th-proposal-actions">
                <button v-if="isProposer" class="btn btn-outline-dark btn-sm" @click="startEditOffer">
                  <AppIcon name="edit" :size="16" />Edit my offer
                </button>
                <button class="btn btn-outline-danger btn-sm" @click="cancelTrade">Withdraw proposal</button>
              </div>
            </template>
          </div>

          <!-- Edit my offer: change what I'm giving, they still answer -->
          <div v-if="editingOffer" class="th-proposal-foot th-counter">
            <h2 class="th-counter-title">Edit your offer</h2>
            <p class="th-muted small mb-1">Change what you're giving for {{ theirItems.map((l) => l.title).join(', ') }}. {{ otherName }} still decides.</p>
            <span class="th-side-label th-label-you">Your items</span>
            <ItemPicker :listings="editItems" :selected-ids="editPicked" side="you" @toggle="toggleIn(editPicked, $event)" />
            <div class="th-proposal-actions">
              <button class="btn btn-ghost" @click="editingOffer = false">Back</button>
              <button class="btn btn-primary" :disabled="editPicked.length === 0" @click="saveEditOffer">Save my offer</button>
            </div>
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
            <span class="th-muted small">{{ iBlockedThem ? `Changed your mind? You can cancel here.` : `Changed your mind? Let ${otherName} know in the chat first.` }}</span>
            <button class="btn btn-outline-danger btn-sm" @click="cancelTrade">Cancel trade</button>
          </div>
        </section>

        <!-- Completed: rate the other trader (or see the rating you gave) -->
        <section v-if="trade.status === 'completed' && reviewChecked" class="card th-ratecard">
          <template v-if="myReview">
            <span class="th-ratecard-head">You rated {{ otherName }}</span>
            <StarRating :model-value="myReview.rating" :size="22" />
            <p v-if="myReview.comment" class="th-ratecard-comment">“{{ myReview.comment }}”</p>
            <RouterLink :to="`/users/${otherUser._id}?tab=reviews`" class="th-name-link small">See {{ otherName }}'s reviews</RouterLink>
          </template>
          <ReviewForm v-else :trade-id="trade._id" :them="otherName" @done="onReviewed" />
        </section>

        <!-- Features 4 and 5: meetup and inspection checklist -->
        <template v-if="showMeetup">
          <MeetupPicker
            :meetup="trade.meetup"
            :can-edit="trade.status === 'accepted'"
            @save="saveMeetup"
          />
          <InspectionChecklist
            :checklist="trade.checklist"
            :is-proposer="isProposer"
            :my-confirmed="myConfirmed"
            :their-confirmed="theirConfirmed"
            :locked="trade.status !== 'accepted' || myConfirmed"
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
          :other-read-at="trade.lastRead?.[otherUser._id] || ''"
          :disabled="isClosed || iBlockedThem"
          :closed-note="chatNote"
          @system-message="loadTrade"
        />
      </div>
    </div>
  </template>
</template>
