<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

// Interactive meetup map: MapLibre GL + free OpenFreeMap tiles (no API key).
//   mode 'pick': search results show as numbered pins; picking one flies the camera there
//                and drops a pin you can drag to fine-tune the exact spot
//   mode 'view': the saved meetup, with a pulsing pin
// If the map can't start (no WebGL, or maplibre-gl not installed), it falls back to the
// static OneMap picture the app used before, so the meetup feature always works.
const props = defineProps({
  mode: { type: String, default: 'pick' }, // 'pick' | 'view'
  places: { type: Array, default: () => [] }, // search results: [{ name, address, lat, lng }]
  selected: { type: Object, default: null }, // { name, lat, lng }
  draggable: Boolean,
})
const emit = defineEmits(['select', 'move'])

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const SINGAPORE = [103.8198, 1.3521]

const container = ref(null)
const failed = ref(false)
const ready = ref(false)
let maplibregl = null
let map = null
let resultMarkers = []
let pickedMarker = null

// Static OneMap picture with a pin (the fallback)
function staticMap(lat, lng) {
  return (
    'https://www.onemap.gov.sg/api/staticmap/getStaticImage?layerchosen=default' +
    `&latitude=${lat}&longitude=${lng}&zoom=17&width=512&height=300` +
    `&points=[${lat},${lng},"28,115,80"]`
  )
}

// Pins are plain HTML so they can use the app's colours and animations.
// MapLibre moves the outer element (it sets its transform), so animations go on the inner one.
function pinElement(kind, label = '', delay = 0) {
  const outer = document.createElement('div')
  outer.className = 'th-pin-anchor'
  const el = document.createElement('div')
  el.className = `th-pin th-pin-${kind}`
  el.style.animationDelay = `${delay}ms`
  outer.appendChild(el)
  if (kind === 'result') {
    el.innerHTML = `<span>${label}</span>`
  } else {
    // The chosen spot: a lime pin with the logo's smile on it
    el.innerHTML =
      '<span class="th-pin-pulse"></span>' +
      '<svg viewBox="0 0 40 52" width="40" height="52" aria-hidden="true">' +
      '<path d="M20 51C20 51 3 31 3 19a17 17 0 0 1 34 0c0 12-17 32-17 32z" fill="#12352D"/>' +
      '<circle cx="14.5" cy="16" r="3.2" fill="#C8F26A"/><circle cx="25.5" cy="16" r="3.2" fill="#7ED6B3"/>' +
      '<path d="M11.5 22.5c3.2 5 13.8 5 17 0" fill="none" stroke="#F4F5EF" stroke-width="2.6" stroke-linecap="round"/>' +
      '</svg>'
  }
  return outer
}

// Nudge the map colours towards the TradeHappy palette (skipped quietly if a layer isn't there)
function tintMap() {
  for (const layer of map.getStyle()?.layers || []) {
    try {
      if (layer.type === 'fill' && /water/.test(layer.id)) map.setPaintProperty(layer.id, 'fill-color', '#BFE3DE')
      if (layer.type === 'fill' && /park|grass|wood|forest/.test(layer.id)) map.setPaintProperty(layer.id, 'fill-color', '#D9EFC8')
    } catch {
      // Not every style has every layer
    }
  }
}

function showResults() {
  if (!map) return
  resultMarkers.forEach((m) => m.remove())
  resultMarkers = props.places.map((place, i) => {
    const el = pinElement('result', String(i + 1), i * 60)
    el.title = place.name
    el.addEventListener('click', (event) => {
      event.stopPropagation()
      emit('select', place)
    })
    return new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([place.lng, place.lat]).addTo(map)
  })
  if (props.places.length > 1) {
    const bounds = new maplibregl.LngLatBounds()
    props.places.forEach((p) => bounds.extend([p.lng, p.lat]))
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1200 })
  } else if (props.places.length === 1) {
    map.flyTo({ center: [props.places[0].lng, props.places[0].lat], zoom: 15, duration: 1200 })
  }
}

function showSelected(fly = true) {
  if (!map) return
  pickedMarker?.remove()
  pickedMarker = null
  if (!props.selected) return
  const el = pinElement('picked')
  pickedMarker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: props.draggable })
    .setLngLat([props.selected.lng, props.selected.lat])
    .addTo(map)
  if (props.draggable) {
    pickedMarker.on('dragend', () => {
      const { lng, lat } = pickedMarker.getLngLat()
      emit('move', { lat, lng })
    })
  }
  const camera = { center: [props.selected.lng, props.selected.lat], zoom: 17, pitch: 55, bearing: -18 }
  if (fly) map.flyTo({ ...camera, speed: 1.1, curve: 1.5, essential: true })
  else map.jumpTo(camera)
}

onMounted(async () => {
  try {
    const mod = await import('maplibre-gl')
    await import('maplibre-gl/dist/maplibre-gl.css')
    maplibregl = mod.default || mod
    await nextTick()
    const view = props.mode === 'view'
    map = new maplibregl.Map({
      container: container.value,
      style: STYLE_URL,
      center: props.selected ? [props.selected.lng, props.selected.lat] : SINGAPORE,
      zoom: props.selected ? 16 : 10.8,
      pitch: view ? 50 : 0,
      scrollZoom: !view, // the small saved-meetup map doesn't hijack page scrolling
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    if (!view) {
      map.addControl(
        new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
        'top-right',
      )
    }
    map.on('error', () => {}) // a missing tile shouldn't break anything
    map.on('load', () => {
      tintMap()
      ready.value = true
      showResults()
      showSelected(!view)
    })
  } catch {
    failed.value = true
  }
})

watch(
  () => props.places,
  () => ready.value && showResults(),
)
watch(
  () => props.selected && `${props.selected.lat},${props.selected.lng}`,
  () => ready.value && showSelected(true),
)

onUnmounted(() => map?.remove())
</script>

<template>
  <div class="th-mapwrap" :data-mode="mode">
    <img v-if="failed && selected" :src="staticMap(selected.lat, selected.lng)" alt="Map of the meetup point" class="th-map" />
    <div v-else-if="failed" class="th-map th-map-empty">Search for a place to see it on the map.</div>
    <div v-else ref="container" class="th-livemap" :class="{ 'is-ready': ready }" role="region" aria-label="Map"></div>
    <p v-if="!failed && mode === 'pick' && draggable && selected" class="th-map-hint">Drag the pin to the exact spot, like a specific exit.</p>
  </div>
</template>

<style>
.th-mapwrap { position: relative; }
.th-livemap {
  width: 100%; height: 340px; border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--line);
  background: linear-gradient(135deg, #E6F6DA, #DDF3EA 55%, #D7EFEF); opacity: 0.6; transition: opacity 0.4s ease;
}
.th-livemap.is-ready { opacity: 1; }
.th-mapwrap[data-mode="view"] .th-livemap { height: 240px; }
@media (max-width: 575.98px) { .th-livemap { height: 280px; } }
.th-map-empty { display: flex; align-items: center; justify-content: center; color: var(--ink-muted); font-size: 14px; aspect-ratio: 512 / 300; }
.th-map-hint { margin: 6px 0 0; font-size: 12px; color: var(--ink-muted); }

/* Numbered search-result pins: they pop in one after another */
.th-pin-result {
  display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
  background: #FFFFFF; color: #12352D; border: 2.5px solid #12352D; font: 700 13px/1 var(--font-sans);
  box-shadow: 0 6px 14px -6px rgba(0, 0, 0, 0.5); animation: th-pin-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;
}
.th-pin-result:hover { transform: scale(1.18); background: #C8F26A; }
@keyframes th-pin-in { from { opacity: 0; transform: translateY(-14px) scale(0.4); } }

/* The chosen spot: drops in with a bounce and pulses */
.th-pin-anchor { cursor: pointer; }
.th-pin-picked { position: relative; cursor: grab; filter: drop-shadow(0 8px 10px rgba(0, 0, 0, 0.35)); animation: th-pin-drop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.th-pin-picked:active { cursor: grabbing; }
.th-pin-picked svg { display: block; }
@keyframes th-pin-drop { 0% { opacity: 0; transform: translateY(-60px); } 60% { opacity: 1; transform: translateY(4px); } 100% { transform: none; } }
.th-pin-pulse {
  position: absolute; left: 50%; bottom: -6px; width: 26px; height: 12px; margin-left: -13px; border-radius: 50%;
  background: rgba(200, 242, 106, 0.6); animation: th-pin-pulse 1.8s ease-out infinite;
}
@keyframes th-pin-pulse { 0% { transform: scale(0.6); opacity: 0.9; } 100% { transform: scale(2.6); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .th-pin-result, .th-pin-picked, .th-pin-pulse { animation: none; } }
</style>
