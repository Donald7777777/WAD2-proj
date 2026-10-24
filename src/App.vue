<script setup>
import { watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import NavBar from './components/NavBar.vue'
import ToastHost from './components/ToastHost.vue'
import TradeMoment from './components/TradeMoment.vue'

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

function openMomentTrade() {
  const id = notes.moment.tradeId
  notes.moment = null
  router.push(`/trades/${id}`)
}
</script>

<template>
  <NavBar v-if="!route.meta.bare" />
  <main :class="route.meta.bare ? 'th-bare' : 'container-fluid th-page th-main'">
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
    next-label="Open the trade"
    next-icon="swap"
    @close="notes.moment = null"
    @next="openMomentTrade"
    @retry="retryOffer"
    @browse="keepBrowsing"
  />
</template>
