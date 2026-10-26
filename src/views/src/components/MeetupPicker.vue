<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import AppIcon from './AppIcon.vue'
import { formatMeetup, placeName } from '@/lib/format'

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

const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const nowTime = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
  <section class="card th-meetup" aria-labelledby="meetup-title">
    <div class="th-card-head">
      <span class="th-card-icon"><AppIcon name="pin" /></span>
      <div>
        <h2 id="meetup-title">Meetup point</h2>
        <p>Meet somewhere busy and public.</p>
      </div>
    </div>

    <!-- Saved meetup -->
    <div v-if="!editing && meetup?.name" class="th-meetup-saved">
      <img :src="mapFor(meetup.lat, meetup.lng)" alt="Map of meetup point" class="th-map" />
      <div class="th-meetup-info">
        <h3 class="th-meetup-place">{{ placeName(meetup.name) }}</h3>
        <p class="th-muted small mb-2">{{ placeName(meetup.address) }}</p>
        <span class="th-when"><AppIcon name="clock" :size="16" />{{ formatMeetup(meetup.date, meetup.time) }}</span>
      </div>
      <button v-if="canEdit" class="btn btn-outline-dark btn-sm align-self-start" @click="editing = true">
        Change meetup
      </button>
    </div>

    <!-- Choosing a meetup -->
    <div v-else-if="canEdit" class="th-meetup-edit">
      <form class="th-search th-search-sm" role="search" @submit.prevent="search()">
        <AppIcon name="search" />
        <input v-model="searchText" placeholder="Search e.g. Bishan MRT" aria-label="Search for a meetup place" />
        <button class="btn btn-primary btn-sm" type="submit" :disabled="searching">
          {{ searching ? 'Searching…' : 'Search' }}
        </button>
      </form>
      <div class="th-chips">
        <button v-for="s in suggestions" :key="s" type="button" class="th-chip" @click="search(s)">{{ s }}</button>
      </div>

      <div v-if="error" class="th-field-error" role="alert">{{ error }}</div>

      <div v-if="results.length" class="list-group th-results">
        <button
          v-for="result in results"
          :key="result.ADDRESS"
          type="button"
          class="list-group-item list-group-item-action"
          @click="choose(result)"
        >
          <AppIcon name="pin" :size="18" class="th-muted" />
          <span>
            <span class="d-block fw-semibold small">{{ placeName(result.SEARCHVAL) }}</span>
            <span class="d-block small th-muted">{{ placeName(result.ADDRESS) }}</span>
          </span>
        </button>
      </div>

      <div v-if="place" class="th-meetup-chosen">
        <img :src="mapUrl" alt="Map of chosen place" class="th-map" />
        <h3 class="th-meetup-place">{{ placeName(place.name) }}</h3>
        <div class="row g-3">
          <div class="col-sm-6">
            <label class="form-label" for="meetup-date">Date</label>
            <input id="meetup-date" v-model="date" type="date" class="form-control" :min="date === today ? nowTime() : undefined" />
          </div>
          <div class="col-sm-6">
            <label class="form-label" for="meetup-time">Time</label>
            <input id="meetup-time" v-model="time" type="time" class="form-control" />
          </div>
        </div>
        <button class="btn btn-primary mt-3" @click="save">Save meetup</button>
      </div>
    </div>

    <p v-else class="th-muted small mb-0 px-4 pb-4">No meetup was set.</p>
  </section>
</template>
