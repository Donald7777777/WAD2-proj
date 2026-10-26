<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import TradeLink from './TradeLink.vue'
import AppIcon from './AppIcon.vue'
import ReviewForm from './ReviewForm.vue'
import StarRating from './StarRating.vue'

// Full-screen moment when a trade is agreed or called off.
// The page behind dims, a card pops up, both traders' icons pop in, then the smile
// connects them (kind = 'linked'), connects and snaps (kind = 'broken'), or reaches out
// and falls short (kind = 'declined', when your proposal is turned down).
// kind = 'completed': after the handover, a big "Congratulations!" with confetti and a form to
// rate the other trader out of 5 stars.
const props = defineProps({
  kind: { type: String, required: true }, // 'linked' | 'broken' | 'declined' | 'completed'
  you: { type: String, required: true },
  them: { type: String, required: true },
  give: { type: Array, default: () => [] }, // titles of what you give
  get: { type: Array, default: () => [] }, // titles of what you get
  brokenTitle: { type: String, default: 'Trade cancelled' },
  // Main button when linked (on the trade page: pick a meetup; elsewhere: open the trade)
  nextLabel: { type: String, default: 'Pick a meetup spot' },
  nextIcon: { type: String, default: 'pin' },
  // For 'completed': the trade to review, and both profile pictures
  tradeId: { type: String, default: '' },
  youSrc: { type: String, default: '' },
  themSrc: { type: String, default: '' },
})
const emit = defineEmits(['close', 'next', 'retry', 'browse', 'reviewed'])

// 'completed': the rating form, then a thank-you
const review = ref(null)
function onReviewed(saved) {
  review.value = saved
  emit('reviewed', saved)
}

// The link inside starts open and changes once the card has popped in, so it animates
const linkState = ref(props.kind === 'broken' ? 'linked' : 'pending')
const closeButton = ref(null)
let timers = []

const title = computed(() =>
  props.kind === 'linked' ? "It's a deal!" : props.kind === 'completed' ? 'Congratulations!' : props.brokenTitle,
)
const subtitle = computed(
  () =>
    ({
      linked: `You and ${props.them} are linked. Pick a meetup spot to swap.`,
      broken: 'Better luck next time! The items are back up for trade.',
      declined: `${props.them} passed on this offer. Your items are still listed, so you can try a different offer.`,
      completed: review.value
        ? `Thanks for rating ${props.them}! Your review is on their profile.`
        : `You and ${props.them} completed your trade. Enjoy your new things!`,
    })[props.kind],
)
const list = (titles) => titles.join(', ') || '—'

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
  // Let the card and icons pop in first, then connect (and for a cancel, snap a moment later)
  if (props.kind === 'linked') {
    timers.push(setTimeout(() => (linkState.value = 'linked'), 550))
  } else if (props.kind === 'completed') {
    // The smile draws itself, then turns into "Traded!" with confetti
    timers.push(setTimeout(() => (linkState.value = 'done'), 550))
  } else if (props.kind === 'declined') {
    timers.push(setTimeout(() => (linkState.value = 'declined'), 600))
  } else {
    timers.push(setTimeout(() => (linkState.value = 'broken'), 1500))
  }
})

watch(
  () => props.kind,
  () => (linkState.value = props.kind === 'completed' ? 'done' : props.kind),
)

onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  timers.forEach(clearTimeout)
})
</script>

<template>
  <div class="th-moment" :data-kind="kind" role="dialog" aria-modal="true" :aria-label="title" @click.self="close">
    <div class="th-moment-card">
      <button ref="closeButton" type="button" class="th-moment-x" aria-label="Close" @click="close">
        <AppIcon name="x" :size="18" />
      </button>

      <TradeLink class="th-moment-link" :you="you" :them="them" :state="linkState" :broken-label="brokenTitle" :you-src="youSrc" :them-src="themSrc" />

      <h2 class="th-moment-title">{{ title }}</h2>
      <p class="th-moment-sub">{{ subtitle }}</p>

      <div v-if="kind === 'linked' || (kind === 'completed' && !review)" class="th-moment-items">
        <div class="th-moment-side th-moment-you"><span>{{ kind === 'completed' ? 'You gave' : 'You give' }}</span><b>{{ list(give) }}</b></div>
        <span class="th-moment-swap"><AppIcon name="swap" :size="18" /></span>
        <div class="th-moment-side th-moment-them"><span>{{ kind === 'completed' ? 'You got' : 'You get' }}</span><b>{{ list(get) }}</b></div>
      </div>

      <!-- Rate the other trader -->
      <div v-if="kind === 'completed'" class="th-moment-review">
        <ReviewForm v-if="!review && tradeId" :trade-id="tradeId" :them="them" @done="onReviewed">
          <template #secondary>
            <button type="button" class="btn btn-ghost" @click="close">Maybe later</button>
          </template>
        </ReviewForm>
        <div v-else-if="review" class="th-moment-thanks">
          <StarRating :model-value="review.rating" :size="30" />
          <p v-if="review.comment">“{{ review.comment }}”</p>
        </div>
      </div>

      <div v-if="kind !== 'completed' || review" class="th-moment-actions">
        <template v-if="kind === 'completed'">
          <button type="button" class="btn btn-primary" @click="close">Done</button>
        </template>
        <template v-else-if="kind === 'linked'">
          <button type="button" class="btn btn-ghost" @click="close">Close</button>
          <button type="button" class="btn btn-offer" @click="emit('next')"><AppIcon :name="nextIcon" :size="18" />{{ nextLabel }}</button>
        </template>
        <template v-else-if="kind === 'declined'">
          <button type="button" class="btn btn-ghost" @click="emit('browse')">Keep browsing</button>
          <button type="button" class="btn btn-primary" @click="emit('retry')"><AppIcon name="swap" :size="18" />Make a new offer</button>
        </template>
        <template v-else>
          <button v-if="nextLabel !== 'Pick a meetup spot'" type="button" class="btn btn-ghost" @click="emit('next')">{{ nextLabel }}</button>
          <button type="button" class="btn btn-primary" @click="close">OK</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
/* Dimmed, blurred backdrop */
.th-moment {
  position: fixed; inset: 0; z-index: 2400; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(8, 24, 19, 0.55); backdrop-filter: blur(5px) saturate(1.1); -webkit-backdrop-filter: blur(5px) saturate(1.1);
  animation: th-moment-dim 0.35s ease both;
}
@keyframes th-moment-dim { from { background: rgba(8, 24, 19, 0); backdrop-filter: blur(0); -webkit-backdrop-filter: blur(0); } }

/* The card pops up */
.th-moment-card {
  position: relative; width: min(560px, 100%); padding: 28px 28px 24px; border-radius: 28px; text-align: center;
  background: var(--paper-raised); box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.55);
  animation: th-moment-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.th-moment[data-kind="linked"] .th-moment-card,
.th-moment[data-kind="completed"] .th-moment-card { background: linear-gradient(160deg, #F7FCEB 0%, #ECF8F2 55%, #E6F4F4 100%); }
[data-theme="dark"] .th-moment[data-kind="linked"] .th-moment-card,
[data-theme="dark"] .th-moment[data-kind="completed"] .th-moment-card { background: linear-gradient(160deg, #1D2E18 0%, #163A2E 55%, #10353A 100%); }
@keyframes th-moment-pop { from { opacity: 0; transform: translateY(30px) scale(0.86); } to { opacity: 1; transform: none; } }

.th-moment-x {
  position: absolute; top: 10px; right: 10px; display: inline-flex; padding: 8px; border: 0; border-radius: 50%;
  background: transparent; color: var(--ink-muted);
}
.th-moment-x:hover { background: var(--paper-sunk); color: var(--ink); }

/* The link inside the card: no box of its own, no label (the title says it) */
.th-moment .th-tlink[data-state] { background: none; border: 0; box-shadow: none; padding: 26px 0 0; margin: 0; }
.th-moment .th-tlink-label { display: none; }
.th-moment .th-tlink-bridge { height: 78px; }
.th-moment .th-tlink-dot { width: 64px; height: 64px; font-size: 20px; }
.th-moment .th-tlink-node { width: 84px; }
/* The two icons pop in one after the other */
.th-moment .th-tlink-you { animation: th-moment-icon 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both; }
.th-moment .th-tlink-them { animation: th-moment-icon 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both; }
@keyframes th-moment-icon { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: none; } }
.th-moment[data-kind="broken"] .th-tlink[data-state="broken"] .th-tlink-you { transform: translateX(-6px); }
.th-moment[data-kind="broken"] .th-tlink[data-state="broken"] .th-tlink-them { transform: translateX(6px); }

.th-moment-title {
  margin: 4px 0 6px; font: 750 34px/1.1 var(--font-display); letter-spacing: -0.02em; color: var(--ink);
  animation: th-moment-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) 1.55s both;
}
.th-moment[data-kind="broken"] .th-moment-title,
.th-moment[data-kind="declined"] .th-moment-title { font-size: 28px; animation-delay: 1.6s; }
.th-moment[data-kind="declined"] .th-moment-sub { animation-delay: 1.7s; }
.th-moment[data-kind="declined"] .th-moment-actions { animation-delay: 1.8s; }
.th-moment-sub { margin: 0 auto 18px; max-width: 38ch; color: var(--ink-muted); font-size: 15px; animation: th-moment-rise 0.5s ease 1.65s both; }
.th-moment[data-kind="broken"] .th-moment-sub { animation-delay: 1.7s; }
@keyframes th-moment-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

.th-moment-items {
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin-bottom: 20px; text-align: left;
  animation: th-moment-rise 0.5s ease 1.75s both;
}
.th-moment-side { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border-radius: 14px; min-width: 0; }
.th-moment-side span { font: 500 11px/14px var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; }
.th-moment-side b { font-size: 14px; line-height: 19px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.th-moment-you { background: var(--lime-soft); } .th-moment-you span { color: var(--lime-ink); }
.th-moment-them { background: var(--lagoon-soft); } .th-moment-them span { color: var(--lagoon); }
.th-moment-swap { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 50%; background: var(--ink); color: var(--on-ink); }

/* Congratulations: bigger title, and the rating form rises in last */
.th-moment[data-kind="completed"] .th-moment-title { font-size: 40px; background: linear-gradient(90deg, var(--lime-ink), var(--emerald), var(--lagoon)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.th-moment[data-kind="completed"] .th-moment-card { max-height: calc(100vh - 32px); overflow-y: auto; }
.th-moment-review { padding-top: 14px; border-top: 1px dashed var(--line-strong); animation: th-moment-rise 0.5s ease 1.95s both; }
.th-moment-thanks { display: flex; flex-direction: column; align-items: center; gap: 6px; padding-bottom: 14px; animation: th-moment-rise 0.4s ease both; }
.th-moment[data-kind="completed"] .th-moment-actions { animation-delay: 0.15s; }
.th-moment-thanks p { margin: 0; font-style: italic; color: var(--ink-muted); }
.th-moment-actions { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; animation: th-moment-rise 0.5s ease 1.85s both; }
.th-moment[data-kind="broken"] .th-moment-actions { animation-delay: 1.8s; }

@media (max-width: 575.98px) {
  .th-moment-card { padding: 22px 16px 18px; border-radius: 22px; }
  .th-moment-title { font-size: 28px; }
  .th-moment[data-kind="completed"] .th-moment-title { font-size: 32px; }
  .th-moment-items { grid-template-columns: 1fr; }
  .th-moment-swap { justify-self: center; transform: rotate(90deg); }
  .th-moment .th-tlink-dot { width: 52px; height: 52px; font-size: 17px; }
}
@media (prefers-reduced-motion: reduce) {
  .th-moment, .th-moment * { animation-duration: 0.001ms !important; animation-delay: 0s !important; }
}
</style>
