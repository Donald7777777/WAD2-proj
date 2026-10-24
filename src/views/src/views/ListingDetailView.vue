<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge.vue'
import ConditionBadge from '@/components/ConditionBadge.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import AppIcon from '@/components/AppIcon.vue'
import PhotoGallery from '@/components/PhotoGallery.vue'

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

      <p class="th-detail-desc">{{ listing.description }}</p>

      <div v-if="listing.lookingFor" class="th-wants-box">
        <span class="eyebrow">{{ isOwner ? 'You are' : `${listing.owner.name} is` }} looking for</span>
        <p>{{ listing.lookingFor }}</p>
      </div>

      <div class="th-owner-row">
        <UserAvatar :name="listing.owner.name" :you="isOwner" />
        <div>
          <b>{{ isOwner ? 'Your listing' : listing.owner.name }}</b>
          <span>Listed by {{ listing.owner.name }}</span>
        </div>
      </div>

      <div class="th-detail-cta">
        <RouterLink v-if="isOwner" :to="`/listings/${listing._id}/edit`" class="btn btn-outline-dark btn-lg">
          <AppIcon name="edit" />Edit listing
        </RouterLink>
        <template v-else-if="listing.status === 'available'">
          <RouterLink v-if="auth.user" :to="`/listings/${listing._id}/propose`" class="btn btn-offer btn-lg">
            <AppIcon name="swap" />Offer a trade
          </RouterLink>
          <RouterLink v-else :to="{ name: 'login', query: { redirect: route.fullPath } }" class="btn btn-offer btn-lg">
            Log in to offer a trade
          </RouterLink>
        </template>
        <p v-else class="th-muted mb-0">This item is no longer available.</p>
      </div>
    </div>
  </div>
</template>
