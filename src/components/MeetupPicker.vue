<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'

const props = defineProps({
  // The meetup already saved on the trade (may be empty)
  meetup: Object,
  canEdit: Boolean,
})
const emit = defineEmits(['save'])

const searchText = ref('')
const results = ref([])
const searching = ref(false)
const error = ref('')

// The place being chosen; starts as the saved meetup if there is one
const place = ref(props.meetup?.name ? { ...props.meetup } : null)
const date = ref(props.meetup?.date || '')
const time = ref(props.meetup?.time || '')
const editing = ref(!props.meetup?.name)

const today = new Date().toISOString().split('T')[0]

// Quick searches for common public meetup points
const suggestions = ['MRT station', 'Bus interchange', 'Shopping mall', 'Library']

// OneMap (Singapore Land Authority) map image with a red pin at lat/lng
function mapFor(lat, lng) {
  return (
    'https://www.onemap.gov.sg/api/staticmap/getStaticImage?layerchosen=default' +
    `&latitude=${lat}&longitude=${lng}&zoom=17&width=512&height=300` +
    `&points=[${lat},${lng},"220,53,69"]`
  )
}

const mapUrl = computed(() => (place.value ? mapFor(place.value.lat, place.value.lng) : ''))

async function search(text) {
  if (text) searchText.value = text
  if (!searchText.value.trim()) return

  searching.value = true
  error.value = ''
  try {
    const response = await axios.get('https://www.onemap.gov.sg/api/common/elastic/search', {
      params: { searchVal: searchText.value, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: 1 },
    })
    results.value = response.data.results.slice(0, 8)
    if (results.value.length === 0) {
      error.value = 'No places found. Try another search.'
    }
  } catch {
    error.value = 'Could not reach OneMap. Please try again.'
  } finally {
    searching.value = false
  }
}

function choose(result) {
  place.value = {
    name: result.SEARCHVAL,
    address: result.ADDRESS,
    lat: Number(result.LATITUDE),
    lng: Number(result.LONGITUDE),
  }
  results.value = []
}

function save() {
  if (!place.value || !date.value || !time.value) {
    error.value = 'Pick a place, date and time.'
    return
  }
  emit('save', { ...place.value, date: date.value, time: time.value })
  editing.value = false
}
</script>

<template>
  <div class="card">
    <div class="card-header fw-semibold">Meetup point</div>
    <div class="card-body">
      <!-- Saved meetup -->
      <div v-if="!editing && meetup?.name">
        <h6 class="mb-1">{{ meetup.name }}</h6>
        <p class="small text-secondary mb-1">{{ meetup.address }}</p>
        <p class="mb-2"><strong>{{ meetup.date }}</strong> at <strong>{{ meetup.time }}</strong></p>
        <img :src="mapFor(meetup.lat, meetup.lng)" alt="Map of meetup point" class="img-fluid rounded border" />
        <button v-if="canEdit" class="btn btn-outline-secondary btn-sm mt-2" @click="editing = true">
          Change meetup
        </button>
      </div>

      <!-- Choosing a meetup -->
      <div v-else-if="canEdit">
        <p class="small text-secondary">Choose a busy public place, like an MRT station or mall.</p>
        <form class="input-group mb-2" @submit.prevent="search()">
          <input v-model="searchText" class="form-control" placeholder="Search e.g. Bishan MRT" />
          <button class="btn btn-outline-success" type="submit" :disabled="searching">Search</button>
        </form>
        <div class="mb-2">
          <button
            v-for="s in suggestions"
            :key="s"
            type="button"
            class="btn btn-light btn-sm border me-1 mb-1"
            @click="search(s)"
          >
            {{ s }}
          </button>
        </div>

        <div v-if="error" class="text-danger small mb-2">{{ error }}</div>

        <div v-if="results.length" class="list-group mb-2">
          <button
            v-for="result in results"
            :key="result.ADDRESS"
            type="button"
            class="list-group-item list-group-item-action"
            @click="choose(result)"
          >
            <div class="fw-semibold small">{{ result.SEARCHVAL }}</div>
            <div class="small text-secondary">{{ result.ADDRESS }}</div>
          </button>
        </div>

        <div v-if="place">
          <p class="mb-1"><strong>{{ place.name }}</strong></p>
          <img :src="mapUrl" alt="Map of chosen place" class="img-fluid rounded border mb-2" />
          <div class="row g-2">
            <div class="col-sm-6">
              <label class="form-label small" for="meetup-date">Date</label>
              <input id="meetup-date" v-model="date" type="date" class="form-control" :min="today" />
            </div>
            <div class="col-sm-6">
              <label class="form-label small" for="meetup-time">Time</label>
              <input id="meetup-time" v-model="time" type="time" class="form-control" />
            </div>
          </div>
          <button class="btn btn-success mt-2" @click="save">Save meetup</button>
        </div>
      </div>

      <p v-else class="text-secondary small mb-0">No meetup was set.</p>
    </div>
  </div>
</template>
