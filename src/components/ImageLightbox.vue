<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'

// Full-screen photo viewer: tap the backdrop, press Esc or the X to close; arrows / swipe for more photos.
const props = defineProps({
  images: { type: Array, default: () => [] }, // [{ url }]
  start: { type: Number, default: 0 },
  title: { type: String, default: 'Photo' },
})
const emit = defineEmits(['close'])

const index = ref(Math.min(Math.max(props.start, 0), Math.max(props.images.length - 1, 0)))
const count = computed(() => props.images.length)
const current = computed(() => props.images[index.value])
const closeButton = ref(null)
let opener = null
let previousOverflow = ''

const next = () => count.value > 1 && (index.value = (index.value + 1) % count.value)
const prev = () => count.value > 1 && (index.value = (index.value - 1 + count.value) % count.value)

function onKey(event) {
  if (event.key === 'Escape') emit('close')
  else if (event.key === 'ArrowRight') next()
  else if (event.key === 'ArrowLeft') prev()
  else if (event.key === 'Tab') {
    // Keep keyboard focus inside the viewer
    const buttons = [...document.querySelectorAll('.th-lightbox button')]
    if (!buttons.length) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
}

let startX = null
const onDown = (event) => (startX = event.clientX)
function onUp(event) {
  if (startX === null) return
  const dx = event.clientX - startX
  startX = null
  if (Math.abs(dx) > 50) (dx < 0 ? next : prev)()
}

onMounted(() => {
  opener = document.activeElement
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKey)
  closeButton.value?.focus()
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = previousOverflow
  opener?.focus?.()
})
</script>

<template>
  <Teleport to="body">
    <div class="th-lightbox" role="dialog" aria-modal="true" :aria-label="`${title} photo viewer`" @click.self="emit('close')">
      <button ref="closeButton" type="button" class="th-lightbox-btn th-lightbox-close" aria-label="Close photo" @click="emit('close')">
        <AppIcon name="x" :size="22" />
      </button>
      <div class="th-lightbox-stage" @click.self="emit('close')" @pointerdown="onDown" @pointerup="onUp">
        <img v-if="current" :key="current.url" :src="current.url" :alt="`${title}, photo ${index + 1} of ${count}`" draggable="false" />
      </div>
      <template v-if="count > 1">
        <button type="button" class="th-lightbox-btn th-lightbox-prev" aria-label="Previous photo" @click="prev">
          <AppIcon name="chevron" :size="24" class="th-flip" />
        </button>
        <button type="button" class="th-lightbox-btn th-lightbox-next" aria-label="Next photo" @click="next">
          <AppIcon name="chevron" :size="24" />
        </button>
        <span class="th-lightbox-count">{{ index + 1 }} / {{ count }}</span>
      </template>
    </div>
  </Teleport>
</template>

<style>
.th-lightbox { position: fixed; inset: 0; z-index: 2000; display: grid; background: rgba(8, 20, 17, 0.92); animation: th-lightbox-in 0.2s ease both; }
.th-lightbox-stage { display: grid; place-items: center; padding: 56px 16px; touch-action: pan-y; user-select: none; min-height: 0; }
.th-lightbox-stage img { max-width: 100%; max-height: calc(100dvh - 112px); object-fit: contain; border-radius: var(--radius-md); box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.6); animation: th-lightbox-img 0.25s cubic-bezier(0.22, 1, 0.36, 1) both; }
.th-lightbox-btn {
  position: absolute; z-index: 1; display: inline-grid; place-items: center; width: 44px; height: 44px; border: 0; border-radius: 50%;
  background: rgba(255, 255, 255, 0.14); color: #fff; backdrop-filter: blur(6px);
  transition: background 160ms ease, transform 160ms ease;
}
.th-lightbox-btn:hover { background: rgba(255, 255, 255, 0.26); }
.th-lightbox-btn:active { transform: scale(0.94); }
.th-lightbox-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.th-lightbox-close { top: max(12px, env(safe-area-inset-top)); right: 12px; }
.th-lightbox-prev, .th-lightbox-next { top: 50%; margin-top: -22px; }
.th-lightbox-prev { left: 12px; }
.th-lightbox-next { right: 12px; }
.th-lightbox-count { position: absolute; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); transform: translateX(-50%); padding: 4px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.14); color: #fff; font: 500 13px/18px var(--font-mono); }
@keyframes th-lightbox-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes th-lightbox-img { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .th-lightbox, .th-lightbox-stage img { animation: none; } }
</style>
