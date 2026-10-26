<script setup>
import { ref, computed } from 'vue'
import axios from 'axios'
import AppIcon from './AppIcon.vue'
import MeetupMap from './MeetupMap.vue'
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

// The place being chosen; starts as the saved meetup if there is one
const place = ref(props.meetup?.name ? { ...props.meetup } : null)
const date = ref(props.meetup?.date || '')
const time = ref(props.meetup?.time || '')
const editing = ref(!props.meetup?.name)

const today = new Date().toISOString().split('T')[0]

// Quick searches for common public meetup points
const suggestions = ['MRT station', 'Bus interchange', 'Shopping mall', 'Library']

// Search results from OneMap as simple places, for the list and the numbered pins on the map
const resultPlaces = computed(() =>
  results.value.map((r) => ({
    name: r.SEARCHVAL,
    address: r.ADDRESS,
    lat: Number(r.LATITUDE),
    lng: Number(r.LONGITUDE),
  })),
)

// Links for the day itself
const googleMaps = (p) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
const directions = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`

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

// Picked from the list or by tapping a pin: the map flies there and drops the pin
function choose(chosen) {
  place.value = { ...chosen }
  results.value = []
}

// Pin dragged to fine-tune the exact spot (the place name stays the same)
function onMove({ lat, lng }) {
  place.value = { ...place.value, lat, lng }
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
      <MeetupMap mode="view" :selected="meetup" />
      <div class="th-meetup-info">
        <h3 class="th-meetup-place">{{ placeName(meetup.name) }}</h3>
        <p class="th-muted small mb-2">{{ placeName(meetup.address) }}</p>
        <span class="th-when"><AppIcon name="clock" :size="16" />{{ formatMeetup(meetup.date, meetup.time) }}</span>
        <div class="th-meetup-links">
          <a :href="directions(meetup)" target="_blank" rel="noopener" class="btn btn-offer btn-sm">
            <AppIcon name="pin" :size="16" />Get directions
          </a>
          <a :href="googleMaps(meetup)" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Open in Google Maps</a>
        </div>
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

      <!-- Live map: results appear as numbered pins; tap one (or a result below) to fly there -->
      <MeetupMap mode="pick" :places="resultPlaces" :selected="place" draggable @select="choose" @move="onMove" />

      <div v-if="results.length" class="list-group th-results">
        <button
          v-for="(result, i) in resultPlaces"
          :key="result.address + i"
          type="button"
          class="list-group-item list-group-item-action"
          @click="choose(result)"
        >
          <span class="th-result-num">{{ i + 1 }}</span>
          <span>
            <span class="d-block fw-semibold small">{{ placeName(result.name) }}</span>
            <span class="d-block small th-muted">{{ placeName(result.address) }}</span>
          </span>
        </button>
      </div>

      <div v-if="place" class="th-meetup-chosen">
        <h3 class="th-meetup-place">{{ placeName(place.name) }}</h3>
        <div class="row g-3">
          <div class="col-sm-6">
            <label class="form-label" for="meetup-date">Date</label>
            <input id="meetup-date" v-model="date" type="date" class="form-control" :min="today" />
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

<style>
.th-meetup-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.th-result-num {
  display: inline-flex; align-items: center; justify-content: center; flex: none; width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid #12352D; color: #12352D; font: 700 12px/1 var(--font-sans);
}
</style>
