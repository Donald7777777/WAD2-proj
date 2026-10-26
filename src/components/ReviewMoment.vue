<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { confetti } from '@/lib/motion'
import UserAvatar from './UserAvatar.vue'
import AppIcon from './AppIcon.vue'

// Full-screen pop-up when someone rates you after a trade (like the "It's a deal!" one).
// The page dims, their picture pops in, the stars fill one by one (confetti for 4 or 5),
// then their comment and your new average appear.
const props = defineProps({
  // { from, fromAvatar, rating, comment, average, count }
  review: { type: Object, required: true },
})
const emit = defineEmits(['close', 'open'])

const closeButton = ref(null)
const starsEl = ref(null)
let timer = null

const title = computed(() => {
  const n = props.review.rating
  if (n === 5) return `${props.review.from} gave you 5 stars!`
  if (n === 4) return `${props.review.from} gave you 4 stars!`
  return `${props.review.from} rated you ${n} star${n === 1 ? '' : 's'}`
})
const subtitle = computed(() =>
  props.review.rating >= 4 ? 'Nice one! Happy traders make for happy trades.' : 'Every trade is a chance to do even better next time.',
)

function close() {
  emit('close')
}
function onKey(event) {
  if (event.key === 'Escape') close()
}

onMounted(async () => {
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
  await nextTick()
  closeButton.value?.focus({ preventScroll: true })
  // Confetti once the last star has filled
  if (props.review.rating >= 4) timer = setTimeout(() => confetti(starsEl.value, { count: 60 }), 650 + props.review.rating * 160)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  clearTimeout(timer)
})
</script>

<template>
  <div class="th-moment th-rmoment" data-kind="review" role="dialog" aria-modal="true" :aria-label="title" @click.self="close">
    <div class="th-moment-card">
      <button ref="closeButton" type="button" class="th-moment-x" aria-label="Close" @click="close">
        <AppIcon name="x" :size="18" />
      </button>

      <div class="th-rmoment-who">
        <UserAvatar :name="review.from" :src="review.fromAvatar" size="xl" />
        <span class="th-rmoment-badge"><AppIcon name="star" :size="20" /></span>
      </div>

      <span class="eyebrow th-rmoment-eyebrow">New review</span>
      <h2 class="th-moment-title th-rmoment-title">{{ title }}</h2>

      <!-- The stars fill one after another -->
      <div ref="starsEl" class="th-rmoment-stars" :aria-label="`${review.rating} out of 5 stars`">
        <svg
          v-for="i in 5"
          :key="i"
          class="th-rmoment-star"
          :class="{ 'is-on': i <= review.rating }"
          :style="{ animationDelay: `${500 + i * 160}ms` }"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
        </svg>
      </div>

      <blockquote v-if="review.comment" class="th-rmoment-quote">“{{ review.comment }}”</blockquote>
      <p class="th-moment-sub th-rmoment-sub">{{ subtitle }}</p>

      <p v-if="review.count" class="th-rmoment-avg">
        Your rating is now <b>{{ review.average.toFixed(1) }} ★</b> from {{ review.count }} review{{ review.count === 1 ? '' : 's' }}
      </p>

      <div class="th-moment-actions th-rmoment-actions">
        <button type="button" class="btn btn-ghost" @click="close">Close</button>
        <button type="button" class="btn btn-offer" @click="emit('open')"><AppIcon name="star" :size="18" />See my reviews</button>
      </div>
    </div>
  </div>
</template>

<style>
/* Uses the backdrop and card from TradeMoment.vue; these are the review-specific parts */
.th-rmoment { z-index: 2450; }
.th-rmoment .th-moment-card { background: linear-gradient(160deg, #FFFBEA 0%, #F7FCEB 50%, #ECF8F2 100%); }
[data-theme="dark"] .th-rmoment .th-moment-card { background: linear-gradient(160deg, #2E2A16 0%, #1D2E18 55%, #163A2E 100%); }

.th-rmoment-who { position: relative; display: inline-flex; margin: 8px auto 10px; animation: th-moment-icon 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both; }
.th-rmoment-who .th-avatar { box-shadow: 0 0 0 4px var(--paper-raised), 0 0 0 7px #F5B82E; }
.th-rmoment-badge {
  position: absolute; right: -2px; bottom: 2px; display: inline-flex; width: 38px; height: 38px; align-items: center; justify-content: center;
  border-radius: 50%; background: #F5B82E; color: #4A3400; box-shadow: 0 0 0 3px var(--paper-raised);
  animation: th-moment-icon 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s both;
}
.th-rmoment-badge svg { fill: currentColor; }
.th-rmoment-eyebrow { display: block; margin-top: 6px; color: #9A6B00; animation: th-moment-rise 0.4s ease 0.35s both; }
.th-rmoment-title { font-size: 30px; animation-delay: 0.4s; }

.th-rmoment-stars { display: flex; justify-content: center; gap: 6px; margin: 6px 0 14px; }
.th-rmoment-star { width: 44px; height: 44px; fill: var(--paper-sunk); stroke: #E4B54A; stroke-width: 1.2; stroke-linejoin: round; }
.th-rmoment-star.is-on { animation: th-rstar 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
@keyframes th-rstar {
  0% { fill: var(--paper-sunk); transform: scale(0.6) rotate(-25deg); }
  60% { fill: #F5B82E; transform: scale(1.25) rotate(8deg); }
  100% { fill: #F5B82E; transform: none; }
}

.th-rmoment-quote {
  position: relative; margin: 0 auto 12px; max-width: 40ch; padding: 12px 16px; border-radius: 16px;
  background: var(--paper-raised); box-shadow: 0 8px 20px -14px rgba(0, 0, 0, 0.4); font-size: 16px; font-style: italic; line-height: 23px;
  animation: th-moment-rise 0.5s ease 1.5s both;
}
.th-rmoment-sub { margin-bottom: 8px; animation-delay: 1.6s; }
.th-rmoment-avg { margin: 0 0 18px; font-size: 14px; color: var(--ink-muted); animation: th-moment-rise 0.5s ease 1.7s both; }
.th-rmoment-avg b { color: var(--ink); }
.th-rmoment-actions { animation-delay: 1.8s; }

@media (max-width: 575.98px) {
  .th-rmoment-title { font-size: 25px; }
  .th-rmoment-star { width: 38px; height: 38px; }
}
</style>
