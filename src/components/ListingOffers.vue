<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import { useNotificationStore } from '@/stores/notifications'
import UserAvatar from './UserAvatar.vue'
import AppIcon from './AppIcon.vue'

// Every live offer for one listing (open or accepted), visible to everyone, so people can
// see the competition and make a better offer. The owner and each offerer can open their own trade.
const props = defineProps({
  listingId: { type: String, required: true },
  isOwner: Boolean,
  canOffer: Boolean, // logged in and not the owner
  traded: Boolean,
})
const emit = defineEmits(['loaded'])

const offers = ref([])
const loading = ref(true)
const error = ref('')
const notes = useNotificationStore()

async function load() {
  try {
    const { data } = await api.get(`/listings/${props.listingId}/offers`)
    offers.value = data
    error.value = ''
    emit('loaded', data)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
watch(() => props.listingId, load, { immediate: true })
// Something new happened in your trades (e.g. a competing offer): refresh the list
let reloadTimer = null
function reloadSoon() {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(load, 300)
}
watch(() => notes.ringKey, reloadSoon)
// Anyone's offer on this item changed (new, edited, accepted, withdrawn...): refresh it live,
// even if you're only browsing and not part of any of the trades
const stopListening = notes.onTradeEvent((event) => {
  if (event.type === 'listing' && event.ids?.includes(String(props.listingId))) reloadSoon()
})
onUnmounted(() => {
  stopListening()
  clearTimeout(reloadTimer)
})

const STATUS = {
  accepted: { label: 'Accepted', tone: 'accepted', hint: 'Deal agreed, item reserved' },
  countered: { label: 'Negotiating', tone: 'countered', hint: 'Counter offer in progress' },
  pending: { label: 'Waiting', tone: 'pending', hint: 'Waiting for the owner' },
}
const hasAccepted = computed(() => offers.value.some((o) => o.status === 'accepted'))
// Your own offer (one each): improve it instead of making another
const mine = computed(() => (props.isOwner ? null : offers.value.find((o) => o.mine)))
const others = computed(() => offers.value.filter((o) => !o.mine).length)

function ago(date) {
  const s = (Date.now() - new Date(date).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}
</script>

<template>
  <section id="offers" class="th-offers" aria-labelledby="offers-title">
    <div class="th-offers-head">
      <div>
        <h2 id="offers-title">Offers on this item <span v-if="offers.length" class="th-count">{{ offers.length }}</span></h2>
        <p class="th-muted mb-0">
          <template v-if="traded">This item has been traded.</template>
          <template v-else-if="isOwner">Everyone can see these offers. Open one to accept, counter or decline it.</template>
          <template v-else-if="hasAccepted">The owner has accepted an offer, but can still switch to a better one.</template>
          <template v-else>See what others have offered, then make yours.</template>
        </p>
      </div>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="loading" class="th-offers-grid">
      <div v-for="n in 2" :key="n" class="th-skeleton" style="aspect-ratio: auto; height: 132px"></div>
    </div>
    <div v-else-if="!offers.length" class="th-empty th-offers-empty">
      <AppIcon name="swap" :size="26" />
      <strong>{{ isOwner ? 'No offers yet' : 'No offers yet. Be the first!' }}</strong>
    </div>

    <TransitionGroup v-else name="th-photo" tag="div" class="th-offers-grid">
      <article
        v-for="offer in offers"
        :key="offer._id"
        class="card th-offer"
        :class="[`is-${STATUS[offer.status]?.tone || 'pending'}`, { 'is-mine': offer.mine && !isOwner }]"
      >
        <header class="th-offer-head">
          <RouterLink :to="`/users/${offer.offerer._id}`" class="th-offer-who">
            <UserAvatar :name="offer.offerer.name" :src="offer.offerer.avatarUrl" />
            <span>
              <b>{{ offer.mine && !isOwner ? 'Your offer' : offer.offerer.name }}</b>
              <small class="th-muted">{{ ago(offer.createdAt) }}</small>
            </span>
          </RouterLink>
          <span class="th-offer-status" :title="STATUS[offer.status]?.hint">
            <AppIcon v-if="offer.status === 'accepted'" name="check" :size="13" />{{ STATUS[offer.status]?.label }}
          </span>
        </header>

        <div class="th-offer-items">
          <span class="th-offer-label">Offers</span>
          <div class="th-offer-thumbs">
            <RouterLink v-for="item in offer.items" :key="item._id" :to="`/listings/${item._id}`" class="th-offer-item" :title="item.title">
              <span class="th-offer-thumb">
                <img v-if="item.imageUrl" :src="item.imageUrl" alt="" loading="lazy" />
                <AppIcon v-else name="image" :size="16" />
              </span>
              <span class="th-offer-title">{{ item.title }}</span>
            </RouterLink>
          </div>
        </div>

        <RouterLink v-if="offer.tradeId" :to="`/trades/${offer.tradeId}`" class="th-offer-open">
          {{ isOwner ? 'Open this offer' : 'Open your trade' }}<AppIcon name="chevron" :size="15" />
        </RouterLink>
      </article>
    </TransitionGroup>

    <template v-if="canOffer && !traded && offers.length">
      <div v-if="mine && ['pending', 'countered'].includes(mine.status) && others" class="th-offers-cta">
        <span><b>{{ others }} other offer{{ others === 1 ? '' : 's' }} in the running.</b> You can change yours to stand out.</span>
        <RouterLink :to="`/trades/${mine.tradeId}?edit=1`" class="btn btn-offer"><AppIcon name="edit" :size="18" />Change my offer</RouterLink>
      </div>
      <div v-else-if="!mine" class="th-offers-cta">
        <span><b>Think you can beat {{ offers.length === 1 ? 'it' : 'these' }}?</b> The owner picks the offer they like best.</span>
        <RouterLink :to="`/listings/${listingId}/propose`" class="btn btn-offer"><AppIcon name="swap" :size="18" />Make a competing offer</RouterLink>
      </div>
    </template>
  </section>
</template>

<style>
.th-offers { margin-top: 36px; scroll-margin-top: 90px; }
.th-offers-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.th-offers-head h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 2px; font-size: 22px; font-weight: 750; }
.th-offers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
@media (max-width: 575.98px) { .th-offers-grid { grid-template-columns: minmax(0, 1fr); } }
.th-offers-empty { padding: 22px; }

.th-offer { display: flex; flex-direction: column; gap: 12px; padding: 14px; border-left: 4px solid var(--line-strong); }
.th-offer.is-accepted { border-left-color: var(--lagoon); background: linear-gradient(135deg, var(--lagoon-soft), var(--paper-raised) 60%); }
.th-offer.is-countered { border-left-color: #E4B54A; }
.th-offer.is-mine { box-shadow: 0 0 0 2px var(--lime), var(--shadow-card); }
.th-offer-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.th-offer-who { display: inline-flex; align-items: center; gap: 10px; min-width: 0; color: var(--ink); text-decoration: none; }
.th-offer-who > span:last-child { display: flex; flex-direction: column; min-width: 0; line-height: 18px; }
.th-offer-who b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-offer-who:hover b { text-decoration: underline; }
.th-offer-status {
  display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 3px 10px; border-radius: 999px;
  background: var(--paper-sunk); color: var(--ink-muted); font: 600 12px/18px var(--font-sans);
}
.th-offer.is-accepted .th-offer-status { background: var(--lagoon); color: #fff; }
.th-offer.is-countered .th-offer-status { background: #FBEFCB; color: #7A5500; }
.th-offer-label { display: block; margin-bottom: 6px; color: var(--ink-muted); font: 500 11px/14px var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; }
.th-offer-thumbs { display: flex; flex-wrap: wrap; gap: 8px; }
.th-offer-item { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 4px 10px 4px 4px; border-radius: 12px; background: var(--paper-sunk); color: var(--ink); text-decoration: none; font-size: 13px; font-weight: 600; }
.th-offer-item:hover { background: var(--mint-soft); color: var(--ink); }
.th-offer-thumb { display: inline-flex; flex: none; width: 36px; height: 36px; align-items: center; justify-content: center; border-radius: 9px; overflow: hidden; background: var(--paper-raised); color: var(--ink-muted); }
.th-offer-thumb img { width: 100%; height: 100%; object-fit: cover; }
.th-offer-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-offer-open { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; margin-top: auto; font-size: 14px; font-weight: 700; color: var(--ink); }

.th-offers-cta {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 16px;
  padding: 14px 16px; border-radius: var(--radius-md); background: var(--grad-soft); font-size: 15px;
}
@media (max-width: 575.98px) { .th-offers-cta .btn { width: 100%; justify-content: center; } }
</style>
