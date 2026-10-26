<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import { showToast } from '@/lib/toast'
import AppIcon from './AppIcon.vue'

// Heart (like) and bookmark (save) with counts, for a listing card or the listing page
const props = defineProps({
  listing: { type: Object, required: true },
  size: { type: String, default: 'sm' }, // 'sm' on cards, 'lg' on the listing page
})
const emit = defineEmits(['change'])

// Works without the login store or router too (e.g. in the ListingCard unit test)
const auth = (() => {
  try {
    return useAuthStore()
  } catch {
    return { user: null }
  }
})()
const router = useRouter()

const me = computed(() => auth.user?._id)
const isOwner = computed(() => me.value && (props.listing.owner?._id || props.listing.owner) === me.value)
const has = (list) => (list || []).some((id) => String(id?._id || id) === me.value)

const likeCount = ref(0)
const saveCount = ref(0)
const liked = ref(false)
const saved = ref(false)
const burst = ref(0) // restarts the heart burst animation
const busy = ref(false)

function sync() {
  likeCount.value = (props.listing.likes || []).length
  saveCount.value = (props.listing.saves || []).length
  liked.value = has(props.listing.likes)
  saved.value = has(props.listing.saves)
}
watch(() => [props.listing._id, me.value], sync, { immediate: true })

async function toggle(kind) {
  if (!auth.user) {
    router?.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  if (isOwner.value || busy.value) return
  busy.value = true
  // Update straight away, then use the server's numbers
  if (kind === 'like') {
    liked.value = !liked.value
    likeCount.value += liked.value ? 1 : -1
    if (liked.value) burst.value++
  } else {
    saved.value = !saved.value
    saveCount.value += saved.value ? 1 : -1
  }
  try {
    const { data } = await api.post(`/listings/${props.listing._id}/${kind}`)
    likeCount.value = data.likeCount
    saveCount.value = data.saveCount
    liked.value = data.liked
    saved.value = data.saved
    if (kind === 'save') showToast(data.saved ? 'Saved. Find it under Saved items.' : 'Removed from Saved items.', { icon: 'bookmark', tone: 'info', duration: 2200 })
    emit('change', data)
  } catch (e) {
    sync()
    showToast(errorMessage(e), { tone: 'danger', icon: 'x' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="th-react" :data-size="size" @click.stop.prevent>
    <button
      type="button"
      class="th-react-btn th-react-like"
      :class="{ 'is-on': liked }"
      :disabled="isOwner"
      :aria-pressed="liked"
      :aria-label="isOwner ? `${likeCount} likes` : liked ? 'Unlike' : 'Like'"
      :title="isOwner ? 'Likes on your listing' : liked ? 'Unlike' : 'Like'"
      @click="toggle('like')"
    >
      <span class="th-react-icon">
        <AppIcon name="heart" :size="size === 'lg' ? 22 : 17" />
        <span v-if="burst" :key="burst" class="th-react-burst" aria-hidden="true"><i v-for="n in 6" :key="n"></i></span>
      </span>
      <span class="th-react-count">{{ likeCount }}</span>
      <span v-if="size === 'lg'" class="th-react-label">{{ liked ? 'Liked' : 'Like' }}</span>
    </button>
    <button
      type="button"
      class="th-react-btn th-react-save"
      :class="{ 'is-on': saved }"
      :disabled="isOwner"
      :aria-pressed="saved"
      :aria-label="isOwner ? `${saveCount} saves` : saved ? 'Remove from saved' : 'Save'"
      :title="isOwner ? 'Saves on your listing' : saved ? 'Remove from saved' : 'Save for later'"
      @click="toggle('save')"
    >
      <span class="th-react-icon"><AppIcon name="bookmark" :size="size === 'lg' ? 22 : 17" /></span>
      <span class="th-react-count">{{ saveCount }}</span>
      <span v-if="size === 'lg'" class="th-react-label">{{ saved ? 'Saved' : 'Save' }}</span>
    </button>
  </div>
</template>

<style>
.th-react { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 4px; }
.th-react-btn {
  display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 8px; border: 0; border-radius: 999px;
  background: transparent; color: var(--ink-muted); font: 600 12px/1 var(--font-sans);
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.th-react-btn:not(:disabled):hover { background: var(--paper-sunk); color: var(--ink); }
.th-react-btn:not(:disabled):active { transform: scale(0.9); }
.th-react-btn:disabled { cursor: default; opacity: 0.85; }
.th-react-icon { position: relative; display: inline-flex; }
.th-react-count { font-variant-numeric: tabular-nums; min-width: 1ch; }
.th-react-like.is-on { color: #E0457B; }
.th-react-like.is-on svg { fill: currentColor; animation: th-heart-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1); }
.th-react-save.is-on { color: var(--emerald); }
.th-react-save.is-on svg { fill: currentColor; animation: th-heart-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes th-heart-pop { 0% { transform: scale(0.6); } 55% { transform: scale(1.3); } 100% { transform: scale(1); } }
/* Little burst around the heart when you like */
.th-react-burst { position: absolute; left: 50%; top: 50%; width: 0; height: 0; pointer-events: none; }
.th-react-burst i { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #E0457B; opacity: 0; animation: th-heart-burst 0.55s ease-out; }
.th-react-burst i:nth-child(even) { background: #C8F26A; }
.th-react-burst i:nth-child(1) { --a: 0deg; } .th-react-burst i:nth-child(2) { --a: 60deg; } .th-react-burst i:nth-child(3) { --a: 120deg; }
.th-react-burst i:nth-child(4) { --a: 180deg; } .th-react-burst i:nth-child(5) { --a: 240deg; } .th-react-burst i:nth-child(6) { --a: 300deg; }
@keyframes th-heart-burst { 0% { opacity: 1; transform: rotate(var(--a)) translateY(0); } 100% { opacity: 0; transform: rotate(var(--a)) translateY(-14px); } }

.th-react[data-size="lg"] { gap: 8px; }
.th-react[data-size="lg"] .th-react-btn { height: 44px; padding: 0 16px; border: 1.5px solid var(--line); background: var(--paper-raised); color: var(--ink); font-size: 14px; }
.th-react[data-size="lg"] .th-react-btn:not(:disabled):hover { border-color: var(--line-strong); }
.th-react[data-size="lg"] .th-react-like.is-on { border-color: #F3B6CB; background: #FDEDF3; color: #C2185B; }
.th-react[data-size="lg"] .th-react-save.is-on { border-color: var(--mint); background: var(--mint-soft); color: var(--emerald); }
.th-react[data-size="lg"] .th-react-count { color: inherit; opacity: 0.8; }
@media (prefers-reduced-motion: reduce) { .th-react-btn svg, .th-react-burst i { animation: none !important; } }
</style>
