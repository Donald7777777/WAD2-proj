<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import UserAvatar from './UserAvatar.vue'
import AppIcon from './AppIcon.vue'

// Full-screen pop-up about competing offers (uses the backdrop and card from TradeMoment.vue).
//   kind 'competitor': someone else made an offer for an item you've offered for (or agreed on)
//   kind 'newOffer':   you own the item, and another person has made an offer for it
const props = defineProps({
  // { kind, listing: { title, imageUrl }, rival: { name, avatarUrl }, items: [{ title, imageUrl }],
  //   offerCount, myStatus, ownerName, reserved }
  moment: { type: Object, required: true },
  you: { type: String, default: 'You' },
  youSrc: { type: String, default: '' },
})
const emit = defineEmits(['close', 'offers', 'trade'])

const closeButton = ref(null)
const isRival = computed(() => props.moment.kind === 'competitor')
const title = computed(() => (isRival.value ? 'You have a competitor!' : `Another offer for your ${props.moment.listing.title}!`))
const note = computed(() => {
  const m = props.moment
  if (isRival.value) {
    return m.myStatus === 'accepted'
      ? `Your deal is still on, but ${m.ownerName} could switch to their offer.`
      : `${m.ownerName} will pick the offer they like best. Make sure yours stands out.`
  }
  return m.reserved
    ? `You now have ${m.offerCount} offers. Accepting this one would cancel the trade you already agreed.`
    : `You now have ${m.offerCount} offers on this item. Compare them and pick your favourite.`
})

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
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="th-moment th-omoment" :data-kind="moment.kind" role="dialog" aria-modal="true" :aria-label="title" @click.self="close">
    <div class="th-moment-card">
      <button ref="closeButton" type="button" class="th-moment-x" aria-label="Close" @click="close">
        <AppIcon name="x" :size="18" />
      </button>

      <!-- You vs them, with the item between you (or just them and your item) -->
      <div class="th-omoment-scene">
        <span v-if="isRival" class="th-omoment-person th-omoment-you">
          <UserAvatar :name="you" :src="youSrc" you size="lg" />
          <small>You</small>
        </span>
        <span class="th-omoment-item">
          <img v-if="moment.listing.imageUrl" :src="moment.listing.imageUrl" alt="" />
          <AppIcon v-else name="image" :size="28" />
          <span v-if="isRival" class="th-omoment-vs">VS</span>
          <span v-else class="th-omoment-plus"><AppIcon name="plus" :size="16" /></span>
        </span>
        <span class="th-omoment-person th-omoment-them">
          <UserAvatar :name="moment.rival.name" :src="moment.rival.avatarUrl" size="lg" />
          <small>{{ moment.rival.name }}</small>
        </span>
      </div>

      <span class="eyebrow th-omoment-eyebrow">{{ isRival ? 'Heads up' : 'New offer' }}</span>
      <h2 class="th-moment-title th-omoment-title">{{ title }}</h2>
      <p class="th-moment-sub th-omoment-sub">
        <template v-if="isRival">{{ moment.rival.name }} also made an offer for {{ moment.listing.title }}.</template>
        <template v-else>{{ moment.rival.name }} offered:</template>
      </p>

      <div v-if="moment.items.length" class="th-omoment-items">
        <span v-if="isRival" class="th-omoment-label">They offered</span>
        <div class="th-omoment-chips">
          <span v-for="(item, i) in moment.items" :key="item._id || i" class="th-omoment-chip" :style="{ animationDelay: `${1.05 + i * 0.08}s` }">
            <span class="th-omoment-thumb">
              <img v-if="item.imageUrl" :src="item.imageUrl" alt="" />
              <AppIcon v-else name="image" :size="14" />
            </span>
            {{ item.title }}
          </span>
        </div>
      </div>

      <p class="th-omoment-note">{{ note }}</p>

      <div class="th-moment-actions th-omoment-actions">
        <template v-if="isRival">
          <button type="button" class="btn btn-ghost" @click="emit('trade')">Open my trade</button>
          <button type="button" class="btn btn-offer" @click="emit('offers')"><AppIcon name="swap" :size="18" />See all offers</button>
        </template>
        <template v-else>
          <button type="button" class="btn btn-ghost" @click="emit('offers')">Compare offers</button>
          <button type="button" class="btn btn-offer" @click="emit('trade')"><AppIcon name="swap" :size="18" />View this offer</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
.th-omoment { z-index: 2440; }
.th-omoment[data-kind="competitor"] .th-moment-card { background: linear-gradient(160deg, #FFF4E5 0%, #FFF9EE 45%, #F3F8EC 100%); }
.th-omoment[data-kind="newOffer"] .th-moment-card { background: linear-gradient(160deg, #F7FCEB 0%, #ECF8F2 55%, #E6F4F4 100%); }
[data-theme="dark"] .th-omoment .th-moment-card { background: linear-gradient(160deg, #33291A 0%, #1D2E18 60%, #163A2E 100%); }

/* Scene: avatars slide in from the sides, the item drops in the middle, VS pops */
.th-omoment-scene { display: flex; align-items: center; justify-content: center; gap: 18px; padding: 18px 0 8px; }
.th-omoment-person { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 92px; }
.th-omoment-person small { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-muted); font-size: 12px; font-weight: 600; }
.th-omoment-person .th-avatar { width: 64px; height: 64px; font-size: 22px; box-shadow: 0 0 0 4px var(--paper-raised); }
.th-omoment-you { animation: th-omoment-left 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both; }
.th-omoment-them { animation: th-omoment-right 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s both; }
.th-omoment[data-kind="competitor"] .th-omoment-them .th-avatar { box-shadow: 0 0 0 4px var(--paper-raised), 0 0 0 7px #F0A43A; }
@keyframes th-omoment-left { from { opacity: 0; transform: translateX(-40px) scale(0.6); } }
@keyframes th-omoment-right { from { opacity: 0; transform: translateX(40px) scale(0.6); } }
.th-omoment-item {
  position: relative; display: inline-flex; flex: none; width: 104px; height: 104px; align-items: center; justify-content: center;
  border-radius: 22px; overflow: visible; background: var(--paper-sunk); color: var(--ink-muted);
  box-shadow: 0 14px 30px -16px rgba(0, 0, 0, 0.5); animation: th-moment-icon 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s both;
}
.th-omoment-item img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
.th-omoment-vs, .th-omoment-plus {
  position: absolute; left: 50%; bottom: -14px; display: inline-flex; align-items: center; justify-content: center; height: 28px; min-width: 40px;
  margin-left: -20px; padding: 0 10px; border-radius: 999px; font: 800 13px/1 var(--font-display); letter-spacing: 0.06em;
  box-shadow: 0 0 0 3px var(--paper-raised); animation: th-omoment-vs 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.65s both;
}
.th-omoment-vs { background: #F0A43A; color: #3B2500; }
.th-omoment-plus { min-width: 28px; margin-left: -14px; padding: 0; background: var(--lime); color: var(--on-lime); }
@keyframes th-omoment-vs { from { opacity: 0; transform: scale(0.2) rotate(-30deg); } }

.th-omoment-eyebrow { display: block; margin-top: 22px; color: #A0620A; animation: th-moment-rise 0.4s ease 0.7s both; }
.th-omoment[data-kind="newOffer"] .th-omoment-eyebrow { color: var(--lime-ink); }
.th-omoment-title { font-size: 28px; animation-delay: 0.75s; }
.th-omoment-sub { margin-bottom: 10px; animation-delay: 0.85s; }

.th-omoment-items { margin: 0 auto 12px; max-width: 460px; }
.th-omoment-label { display: block; margin-bottom: 6px; color: var(--ink-muted); font: 500 11px/14px var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; animation: th-moment-rise 0.4s ease 0.95s both; }
.th-omoment-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.th-omoment-chip {
  display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 4px 12px 4px 4px; border-radius: 12px;
  background: var(--paper-raised); box-shadow: 0 6px 16px -12px rgba(0, 0, 0, 0.5); font-size: 14px; font-weight: 600;
  animation: th-moment-icon 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.th-omoment-thumb { display: inline-flex; flex: none; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 9px; overflow: hidden; background: var(--paper-sunk); color: var(--ink-muted); }
.th-omoment-thumb img { width: 100%; height: 100%; object-fit: cover; }
.th-omoment-note { margin: 0 auto 18px; max-width: 40ch; color: var(--ink-muted); font-size: 14px; animation: th-moment-rise 0.5s ease 1.25s both; }
.th-omoment-actions { animation-delay: 1.35s; }

@media (max-width: 575.98px) {
  .th-omoment-scene { gap: 10px; }
  .th-omoment-person { width: 72px; }
  .th-omoment-person .th-avatar { width: 52px; height: 52px; font-size: 18px; }
  .th-omoment-item { width: 84px; height: 84px; border-radius: 18px; }
  .th-omoment-title { font-size: 23px; }
}
</style>
