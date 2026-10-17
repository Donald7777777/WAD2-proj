<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import ListingCard from '@/components/ListingCard.vue'
import ItemPicker from '@/components/ItemPicker.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import ChatBox from '@/components/ChatBox.vue'
import MeetupPicker from '@/components/MeetupPicker.vue'
import InspectionChecklist from '@/components/InspectionChecklist.vue'

const auth = useAuthStore()
const route = useRoute()

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

async function loadTrade() {
  try {
    const response = await api.get(`/trades/${route.params.id}`)
    trade.value = response.data
  } catch (e) {
    error.value = errorMessage(e)
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

function cancelTrade() {
  if (confirm('Cancel this trade?')) action('post', 'cancel')
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
  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <template v-if="trade">
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-3">
      <h1 class="h4 mb-0">Trade with {{ otherName }}</h1>
      <StatusBadge :status="trade.status" />
    </div>

    <div class="row g-4">
      <!-- Left: the offer and actions -->
      <div class="col-lg-7">
        <div class="card card-body mb-4">
          <div class="row g-3">
            <div class="col-sm-6">
              <p class="small text-secondary mb-1">You give</p>
              <div v-for="l in myItems" :key="l._id" class="mb-2"><ListingCard :listing="l" /></div>
            </div>
            <div class="col-sm-6">
              <p class="small text-secondary mb-1">You get</p>
              <div v-for="l in theirItems" :key="l._id" class="mb-2"><ListingCard :listing="l" /></div>
            </div>
          </div>

          <!-- Respond to an open proposal -->
          <div v-if="isOpen" class="border-top pt-3 mt-2">
            <template v-if="myTurn && !countering">
              <p class="mb-2">
                {{ trade.status === 'countered' ? 'You received a counter offer.' : 'You received a proposal.' }}
              </p>
              <button class="btn btn-success me-2" @click="action('post', 'accept')">Accept</button>
              <button class="btn btn-outline-dark me-2" @click="startCounter">Counter</button>
              <button class="btn btn-outline-danger" @click="action('post', 'reject')">Reject</button>
            </template>
            <template v-else-if="!myTurn">
              <p class="text-secondary mb-2">Waiting for {{ otherName }} to respond.</p>
              <button class="btn btn-outline-danger btn-sm" @click="cancelTrade">Withdraw proposal</button>
            </template>
          </div>

          <!-- Counter offer editor -->
          <div v-if="countering" class="border-top pt-3 mt-2">
            <h2 class="h6">{{ trade.proposer.name }}'s items</h2>
            <ItemPicker
              :listings="proposerItems"
              :selected-ids="counterOffered"
              @toggle="toggleIn(counterOffered, $event)"
            />
            <h2 class="h6 mt-3">{{ trade.receiver.name }}'s items</h2>
            <ItemPicker
              :listings="receiverItems"
              :selected-ids="counterRequested"
              @toggle="toggleIn(counterRequested, $event)"
            />
            <button
              class="btn btn-success mt-3 me-2"
              :disabled="counterOffered.length === 0 || counterRequested.length === 0"
              @click="sendCounter"
            >
              Send counter offer
            </button>
            <button class="btn btn-link mt-3" @click="countering = false">Back</button>
          </div>

          <div v-if="trade.status === 'accepted'" class="border-top pt-3 mt-2">
            <button class="btn btn-outline-danger btn-sm" @click="cancelTrade">Cancel trade</button>
          </div>
        </div>

        <!-- Features 4 and 5: meetup and inspection checklist -->
        <template v-if="showMeetup">
          <MeetupPicker
            class="mb-4"
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
            @toggle="(index, checked) => action('put', 'checklist', { index, checked })"
            @confirm="action('post', 'confirm')"
          />
        </template>
      </div>

      <!-- Right: feature 3, chat -->
      <div class="col-lg-5">
        <ChatBox
          :trade-id="trade._id"
          :current-user-id="auth.user._id"
          :disabled="['rejected', 'cancelled'].includes(trade.status)"
          @system-message="loadTrade"
        />
      </div>
    </div>
  </template>
</template>
