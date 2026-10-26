<script setup>
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import NavBar from './components/NavBar.vue'
import ToastHost from './components/ToastHost.vue'
import TradeMoment from './components/TradeMoment.vue'
import ReviewMoment from './components/ReviewMoment.vue'
import OfferMoment from './components/OfferMoment.vue'

// The landing page (meta.bare) is full screen, without the top bar
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notes = useNotificationStore()

// Check for new messages and trade updates while someone is logged in
watch(
  () => auth.user?._id,
  (id) => (id ? notes.start(router) : notes.stop()),
  { immediate: true },
)

// The big trade pop-up, shown on any page when the other person accepts / declines / cancels
// Declined: make a new offer for the same item, or keep browsing
function retryOffer() {
  const id = notes.moment.retryListingId
  notes.moment = null
  router.push(id ? `/listings/${id}/propose` : '/discover')
}
function keepBrowsing() {
  notes.moment = null
  router.push('/discover')
}

// Someone rated you: "See my reviews" opens the Reviews tab on your profile
function openReviews() {
  notes.reviewMoment = null
  router.push('/profile?tab=reviews')
}

// Competing offers pop-up: see every offer for the item, or open the trade
function openOffers() {
  const id = notes.offerMoment.listingId
  notes.offerMoment = null
  router.push(`/listings/${id}#offers`)
}
function openOfferTrade() {
  const id = notes.offerMoment.tradeId
  notes.offerMoment = null
  router.push(`/trades/${id}`)
}

function openMomentTrade() {
  const id = notes.moment.tradeId
  notes.moment = null
  router.push(`/trades/${id}`)
}
</script>

<template>
  <!-- Keyboard users can jump straight past the top bar -->
  <a v-if="!route.meta.bare" href="#main" class="th-skip">Skip to content</a>
  <NavBar v-if="!route.meta.bare" />
  <main id="main" tabindex="-1" :class="route.meta.bare ? 'th-bare' : 'container-fluid th-page th-main'">
    <!-- Pages fade and rise in when you navigate (styles in motion.css) -->
    <RouterView v-slot="{ Component, route: current }">
      <Transition name="th-route" mode="out-in">
        <div :key="current.path">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>
  </main>
  <ToastHost />
  <TradeMoment
    v-if="notes.moment"
    :key="notes.moment.tradeId + notes.moment.kind"
    :kind="notes.moment.kind"
    :broken-title="notes.moment.title"
    :you="auth.user?.name || 'You'"
    :them="notes.moment.them"
    :give="notes.moment.give"
    :get="notes.moment.get"
    :trade-id="notes.moment.tradeId"
    :you-src="auth.user?.avatarUrl || ''"
    :them-src="notes.moment.themAvatar || ''"
    next-label="Open the trade"
    next-icon="swap"
    @close="notes.moment = null"
    @next="openMomentTrade"
    @retry="retryOffer"
    @browse="keepBrowsing"
  />
  <!-- These wait until any trade pop-up is closed -->
  <OfferMoment
    v-if="notes.offerMoment && !notes.moment"
    :key="notes.offerMoment.tradeId + notes.offerMoment.kind"
    :moment="notes.offerMoment"
    :you="auth.user?.name || 'You'"
    :you-src="auth.user?.avatarUrl || ''"
    @close="notes.offerMoment = null"
    @offers="openOffers"
    @trade="openOfferTrade"
  />
  <ReviewMoment
    v-if="notes.reviewMoment && !notes.moment && !notes.offerMoment"
    :key="notes.reviewMoment.tradeId"
    :review="notes.reviewMoment"
    @close="notes.reviewMoment = null"
    @open="openReviews"
  />
</template>
