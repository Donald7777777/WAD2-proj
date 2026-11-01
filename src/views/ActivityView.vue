<script setup>
import { ref, computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import { useNotificationStore } from '@/stores/notifications'
import UserAvatar from '@/components/UserAvatar.vue'
import AppIcon from '@/components/AppIcon.vue'

// Who liked or saved your listings, newest first (like Instagram's activity).
// Wide screens: the feed on the left, totals and your most-loved listings on the right.
// Smaller screens: the totals and ranking sit above the feed.
const route = useRoute()
const router = useRouter()
const rows = ref([])
const loading = ref(true)
const error = ref('')

const kind = computed(() => (['like', 'save'].includes(route.query.kind) ? route.query.kind : ''))
const listingId = computed(() => route.query.listing || '')
const listingTitle = computed(() => rows.value.find((r) => r.listing._id === listingId.value)?.listing.title)

// Everything is loaded once; the listing and like/save filters are applied here
const forListing = computed(() =>
  listingId.value ? rows.value.filter((r) => r.listing._id === listingId.value) : rows.value,
)
const likeCount = computed(() => forListing.value.filter((r) => r.kind === 'like').length)
const saveCount = computed(() => forListing.value.filter((r) => r.kind === 'save').length)
const shown = computed(() => (kind.value ? forListing.value.filter((r) => r.kind === kind.value) : forListing.value))

// Side panel: totals, and your listings ranked by likes + saves
const totals = computed(() => ({
  likes: rows.value.filter((r) => r.kind === 'like').length,
  saves: rows.value.filter((r) => r.kind === 'save').length,
  people: new Set(rows.value.map((r) => r.user._id)).size,
}))
const topListings = computed(() => {
  const byId = new Map()
  for (const row of rows.value) {
    const entry = byId.get(row.listing._id) || { listing: row.listing, likes: 0, saves: 0 }
    entry[row.kind === 'like' ? 'likes' : 'saves']++
    byId.set(row.listing._id, entry)
  }
  return [...byId.values()].sort((a, b) => b.likes + b.saves - (a.likes + a.saves)).slice(0, 6)
})

// Group by day: Today / Yesterday / This week / Earlier
const groups = computed(() => {
  const day = 86400000
  const start = new Date().setHours(0, 0, 0, 0)
  const label = (d) => {
    const t = new Date(d).getTime()
    if (t >= start) return 'Today'
    if (t >= start - day) return 'Yesterday'
    if (t >= start - 6 * day) return 'This week'
    return 'Earlier'
  }
  const out = []
  for (const row of shown.value) {
    const name = label(row.createdAt)
    if (!out.length || out.at(-1).name !== name) out.push({ name, rows: [] })
    out.at(-1).rows.push(row)
  }
  return out
})

function ago(date) {
  const s = (Date.now() - new Date(date).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

async function load() {
  try {
    const { data } = await api.get('/activity')
    rows.value = data
    error.value = ''
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
load()

// Opening this page clears the dot on the Likes tab; a new like while you're here refreshes the feed
const notes = useNotificationStore()
notes.clearNewLikes()
watch(
  () => notes.newLikes,
  (n) => {
    if (!n) return
    notes.clearNewLikes()
    load()
  },
)

function setKind(value) {
  router.replace({ query: { ...route.query, kind: value || undefined } })
}
function clearListing() {
  router.replace({ query: { kind: kind.value || undefined } })
}
// Tap a listing in the ranking to see only its activity (tap again to show all)
function pickListing(id) {
  router.replace({ query: { ...route.query, listing: id === listingId.value ? undefined : id } })
}
</script>

<template>
  <div class="th-page-head">
    <div>
      <h1>Likes on my listings</h1>
      <p>See who has liked and saved the things you're trading.</p>
    </div>
  </div>

  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <div class="th-activity-layout" :class="{ 'has-side': !loading && rows.length }">
    <!-- Totals and most-loved listings -->
    <aside v-if="!loading && rows.length" class="th-activity-side">
      <div class="card th-activity-totals">
        <div><b>{{ totals.likes }}</b><span><AppIcon name="heart" :size="14" />Likes</span></div>
        <div><b>{{ totals.saves }}</b><span><AppIcon name="bookmark" :size="14" />Saves</span></div>
        <div><b>{{ totals.people }}</b><span><AppIcon name="user" :size="14" />People</span></div>
      </div>
      <div class="card th-activity-top">
        <h2>Your most-loved listings</h2>
        <div class="th-activity-top-list">
          <button
            v-for="(entry, i) in topListings"
            :key="entry.listing._id"
            type="button"
            class="th-activity-top-row"
            :class="{ 'is-active': entry.listing._id === listingId }"
            :aria-pressed="entry.listing._id === listingId"
            @click="pickListing(entry.listing._id)"
          >
            <span class="th-activity-rank">{{ i + 1 }}</span>
            <span class="th-activity-thumb">
              <img v-if="entry.listing.imageUrl" :src="entry.listing.imageUrl" alt="" loading="lazy" />
              <AppIcon v-else name="image" :size="18" />
            </span>
            <span class="th-activity-top-text">
              <span class="th-activity-top-title">{{ entry.listing.title }}</span>
              <span class="th-activity-top-counts">
                <span><AppIcon name="heart" :size="13" />{{ entry.likes }} like{{ entry.likes === 1 ? '' : 's' }}</span>
                <span><AppIcon name="bookmark" :size="13" />{{ entry.saves }} save{{ entry.saves === 1 ? '' : 's' }}</span>
              </span>
            </span>
          </button>
        </div>
      </div>
    </aside>

    <!-- The feed -->
    <div class="th-activity-main">
      <div v-if="listingId" class="th-activity-filter">
        Showing activity for <b>{{ listingTitle || 'one listing' }}</b>
        <button type="button" class="btn btn-ghost btn-sm" @click="clearListing"><AppIcon name="x" :size="14" />Show all listings</button>
      </div>

      <div class="th-chips mb-3" role="group" aria-label="Filter">
        <button type="button" class="th-chip" :aria-pressed="!kind" @click="setKind('')">All <span class="th-count">{{ forListing.length }}</span></button>
        <button type="button" class="th-chip" :aria-pressed="kind === 'like'" @click="setKind('like')">
          <AppIcon name="heart" :size="15" />Likes <span class="th-count">{{ likeCount }}</span>
        </button>
        <button type="button" class="th-chip" :aria-pressed="kind === 'save'" @click="setKind('save')">
          <AppIcon name="bookmark" :size="15" />Saves <span class="th-count">{{ saveCount }}</span>
        </button>
      </div>

      <div v-if="loading" class="th-activity"><div v-for="n in 4" :key="n" class="th-skeleton" style="aspect-ratio: auto; height: 64px"></div></div>
      <div v-else-if="!shown.length" class="th-empty">
        <AppIcon name="heart" :size="28" />
        <strong>No {{ kind === 'save' ? 'saves' : kind === 'like' ? 'likes' : 'activity' }} yet</strong>
        <p>When someone likes or saves one of your listings, you'll see it here.</p>
      </div>

      <div v-else class="th-activity">
        <section v-for="group in groups" :key="group.name">
          <h2 class="th-activity-day">{{ group.name }}</h2>
          <div v-for="(row, i) in group.rows" :key="row._id" v-reveal="i" class="th-activity-row">
            <RouterLink :to="`/users/${row.user._id}`" class="th-activity-who">
              <UserAvatar :name="row.user.name" :src="row.user.avatarUrl" size="lg" />
              <span class="th-activity-badge" :data-kind="row.kind"><AppIcon :name="row.kind === 'like' ? 'heart' : 'bookmark'" :size="11" /></span>
            </RouterLink>
            <p class="th-activity-text">
              <RouterLink :to="`/users/${row.user._id}`" class="th-activity-name">{{ row.user.name }}</RouterLink>
              {{ row.kind === 'like' ? 'liked' : 'saved' }} your
              <RouterLink :to="`/listings/${row.listing._id}`" class="th-activity-item">{{ row.listing.title }}</RouterLink>
              <time class="th-muted">{{ ago(row.createdAt) }}</time>
            </p>
            <RouterLink :to="`/listings/${row.listing._id}`" class="th-activity-thumb th-activity-photo" :aria-label="row.listing.title">
              <img v-if="row.listing.imageUrl" :src="row.listing.imageUrl" alt="" loading="lazy" />
              <AppIcon v-else name="image" :size="18" />
            </RouterLink>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style>
/* Feed and side panel share the full width; the panel is on the right from 992px.
   With no likes yet there's no panel, so the feed (or the empty message) takes the whole row. */
.th-activity-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
@media (min-width: 992px) {
  .th-activity-layout.has-side { grid-template-columns: minmax(0, 1fr) 340px; gap: 28px; }
  .th-activity-side { order: 2; position: sticky; top: 88px; }
}
@media (min-width: 1400px) { .th-activity-layout.has-side { grid-template-columns: minmax(0, 1fr) 400px; } }
.th-activity-main { min-width: 0; }
.th-activity-side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

.th-activity { display: flex; flex-direction: column; gap: 6px; }
.th-activity-day { margin: 14px 0 6px; font-size: 15px; font-weight: 700; }
.th-activity-row {
  display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: var(--radius-md); background: var(--paper-raised);
  border: 1px solid var(--line); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
}
.th-activity-row:hover { transform: translateY(-1px); box-shadow: var(--shadow-card); }
.th-activity-who { position: relative; flex: none; }
.th-activity-badge {
  position: absolute; right: -4px; bottom: -4px; display: inline-flex; width: 20px; height: 20px; align-items: center; justify-content: center;
  border-radius: 50%; color: #fff; box-shadow: 0 0 0 2px var(--paper-raised);
}
.th-activity-badge[data-kind="like"] { background: #E0457B; }
.th-activity-badge[data-kind="save"] { background: var(--emerald); }
.th-activity-badge svg { fill: currentColor; }
.th-activity-text { flex: 1; margin: 0; font-size: 15px; line-height: 21px; min-width: 0; }
.th-activity-name, .th-activity-item { color: var(--ink); font-weight: 700; text-decoration: none; }
.th-activity-name:hover, .th-activity-item:hover { color: var(--ink); text-decoration: underline; }
.th-activity-text time { margin-left: 6px; font-size: 12px; }
.th-activity-thumb {
  flex: none; width: 48px; height: 48px; border-radius: var(--radius-sm); overflow: hidden; background: var(--paper-sunk);
  display: inline-flex; align-items: center; justify-content: center; color: var(--ink-muted);
}
.th-activity-thumb img { width: 100%; height: 100%; object-fit: cover; }
.th-activity-photo { width: 60px; height: 60px; }
.th-activity-filter { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; margin-bottom: 12px; border-radius: var(--radius-md); background: var(--mint-soft); font-size: 14px; }

/* Totals */
.th-activity-totals { display: grid; grid-template-columns: repeat(3, 1fr); padding: 14px 8px; text-align: center; }
.th-activity-totals div { display: flex; flex-direction: column; gap: 2px; }
.th-activity-totals div + div { border-left: 1px solid var(--line); }
.th-activity-totals b { font: 750 26px/1.1 var(--font-display); }
.th-activity-totals span { display: inline-flex; align-items: center; justify-content: center; gap: 4px; color: var(--ink-muted); font-size: 12px; font-weight: 600; }

/* Most-loved listings */
.th-activity-top { padding: 14px; }
.th-activity-top h2 { margin: 0 0 8px; font-size: 15px; font-weight: 700; }
.th-activity-top-list { display: flex; flex-direction: column; gap: 2px; }
.th-activity-top-row {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px; border: 0; border-radius: var(--radius-sm);
  background: none; color: var(--ink); text-align: left; transition: background 0.2s ease;
}
.th-activity-top-row:hover { background: var(--paper-sunk); }
.th-activity-top-row.is-active { background: var(--mint-soft); box-shadow: inset 0 0 0 1.5px var(--mint); }
.th-activity-rank { flex: none; width: 18px; color: var(--ink-muted); font: 600 12px/1 var(--font-mono); }
.th-activity-top-row .th-activity-thumb { width: 40px; height: 40px; }
.th-activity-top-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.th-activity-top-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-activity-top-counts { display: flex; gap: 10px; color: var(--ink-muted); font-size: 12px; font-weight: 600; }
.th-activity-top-counts span { display: inline-flex; align-items: center; gap: 3px; }

/* Tablets: totals and ranking side by side above the feed; the ranking scrolls sideways */
@media (min-width: 576px) and (max-width: 991.98px) {
  .th-activity-side { display: grid; grid-template-columns: 260px minmax(0, 1fr); align-items: stretch; }
  .th-activity-totals { align-content: center; }
}
@media (max-width: 991.98px) {
  .th-activity-top-list { flex-direction: row; overflow-x: auto; gap: 8px; scrollbar-width: thin; padding-bottom: 2px; }
  .th-activity-top-row { flex: none; width: 240px; background: var(--paper-sunk); }
}
/* Phones */
@media (max-width: 575.98px) {
  .th-activity-text { font-size: 13px; line-height: 19px; }
  .th-activity-row { padding: 8px 10px; gap: 10px; }
  .th-activity-row .th-avatar-lg { width: 44px; height: 44px; font-size: 16px; }
  .th-activity-photo { width: 46px; height: 46px; }
  .th-activity-top-row { width: 220px; }
  .th-activity-totals b { font-size: 22px; }
}
</style>
