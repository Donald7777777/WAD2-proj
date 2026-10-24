<script setup>
import { ref, computed, watch } from 'vue'
import AppIcon from './AppIcon.vue'

// Photo gallery for a listing: big photo with arrows, swipe on phones, thumbnails underneath
const props = defineProps({
  images: { type: Array, default: () => [] }, // [{ url }]
  title: { type: String, default: '' },
})

const index = ref(0)
const direction = ref('next')
const count = computed(() => props.images.length)
const current = computed(() => props.images[index.value])

watch(
  () => props.images,
  () => (index.value = 0),
)

function go(to) {
  if (count.value < 2) return
  direction.value = to > index.value || (index.value === count.value - 1 && to === 0) ? 'next' : 'prev'
  index.value = (to + count.value) % count.value
}
const next = () => {
  direction.value = 'next'
  index.value = (index.value + 1) % count.value
}
const prev = () => {
  direction.value = 'prev'
  index.value = (index.value - 1 + count.value) % count.value
}

// Swipe left / right on touch screens
let startX = null
function onDown(event) {
  startX = event.clientX
}
function onUp(event) {
  if (startX === null || count.value < 2) return
  const dx = event.clientX - startX
  startX = null
  if (Math.abs(dx) > 40) (dx < 0 ? next : prev)()
}
function onKey(event) {
  if (event.key === 'ArrowRight') next()
  if (event.key === 'ArrowLeft') prev()
}
</script>

<template>
  <div class="th-gallery">
    <div
      class="th-detail-media th-gallery-main"
      :tabindex="count > 1 ? 0 : null"
      :aria-label="count > 1 ? `Photo ${index + 1} of ${count}. Use the arrow keys to see more.` : null"
      @pointerdown="onDown"
      @pointerup="onUp"
      @keydown="onKey"
    >
      <Transition :name="`th-slide-${direction}`">
        <img v-if="current" :key="current.url" :src="current.url" :alt="`${title}, photo ${index + 1}`" draggable="false" />
      </Transition>
      <div v-if="!current" class="th-listing-noimg">
        <AppIcon name="image" :size="36" />
        <span>No photo yet</span>
      </div>

      <template v-if="count > 1">
        <button type="button" class="th-gallery-arrow th-gallery-prev" aria-label="Previous photo" @click="prev">
          <AppIcon name="chevron" :size="22" class="th-flip" />
        </button>
        <button type="button" class="th-gallery-arrow th-gallery-next" aria-label="Next photo" @click="next">
          <AppIcon name="chevron" :size="22" />
        </button>
        <span class="th-gallery-count">{{ index + 1 }} / {{ count }}</span>
      </template>
    </div>

    <div v-if="count > 1" class="th-gallery-thumbs">
      <button
        v-for="(img, i) in images"
        :key="img.url"
        type="button"
        class="th-gallery-thumb"
        :class="{ 'is-active': i === index }"
        :aria-label="`Show photo ${i + 1}`"
        @click="go(i)"
      >
        <img :src="img.url" alt="" loading="lazy" />
      </button>
    </div>
  </div>
</template>

<style>
.th-gallery { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
@media (min-width: 768px) { .th-gallery { position: sticky; top: 88px; align-self: start; } .th-gallery .th-detail-media { position: relative; top: 0; } }
.th-gallery-main { touch-action: pan-y; user-select: none; outline: none; }
.th-gallery-main:focus-visible { box-shadow: 0 0 0 3px var(--focus); }
.th-gallery-arrow {
  position: absolute; top: 50%; z-index: 2; display: inline-flex; align-items: center; justify-content: center;
  width: 42px; height: 42px; margin-top: -21px; border: 0; border-radius: 50%;
  background: rgba(255, 255, 255, 0.88); color: #10302A; box-shadow: 0 6px 18px -8px rgba(0, 0, 0, 0.45);
  opacity: 0; transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.th-gallery-prev { left: 12px; }
.th-gallery-next { right: 12px; }
.th-gallery-main:hover .th-gallery-arrow, .th-gallery-main:focus-within .th-gallery-arrow { opacity: 1; }
@media (hover: none) { .th-gallery-arrow { opacity: 1; width: 36px; height: 36px; margin-top: -18px; } }
.th-gallery-arrow:hover { transform: scale(1.1); }
.th-gallery-count {
  position: absolute; right: 12px; bottom: 12px; z-index: 2; padding: 4px 10px; border-radius: 999px;
  background: rgba(16, 48, 42, 0.75); color: #F4F5EF; font: 500 12px/16px var(--font-mono);
}
.th-gallery-thumbs { display: flex; gap: 8px; overflow-x: auto; padding: 2px; scrollbar-width: thin; }
.th-gallery-thumb {
  flex: none; width: 68px; height: 68px; padding: 0; border: 0; border-radius: var(--radius-sm); overflow: hidden;
  background: var(--paper-sunk); opacity: 0.6; box-shadow: 0 0 0 2px transparent;
  transition: opacity 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}
.th-gallery-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.th-gallery-thumb:hover { opacity: 0.9; transform: translateY(-2px); }
.th-gallery-thumb.is-active { opacity: 1; box-shadow: 0 0 0 2px var(--emerald); }

/* Photos slide in the direction you're going */
.th-slide-next-enter-active, .th-slide-next-leave-active,
.th-slide-prev-enter-active, .th-slide-prev-leave-active { transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease; }
.th-slide-next-leave-active, .th-slide-prev-leave-active { position: absolute; inset: 0; }
.th-slide-next-enter-from { transform: translateX(14%); opacity: 0; }
.th-slide-next-leave-to { transform: translateX(-14%); opacity: 0; }
.th-slide-prev-enter-from { transform: translateX(-14%); opacity: 0; }
.th-slide-prev-leave-to { transform: translateX(14%); opacity: 0; }
</style>
