<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import ListingCard from '@/components/ListingCard.vue'
import ItemPicker from '@/components/ItemPicker.vue'
import AppIcon from '@/components/AppIcon.vue'
import { flyTo, bump } from '@/lib/motion'
import { showToast } from '@/lib/toast'

const route = useRoute()
const auth = useAuthStore()
const router = useRouter()

const listing = ref(null)
const myListings = ref([])
const selectedIds = ref([])
const error = ref('')
const sending = ref(false)
// The "N items selected" counter in the action bar; picked items fly into it
const counter = ref(null)

const available = computed(() => myListings.value.filter((l) => l.status === 'available'))
// Other people's offers for this item: you're making a competing offer
const offers = ref([])
const competing = computed(() => offers.value.filter((o) => !o.mine))
// Your items can be in several open offers; if one goes through, the others using it are withdrawn
const myOpenOffers = ref([])
const alsoIn = computed(() =>
  available.value
    .filter((l) => selectedIds.value.includes(l._id))
    .map((l) => ({ title: l.title, count: myOpenOffers.value.filter((t) => t.offeredListings.some((o) => o._id === l._id)).length }))
    .filter((x) => x.count),
)
const acceptedOffer = computed(() => offers.value.find((o) => o.status === 'accepted' && !o.mine))

function toggle(id, event) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
    bump(counter.value)
  } else {
    selectedIds.value.push(id)
    // A copy of the item's photo flies down into the counter
    const thumb = event?.target?.closest('.th-pick')?.querySelector('.th-pick-thumb')
    flyTo(thumb, counter.value)
  }
}

async function propose() {
  error.value = ''
  sending.value = true
  try {
    const response = await api.post('/trades', {
      requestedListingIds: [listing.value._id],
      offeredListingIds: selectedIds.value,
    })
    showToast(`Proposal sent to ${listing.value.owner?.name || 'the owner'}!`, { icon: 'send' })
    router.push(`/trades/${response.data._id}`)
  } catch (e) {
    // You already have an offer for this item (one each): open it to change it
    if (e.response?.status === 409 && e.response.data?.tradeId) {
      showToast(errorMessage(e), { icon: 'edit', tone: 'info' })
      router.replace(`/trades/${e.response.data.tradeId}?edit=1`)
      return
    }
    error.value = errorMessage(e)
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  try {
    const [listingResponse, mineResponse] = await Promise.all([
      api.get(`/listings/${route.params.id}`),
      api.get('/listings/mine'),
    ])
    listing.value = listingResponse.data
    myListings.value = mineResponse.data
    offers.value = (await api.get(`/listings/${route.params.id}/offers`).catch(() => ({ data: [] }))).data
    const mineTrades = (await api.get('/trades').catch(() => ({ data: [] }))).data
    myOpenOffers.value = mineTrades.filter(
      (t) => ['pending', 'countered'].includes(t.status) && String(t.proposer._id || t.proposer) === auth.user?._id,
    )
    // One offer each: if you already made one, change it instead
    const existing = offers.value.find((o) => o.mine && o.tradeId)
    if (existing) {
      showToast(
        existing.status === 'accepted' ? 'Your offer for this item was already accepted.' : 'You already have an offer for this item. Change it here.',
        { icon: 'edit', tone: 'info' },
      )
      router.replace(existing.status === 'accepted' ? `/trades/${existing.tradeId}` : `/trades/${existing.tradeId}?edit=1`)
    }
  } catch (e) {
    error.value = errorMessage(e)
  }
})
</script>

<template>
  <RouterLink v-if="listing" :to="`/listings/${listing._id}`" class="th-back"><AppIcon name="back" :size="18" />Back to listing</RouterLink>
  <div class="th-page-head">
    <div>
      <h1>{{ competing.length ? 'Make a competing offer' : 'Offer a trade' }}</h1>
      <p v-if="listing">Pick what you'll give for {{ listing.title }}. You can offer more than one item.</p>
    </div>
  </div>
  <!-- Someone else is already in the running -->
  <div v-if="competing.length" class="th-compete-banner">
    <AppIcon name="spark" :size="20" />
    <div>
      <b v-if="acceptedOffer">{{ acceptedOffer.offerer.name }}'s offer was accepted, but it's not over yet.</b>
      <b v-else>{{ competing.length }} other offer{{ competing.length === 1 ? '' : 's' }} for this item.</b>
      <span>
        They offered {{ (acceptedOffer || competing[0]).items.map((i) => i.title).join(', ') }}.
        If {{ listing?.owner?.name || 'the owner' }} likes yours better, they can switch to it.
      </span>
    </div>
    <RouterLink :to="`/listings/${route.params.id}#offers`" class="btn btn-sm btn-outline-dark">See all offers</RouterLink>
  </div>
  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <div v-if="listing" class="th-propose">
    <section class="th-side th-side-them th-propose-get">
      <span class="th-side-label"><AppIcon name="box" :size="16" />You get</span>
      <ListingCard :listing="listing" class="d-none d-md-flex" />
      <!-- Compact version on phones -->
      <div class="th-pick th-pick-static d-md-none">
        <span class="th-pick-thumb">
          <img v-if="listing.imageUrl" :src="listing.imageUrl" :alt="listing.title" />
          <AppIcon v-else name="image" />
        </span>
        <span class="th-pick-text">
          <span class="th-pick-title">{{ listing.title }}</span>
          <span class="th-pick-meta">{{ listing.condition }} · by {{ listing.owner?.name }}</span>
        </span>
      </div>
    </section>

    <span class="th-swap-disc" :class="{ 'is-spinning': sending, 'is-ready': selectedIds.length > 0 }" aria-hidden="true">
      <AppIcon name="swap" />
    </span>

    <section class="th-side th-side-you">
      <span class="th-side-label"><AppIcon name="box" :size="16" />You give</span>
      <div v-if="available.length === 0" class="th-empty">
        <strong>Nothing to offer yet</strong>
        <p>You have no available items. <RouterLink to="/listings/new">List an item</RouterLink> first.</p>
      </div>
      <ItemPicker v-else :listings="available" :selected-ids="selectedIds" @toggle="toggle" />
      <p v-if="alsoIn.length" class="th-alsoin">
        <AppIcon name="info" :size="15" />
        <span>
          {{ alsoIn.map((x) => `${x.title} is also in ${x.count} other offer${x.count === 1 ? '' : 's'}`).join('; ') }}.
          That's fine: if one of them goes through, the others using it are withdrawn automatically.
        </span>
      </p>
    </section>
  </div>

  <div v-if="listing && available.length" class="th-action-bar">
    <span class="th-action-bar-text">
      <b ref="counter" class="data th-counter-num">{{ selectedIds.length }}</b> item{{ selectedIds.length === 1 ? '' : 's' }} selected
    </span>
    <button
      class="btn btn-offer"
      :class="{ 'is-ready': selectedIds.length > 0 && !sending }"
      :disabled="selectedIds.length === 0 || sending"
      @click="propose"
    >
      <AppIcon name="send" />Send proposal ({{ selectedIds.length }} item{{ selectedIds.length === 1 ? '' : 's' }})
    </button>
  </div>
</template>
