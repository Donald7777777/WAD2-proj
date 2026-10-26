<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge.vue'
import ConditionBadge from '@/components/ConditionBadge.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import AppIcon from '@/components/AppIcon.vue'
import PhotoGallery from '@/components/PhotoGallery.vue'
import ListingReactions from '@/components/ListingReactions.vue'
import ListingOffers from '@/components/ListingOffers.vue'
import ReportDialog from '@/components/ReportDialog.vue'

const auth = useAuthStore()
const route = useRoute()

const listing = ref(null)
const error = ref('')

// All photos (older listings only have the single imageUrl)
const photos = computed(() => {
  const l = listing.value
  if (!l) return []
  if (l.images?.length) return l.images
  return l.imageUrl ? [{ url: l.imageUrl }] : []
})

const isOwner = computed(() => auth.user && listing.value?.owner._id === auth.user._id)

const reporting = ref(false)

// Offers on this item (from ListingOffers): your own live offer, and how many there are
const offers = ref([])
const myOffer = computed(() => offers.value.find((o) => o.mine))
function jumpToOffers() {
  document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
async function onOffers(list) {
  const first = !offers.value.length && list.length
  offers.value = list
  // Opened from "See all offers": jump to them
  if (first && route.hash === '#offers') {
    await nextTick()
    jumpToOffers()
  }
}

onMounted(async () => {
  try {
    const response = await api.get(`/listings/${route.params.id}`)
    listing.value = response.data
  } catch (e) {
    error.value = errorMessage(e)
  }
})
</script>

<template>
  <RouterLink to="/discover" class="th-back"><AppIcon name="back" :size="18" />Discover</RouterLink>
  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <div v-if="listing" class="th-detail">
    <PhotoGallery :images="photos" :title="listing.title" />

    <div class="th-detail-info">
      <span class="eyebrow th-muted">{{ listing.category }}</span>
      <h1 class="th-detail-title">{{ listing.title }}</h1>
      <div class="d-flex flex-wrap gap-2">
        <ConditionBadge :condition="listing.condition" />
        <StatusBadge :status="listing.status" />
      </div>
      <!-- Like (heart) and save (bookmark), with how many people did each -->
      <ListingReactions :listing="listing" size="lg" />

      <p class="th-detail-desc">{{ listing.description }}</p>

      <div v-if="listing.lookingFor" class="th-wants-box">
        <span class="eyebrow">{{ isOwner ? 'You are' : `${listing.owner.name} is` }} looking for</span>
        <p>{{ listing.lookingFor }}</p>
      </div>

      <!-- The owner: tap to see their profile, rating and reviews -->
      <RouterLink :to="`/users/${listing.owner._id}`" class="th-owner-row th-owner-link">
        <UserAvatar :name="listing.owner.name" :src="listing.owner.avatarUrl" :you="isOwner" />
        <div>
          <b>{{ isOwner ? 'Your listing' : listing.owner.name }}</b>
          <span>{{ isOwner ? 'See your public profile' : 'View profile and reviews' }}</span>
        </div>
        <AppIcon name="chevron" :size="18" class="ms-auto th-muted" />
      </RouterLink>
      <RouterLink v-if="isOwner" :to="`/activity?listing=${listing._id}`" class="th-link small">See who liked and saved this</RouterLink>

      <div class="th-detail-cta">
        <RouterLink v-if="isOwner" :to="`/listings/${listing._id}/edit`" class="btn btn-outline-dark btn-lg">
          <AppIcon name="edit" />Edit listing
        </RouterLink>
        <!-- Blocked (either way): no offers -->
        <p v-else-if="listing.blocked" class="th-blocked-banner mb-0">
          <AppIcon name="x" :size="16" />You can't trade with {{ listing.owner.name }}.
        </p>
        <template v-else-if="listing.status !== 'traded'">
          <!-- Reserved = the owner accepted someone's offer, but you can still make a competing one -->
          <p v-if="listing.status === 'reserved'" class="th-reserved-note">
            <AppIcon name="clock" :size="16" />
            <span>Reserved for an accepted trade. The owner can still switch to a better offer.</span>
          </p>
          <RouterLink v-if="myOffer" :to="`/trades/${myOffer.tradeId}`" class="btn btn-primary btn-lg">
            <AppIcon name="swap" />View your offer
          </RouterLink>
          <RouterLink v-if="auth.user" :to="`/listings/${listing._id}/propose`" class="btn btn-lg" :class="myOffer ? 'btn-outline-dark' : 'btn-offer'">
            <AppIcon name="swap" />{{ myOffer ? 'Make another offer' : offers.length ? 'Make a competing offer' : 'Offer a trade' }}
          </RouterLink>
          <RouterLink v-else :to="{ name: 'login', query: { redirect: route.fullPath } }" class="btn btn-offer btn-lg">
            Log in to offer a trade
          </RouterLink>
          <a v-if="offers.length" href="#offers" class="th-link small th-offers-jump" @click.prevent="jumpToOffers">
            {{ offers.length }} offer{{ offers.length === 1 ? '' : 's' }} so far
          </a>
        </template>
        <p v-else class="th-muted mb-0">This item has been traded.</p>
      </div>
      <button v-if="auth.user && !isOwner" type="button" class="th-report-link" @click="reporting = true">
        <AppIcon name="flag" :size="14" />Report this listing
      </button>
      <ReportDialog v-if="reporting" type="listing" :target-id="listing._id" @close="reporting = false" />
    </div>
  </div>

  <!-- Every live offer for this item, visible to everyone -->
  <ListingOffers
    v-if="listing"
    :listing-id="listing._id"
    :is-owner="Boolean(isOwner)"
    :can-offer="Boolean(auth.user) && !isOwner && !listing.blocked"
    :traded="listing.status === 'traded'"
    @loaded="onOffers"
  />
</template>
