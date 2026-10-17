<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import ListingCard from '@/components/ListingCard.vue'
import ItemPicker from '@/components/ItemPicker.vue'

const route = useRoute()
const router = useRouter()

const listing = ref(null)
const myListings = ref([])
const selectedIds = ref([])
const error = ref('')
const sending = ref(false)

const available = computed(() => myListings.value.filter((l) => l.status === 'available'))

function toggle(id) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  } else {
    selectedIds.value.push(id)
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
    router.push(`/trades/${response.data._id}`)
  } catch (e) {
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
  } catch (e) {
    error.value = errorMessage(e)
  }
})
</script>

<template>
  <h1 class="h4 mb-3">Offer a trade</h1>
  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <div v-if="listing" class="row g-4">
    <div class="col-md-4">
      <p class="small text-secondary mb-1">You want</p>
      <ListingCard :listing="listing" />
    </div>

    <div class="col-md-8">
      <p class="small text-secondary mb-1">Pick one or more of your items to offer</p>
      <p v-if="available.length === 0">
        You have no available items. <RouterLink to="/listings/new">List an item</RouterLink> first.
      </p>
      <ItemPicker v-else :listings="available" :selected-ids="selectedIds" @toggle="toggle" />

      <button class="btn btn-success mt-3" :disabled="selectedIds.length === 0 || sending" @click="propose">
        Send proposal ({{ selectedIds.length }} item{{ selectedIds.length === 1 ? '' : 's' }})
      </button>
    </div>
  </div>
</template>
