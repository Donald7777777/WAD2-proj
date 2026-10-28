<script setup>
import { ref, computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { api, errorMessage } from '@/lib/api'
import { uploadImage, deleteImage } from '@/lib/storage'
import { showToast } from '@/lib/toast'
import { CATEGORIES } from '@/lib/constants'
import RatingSummary from '@/components/RatingSummary.vue'
import ReviewList from '@/components/ReviewList.vue'
import ListingCard from '@/components/ListingCard.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import AppIcon from '@/components/AppIcon.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import DashboardPanel from '@/components/DashboardPanel.vue'

// One profile page for everyone (/profile is yours, /users/:id is anyone's).
//   Everyone sees: picture, name, rating, stats, and the Listings and Reviews tabs.
//   Only you see:  your email, the picture/edit controls, and the private tabs
//                  Looking for (your wants), Liked and Saved.
// The tab is in the address (?tab=reviews), so links and notifications can open the right one.
const auth = useAuthStore()
const notes = useNotificationStore()
const route = useRoute()
const router = useRouter()

const userId = computed(() => (route.name === 'user' ? String(route.params.id) : auth.user?._id))
const isMe = computed(() => Boolean(auth.user) && userId.value === auth.user._id)
const showPrivate = computed(() => isMe.value)

const PUBLIC_TABS = ['listings', 'reviews']
const PRIVATE_TABS = ['dashboard', 'wants', 'liked', 'saved']
// Your own profile opens on your dashboard; everyone else's on their listings
const defaultTab = computed(() => (showPrivate.value ? 'dashboard' : 'listings'))
const tab = computed(() => {
  const asked = route.query.tab
  if (PUBLIC_TABS.includes(asked) || (showPrivate.value && PRIVATE_TABS.includes(asked))) return asked
  return defaultTab.value
})
function show(which) {
  router.replace({ query: which === defaultTab.value ? {} : { tab: which } })
}

// ---------- Data ----------
const profile = ref(null)
const liked = ref([])
const saved = ref([])
const loading = ref(true)
const loadError = ref('')
const memberSince = computed(() =>
  profile.value ? new Date(profile.value.memberSince).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }) : '',
)

async function loadProfile() {
  const { data } = await api.get(`/users/${userId.value}`)
  profile.value = data
}

async function load() {
  if (!userId.value) return
  loading.value = true
  loadError.value = ''
  profile.value = null
  try {
    if (isMe.value) {
      const [, likedResponse, savedResponse] = await Promise.all([
        loadProfile(),
        api.get('/listings/liked'),
        api.get('/listings/saved'),
      ])
      liked.value = likedResponse.data
      saved.value = savedResponse.data
    } else {
      await loadProfile()
    }
  } catch (e) {
    loadError.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
watch(userId, load, { immediate: true })

// A new review of you arrives while you're here: refresh the rating and the Reviews tab
watch(
  () => notes.reviewMoment,
  (review) => review && isMe.value && loadProfile().catch(() => {}),
)

// Un-liking / un-saving from your Liked or Saved tab takes the card away
function onReaction(listing, data) {
  if (!isMe.value) return
  if (!data.liked) liked.value = liked.value.filter((l) => l._id !== listing._id)
  if (!data.saved) saved.value = saved.value.filter((l) => l._id !== listing._id)
  if (data.liked && !liked.value.some((l) => l._id === listing._id)) liked.value = [listing, ...liked.value]
  if (data.saved && !saved.value.some((l) => l._id === listing._id)) saved.value = [listing, ...saved.value]
}

// What the active grid shows
const gridListings = computed(() => {
  if (tab.value === 'liked') return liked.value
  if (tab.value === 'saved') return saved.value
  return profile.value?.listings || []
})
const EMPTY = {
  listings: { icon: 'box', title: 'Nothing up for trade right now', text: 'Check back later.' },
  mine: { icon: 'box', title: "You haven't listed anything yet", text: 'List something you no longer use and start trading.' },
  liked: { icon: 'heart', title: "You haven't liked anything yet", text: 'Tap the heart on any listing and it shows up here.' },
  saved: { icon: 'bookmark', title: 'Nothing saved yet', text: 'Tap the bookmark on any listing and it shows up here.' },
}
const empty = computed(() => EMPTY[tab.value === 'listings' && isMe.value ? 'mine' : tab.value])

// ---------- Profile picture (you only) ----------
const fileInput = ref(null)
const uploading = ref(false)

async function onPhoto(event) {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  uploading.value = true
  try {
    const { path, url } = await uploadImage(file, 'avatars')
    const oldPath = await auth.saveAvatar(url, path)
    if (oldPath) deleteImage(oldPath).catch(() => {})
    showToast('Profile picture updated.', { icon: 'user' })
  } catch (e) {
    showToast(e.message || errorMessage(e), { tone: 'danger', icon: 'x' })
  } finally {
    uploading.value = false
  }
}

async function removePhoto() {
  try {
    const oldPath = await auth.saveAvatar('', '')
    if (oldPath) deleteImage(oldPath).catch(() => {})
    showToast('Profile picture removed.', { icon: 'user', tone: 'info' })
  } catch (e) {
    showToast(errorMessage(e), { tone: 'danger', icon: 'x' })
  }
}
// ---------- Report / block (someone else's profile) ----------
const reporting = ref(false)
async function toggleBlock() {
  const name = profile.value.name
  if (!profile.value.blockedByMe && !confirm(`Block ${name}? You won't see each other's listings, and any open proposals between you will be closed.`)) return
  try {
    const nowBlocked = await auth.toggleBlock(profile.value._id)
    showToast(nowBlocked ? `${name} is blocked.` : `${name} is unblocked.`, { icon: 'user', tone: 'info' })
    await loadProfile()
  } catch (e) {
    showToast(errorMessage(e), { tone: 'danger', icon: 'x' })
  }
}

const avatarSrc = computed(() => (isMe.value ? auth.user.avatarUrl : profile.value?.avatarUrl) || '')

// ---------- What you're looking for (you only) ----------
// Work on a copy so changes are only kept when the user clicks Save
const wants = ref([...(auth.user?.wants || [])])
const newWant = ref('')
const message = ref('')
const error = ref('')

function addWant(text) {
  const value = (text || newWant.value).trim()
  if (value && !wants.value.some((w) => w.toLowerCase() === value.toLowerCase())) {
    wants.value.push(value)
  }
  newWant.value = ''
}

function removeWant(index) {
  wants.value.splice(index, 1)
}

async function save() {
  message.value = ''
  error.value = ''
  try {
    await auth.saveWants(wants.value)
    message.value = 'Saved! Your matches on the Discover page are updated.'
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <div v-if="loadError" class="alert alert-danger">{{ loadError }}</div>

  <template v-if="profile">
    <!-- Header -->
    <header class="th-me-head">
      <!-- Your picture: click to change it -->
      <button
        v-if="showPrivate"
        type="button"
        class="th-avatar-edit"
        :class="{ 'is-busy': uploading }"
        :aria-label="avatarSrc ? 'Change profile picture' : 'Add a profile picture'"
        @click="fileInput.click()"
      >
        <UserAvatar :name="profile.name" :src="avatarSrc" you size="xl" />
        <span class="th-avatar-edit-badge"><AppIcon :name="uploading ? 'clock' : 'camera'" :size="16" /></span>
      </button>
      <span v-else class="th-me-avatar"><UserAvatar :name="profile.name" :src="avatarSrc" :you="isMe" size="xl" /></span>
      <input v-if="showPrivate" ref="fileInput" type="file" accept="image/*" class="visually-hidden" @change="onPhoto" />

      <div class="th-me-info">
        <span v-if="!isMe" class="eyebrow th-muted">Trader</span>
        <h1>{{ profile.name }}</h1>
        <p v-if="showPrivate" class="th-me-email" title="Only you can see your email">
          <AppIcon name="lock" :size="14" />{{ auth.user.email }}<span class="visually-hidden"> (only you can see this)</span>
        </p>
        <button type="button" class="th-me-rating" @click="show('reviews')">
          <RatingSummary :rating="profile.rating" :size="18" />
        </button>
        <!-- Trades, listings and member since: for other people (your own numbers are on your dashboard) -->
        <div v-if="!isMe" class="th-person-stats">
          <span><AppIcon name="swap" :size="16" />{{ profile.tradesCompleted }} trade{{ profile.tradesCompleted === 1 ? '' : 's' }} completed</span>
          <span><AppIcon name="box" :size="16" />{{ profile.listings.length }} up for trade</span>
          <span><AppIcon name="clock" :size="16" />Member since {{ memberSince }}</span>
        </div>
        <!-- Someone else: report or block them -->
        <div v-if="!isMe && auth.user && !profile.deleted" class="th-profile-actions">
          <button type="button" class="btn btn-sm btn-ghost th-quiet-danger" @click="reporting = true">
            <AppIcon name="flag" :size="16" />Report
          </button>
          <button type="button" class="btn btn-sm btn-ghost th-quiet-danger" @click="toggleBlock">
            <AppIcon name="x" :size="16" />{{ profile.blockedByMe ? 'Unblock' : 'Block' }}
          </button>
        </div>
      </div>

      <!-- Yours: settings top right -->
      <div v-if="showPrivate" class="th-me-head-actions">
        <RouterLink to="/account" class="btn btn-sm btn-outline-dark"><AppIcon name="lock" :size="16" />Account settings</RouterLink>
        <button v-if="avatarSrc" type="button" class="btn btn-sm btn-ghost" @click="removePhoto">Remove picture</button>
      </div>
    </header>

    <div v-if="profile.blockedByMe" class="th-blocked-banner" role="status">
      <AppIcon name="x" :size="18" />
      <span>You've blocked {{ profile.name }}. You won't see their listings, and you can't trade or message each other.</span>
      <button type="button" class="btn btn-sm btn-outline-dark" @click="toggleBlock">Unblock</button>
    </div>
    <ReportDialog v-if="reporting" type="user" :target-id="profile._id" :target-name="profile.name" @close="reporting = false" />

    <!-- Tabs: public ones first, then yours (only you see them) -->
    <div class="th-tabs th-me-tabs" role="tablist">
      <button v-if="showPrivate" type="button" role="tab" class="th-tab-btn th-tab-private" :aria-selected="tab === 'dashboard'" @click="show('dashboard')">
        <AppIcon name="home" :size="16" />Dashboard
      </button>
      <button type="button" role="tab" class="th-tab-btn" :aria-selected="tab === 'listings'" @click="show('listings')">
        <AppIcon name="box" :size="16" />Listings <span class="th-count">{{ profile.listings.length }}</span>
      </button>
      <button type="button" role="tab" class="th-tab-btn" :aria-selected="tab === 'reviews'" @click="show('reviews')">
        <AppIcon name="star" :size="16" />Reviews <span class="th-count">{{ profile.reviews.length }}</span>
      </button>
      <template v-if="showPrivate">
        <span class="th-me-tabs-split" aria-hidden="true"></span>
        <button type="button" role="tab" class="th-tab-btn th-tab-private" :aria-selected="tab === 'wants'" @click="show('wants')">
          <AppIcon name="search" :size="16" /><span class="d-none d-sm-inline">Looking for</span><span class="d-sm-none">Wants</span>
          <span class="th-count">{{ wants.length }}</span>
        </button>
        <button type="button" role="tab" class="th-tab-btn th-tab-private" :aria-selected="tab === 'liked'" @click="show('liked')">
          <AppIcon name="heart" :size="16" />Liked <span class="th-count">{{ liked.length }}</span>
        </button>
        <button type="button" role="tab" class="th-tab-btn th-tab-private" :aria-selected="tab === 'saved'" @click="show('saved')">
          <AppIcon name="bookmark" :size="16" />Saved <span class="th-count">{{ saved.length }}</span>
        </button>
      </template>
    </div>
    <p v-if="showPrivate && PRIVATE_TABS.includes(tab)" class="th-me-private-note">
      <AppIcon name="lock" :size="14" />Only you can see this tab.
    </p>

    <!-- Dashboard (you only): next meetup, what needs you, stats, this week, activity, matches -->
    <DashboardPanel v-if="tab === 'dashboard'" />

    <!-- Looking for (you only) -->
    <section v-else-if="tab === 'wants'" class="card th-panel th-me-wants">
      <h2>What are you looking for?</h2>
      <p class="th-muted">
        Add categories or keywords (e.g. "film lens", "turntable"). We use these to find matches for you.
      </p>

      <form class="th-search th-search-sm mb-3" @submit.prevent="addWant()">
        <AppIcon name="search" />
        <input v-model="newWant" placeholder="Add a keyword" aria-label="Add a keyword" />
        <button class="btn btn-primary btn-sm" type="submit">Add</button>
      </form>

      <div class="mb-2"><span class="eyebrow th-muted">Quick add</span></div>
      <div class="th-chips th-me-quick mb-4">
        <button v-for="c in CATEGORIES" :key="c" type="button" class="th-chip" @click="addWant(c)">
          <AppIcon name="plus" :size="16" />{{ c }}
        </button>
      </div>

      <div class="mb-2"><span class="eyebrow th-muted">Your wants</span></div>
      <div class="th-wants mb-4">
        <p v-if="wants.length === 0" class="th-muted small mb-0">Nothing added yet.</p>
        <span v-for="(want, index) in wants" :key="want" class="th-want">
          {{ want }}
          <button type="button" :aria-label="`Remove ${want}`" @click="removeWant(index)">
            <AppIcon name="x" :size="14" />
          </button>
        </span>
      </div>

      <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>
      <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
      <div>
        <button class="btn btn-primary" @click="save">Save wants</button>
      </div>
    </section>

    <!-- Reviews (everyone) -->
    <ReviewList
      v-else-if="tab === 'reviews'"
      :reviews="profile.reviews"
      :rating="profile.rating"
      :empty-text="isMe ? 'After a completed trade, the other trader can rate you. Their reviews show up here.' : 'Reviews appear here after completed trades.'"
    />

    <!-- Listings (everyone), Liked / Saved (you only) -->
    <section v-else>
      <div v-if="isMe && tab === 'listings' && profile.listings.length" class="th-me-grid-head">
        <RouterLink to="/my-listings" class="th-tlink-manage"><AppIcon name="edit" :size="15" />Manage my listings</RouterLink>
      </div>
      <div v-if="!gridListings.length" class="th-empty">
        <AppIcon :name="empty.icon" :size="28" />
        <strong>{{ empty.title }}</strong>
        <p>{{ empty.text }}</p>
        <RouterLink v-if="tab === 'listings' && isMe" to="/listings/new" class="btn btn-offer btn-sm mt-2">List an item</RouterLink>
        <RouterLink v-else-if="tab !== 'listings'" to="/discover" class="btn btn-primary btn-sm mt-2">Browse listings</RouterLink>
      </div>
      <TransitionGroup v-else :key="tab" name="th-photo" tag="div" class="th-grid">
        <div v-for="(listing, index) in gridListings" :key="listing._id" v-reveal="index">
          <ListingCard :listing="listing" @reaction="onReaction(listing, $event)" />
        </div>
      </TransitionGroup>
    </section>
  </template>

  <!-- Loading -->
  <div v-else-if="loading" class="th-me-head" aria-label="Loading">
    <div class="th-skeleton" style="width: 112px; height: 112px; aspect-ratio: 1; border-radius: 50%"></div>
    <div class="th-skeleton" style="width: min(320px, 60vw); height: 64px; aspect-ratio: auto"></div>
  </div>
</template>

<style>
.th-me-head { display: flex; align-items: center; gap: 24px; margin-bottom: 20px; }
.th-me-avatar { flex: none; }
.th-me-avatar .th-avatar { box-shadow: 0 0 0 4px var(--paper), 0 0 0 6px var(--mint); }
.th-me-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.th-me-info h1 { margin: 0; font-size: 34px; line-height: 40px; font-weight: 750; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.th-me-email { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 0; color: var(--ink-muted); font-size: 14px; overflow-wrap: anywhere; }
.th-me-rating { align-self: flex-start; padding: 2px 8px 2px 0; border: 0; background: none; border-radius: 999px; color: var(--ink); text-align: left; }
.th-me-rating:hover .th-muted { text-decoration: underline; }
.th-profile-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }

.th-me-info { flex: 1; }
.th-me-head-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; align-self: flex-start; margin-left: auto; }

.th-me-tabs { overflow-x: auto; scrollbar-width: none; margin-bottom: 14px; }
.th-me-tabs::-webkit-scrollbar { display: none; }
.th-me-tabs .th-tab-btn { white-space: nowrap; flex: none; }
.th-me-tabs-split { flex: none; width: 1px; margin: 10px 6px; background: var(--line-strong); }
.th-tab-private[aria-selected="true"] { border-bottom-color: var(--lime-ink); }
.th-me-private-note { display: flex; align-items: center; gap: 6px; margin: -4px 0 14px; color: var(--ink-muted); font-size: 13px; }
.th-me-wants { max-width: 1100px; }
.th-me-grid-head { display: flex; justify-content: flex-end; margin: -6px 0 10px; }
.th-tlink-manage { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: var(--ink); }

.th-avatar-edit { position: relative; flex: none; padding: 0; border: 0; background: none; border-radius: 50%; cursor: pointer; }
.th-avatar-edit .th-avatar { box-shadow: 0 0 0 4px var(--paper), 0 0 0 6px var(--lime); transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
.th-avatar-edit:hover .th-avatar { transform: scale(1.04); }
.th-avatar-edit.is-busy .th-avatar { opacity: 0.6; }
.th-avatar-edit-badge {
  position: absolute; right: 2px; bottom: 2px; display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center;
  border-radius: 50%; background: var(--ink); color: var(--on-ink); box-shadow: 0 0 0 3px var(--paper);
}

/* Phones: picture beside a smaller name, and the tabs share the width */
@media (max-width: 575.98px) {
  .th-me-head { align-items: flex-start; gap: 14px; }
  .th-me-head .th-avatar-xl { width: 76px; height: 76px; font-size: 26px; }
  .th-avatar-edit-badge { width: 28px; height: 28px; right: -2px; bottom: -2px; }
  .th-me-info h1 { font-size: 26px; line-height: 32px; }
  .th-me-head { flex-wrap: wrap; }
  .th-me-head-actions { width: 100%; justify-content: flex-start; margin-left: 0; }
  .th-me-tabs { gap: 0; }
  .th-me-tabs .th-tab-btn { padding: 10px 8px; gap: 4px; font-size: 13px; }
  .th-me-tabs .th-tab-btn > .th-icon { display: none; }
  .th-me-tabs .th-count { min-width: 18px; padding: 0 5px; font-size: 10px; }
  .th-me-tabs-split { margin: 10px 2px; }
  .th-me-wants { padding: var(--space-4); }
}
</style>
