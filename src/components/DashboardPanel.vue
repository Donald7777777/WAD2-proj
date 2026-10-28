<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'
import { api, errorMessage } from '@/lib/api'
import { formatMeetup, placeName } from '@/lib/format'
import { isOpen, iAmProposer, otherUser, sides, myStep, meetupAt, countdown } from '@/lib/trades'
import UserAvatar from './UserAvatar.vue'
import StarRating from './StarRating.vue'
import MeetupMap from './MeetupMap.vue'
import AppIcon from './AppIcon.vue'

// Your dashboard (the first tab on your own profile), laid out as two rows:
//   [ Next meetup        | Stats 2×2 ]
//   [ Needs your action  | This week ]
// On phones it's one column: Next meetup, Stats, Needs your action, This week.
const auth = useAuthStore()
const notes = useNotificationStore()
const me = computed(() => auth.user._id)

const trades = ref([])
const profile = ref(null)
const loading = ref(true)
const error = ref('')

async function load() {
  try {
    const [t, p] = await Promise.allSettled([api.get('/trades'), api.get(`/users/${me.value}`)])
    if (t.status === 'fulfilled') trades.value = t.value.data
    else error.value = errorMessage(t.reason)
    if (p.status === 'fulfilled') profile.value = p.value.data
  } finally {
    loading.value = false
  }
}
onMounted(load)
// Something new happened: refresh (at most every couple of seconds)
let refreshTimer = null
watch(
  () => notes.ringKey,
  () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(load, 1500)
  },
)

// A clock for the countdown
const now = ref(new Date())
const clock = setInterval(() => (now.value = new Date()), 30000)
onUnmounted(() => {
  clearInterval(clock)
  clearTimeout(refreshTimer)
})

// ---------- Meetups ----------
const accepted = computed(() => trades.value.filter((t) => t.status === 'accepted'))
// Upcoming (or just started, within the last 2 hours), soonest first
const upcoming = computed(() =>
  accepted.value
    .map((t) => ({ trade: t, at: meetupAt(t) }))
    .filter((x) => x.at && x.at.getTime() > now.value.getTime() - 2 * 3600000)
    .sort((a, b) => a.at - b.at),
)
const next = computed(() => upcoming.value[0] || null)
const nextOther = computed(() => (next.value ? otherUser(next.value.trade, me.value) : null))
const nextCountdown = computed(() => (next.value ? countdown(next.value.at, now.value) : ''))
const nextSoon = computed(() => next.value && next.value.at - now.value < 24 * 3600000)
const checklistProgress = computed(() => {
  if (!next.value) return null
  const t = next.value.trade
  const key = iAmProposer(t, me.value) ? 'proposerChecked' : 'receiverChecked'
  const total = t.checklist?.length || 0
  return { done: (t.checklist || []).filter((c) => c[key]).length, total }
})
const directions = (m) => `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`
// Accepted trades still without a meetup
const noMeetup = computed(() => accepted.value.filter((t) => !t.meetup?.name))

// The next 7 days, with any meetups on each
const week = computed(() => {
  const start = new Date(now.value.getFullYear(), now.value.getMonth(), now.value.getDate())
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const meetups = upcoming.value.filter((x) => x.at.toDateString() === day.toDateString())
    return {
      key: day.toDateString(),
      name: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : day.toLocaleDateString('en-SG', { weekday: 'short' }),
      date: day.getDate(),
      meetups,
    }
  })
})
const weekMeetups = computed(() => week.value.flatMap((d) => d.meetups))
const timeOf = (at) =>
  `${at.toLocaleDateString('en-SG', { weekday: 'short' })} ${at.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`

// ---------- What needs you ----------
// Trade steps that are on you (reply, pick a meetup, tick the checklist, confirm)
const steps = computed(() =>
  trades.value
    .map((t) => ({ t, step: myStep(t, me.value) }))
    .filter((x) => x.step)
    .map(({ t, step }) => ({ id: t._id, to: `/trades/${t._id}`, who: otherUser(t, me.value), step, items: sides(t, me.value).theirs, unread: t.unread })),
)
// Completed trades you haven't rated yet: grouped into one row
const toRate = computed(() =>
  trades.value
    .filter((t) => t.status === 'completed' && t.reviewedByMe === false)
    .map((t) => ({ id: t._id, to: `/trades/${t._id}`, who: otherUser(t, me.value), items: sides(t, me.value).theirs })),
)
const rateOpen = ref(false)
const rateNames = computed(() => [...new Set(toRate.value.map((r) => r.who?.name).filter(Boolean))].join(', '))
const actionCount = computed(() => steps.value.length + toRate.value.length)

// ---------- Stats ----------
const openOffers = computed(() => trades.value.filter(isOpen).length)
const competing = computed(() => trades.value.filter((t) => isOpen(t) || t.status === 'accepted').reduce((n, t) => n + (t.competing || 0), 0))
const unreadTotal = computed(() => trades.value.reduce((n, t) => n + (t.unread || 0), 0))
const unreadChats = computed(() => trades.value.filter((t) => t.unread).length)
</script>

<template>
  <div v-if="error" class="alert alert-danger">{{ error }}</div>

  <div class="th-dash" :class="{ 'no-meetup': !loading && !next }">
    <!-- Next meetup -->
    <section class="card th-dash-card th-dash-next" :class="{ 'is-soon': nextSoon }" aria-labelledby="dash-next">
      <div class="th-dash-card-head">
        <h2 id="dash-next"><AppIcon name="pin" :size="18" />Next meetup</h2>
        <RouterLink v-if="next" :to="`/trades/${next.trade._id}`" class="th-link small">Open trade</RouterLink>
      </div>
      <div v-if="loading" class="th-skeleton" style="aspect-ratio: auto; height: 220px"></div>
      <div v-else-if="next" class="th-next">
        <div class="th-next-map"><MeetupMap mode="view" :selected="next.trade.meetup" /></div>
        <div class="th-next-info">
          <span class="th-next-countdown" :class="{ 'is-now': nextCountdown === 'now' || nextCountdown.endsWith('ago') }">
            <AppIcon name="clock" :size="16" />{{ nextCountdown === 'now' ? 'Happening now' : nextCountdown }}
          </span>
          <h3>{{ placeName(next.trade.meetup.name) }}</h3>
          <p class="th-muted mb-1">{{ formatMeetup(next.trade.meetup.date, next.trade.meetup.time) }}</p>
          <div class="th-next-who">
            <UserAvatar :name="nextOther?.name || ''" :src="nextOther?.avatarUrl" size="sm" />
            <span>with <b>{{ nextOther?.name }}</b>: you give {{ sides(next.trade, me).mine.map((l) => l.title).join(', ') }}</span>
          </div>
          <div v-if="checklistProgress?.total" class="th-next-check">
            <span>Your checklist</span>
            <span class="th-next-bar"><span :style="{ width: `${(checklistProgress.done / checklistProgress.total) * 100}%` }"></span></span>
            <span class="data">{{ checklistProgress.done }}/{{ checklistProgress.total }}</span>
          </div>
          <div class="th-next-actions">
            <a :href="directions(next.trade.meetup)" target="_blank" rel="noopener" class="btn btn-offer btn-sm"><AppIcon name="pin" :size="16" />Get directions</a>
            <RouterLink :to="`/trades/${next.trade._id}`" class="btn btn-ghost btn-sm">Checklist and chat</RouterLink>
          </div>
        </div>
      </div>
      <!-- No meetup: one short line instead of a big empty card -->
      <p v-else class="th-next-none">
        <template v-if="noMeetup.length">
          {{ noMeetup.length }} accepted trade{{ noMeetup.length === 1 ? '' : 's' }} still need{{ noMeetup.length === 1 ? 's' : '' }} a meetup.
          <RouterLink :to="`/trades/${noMeetup[0]._id}`">Pick one</RouterLink>
        </template>
        <template v-else>No meetups coming up. <RouterLink to="/discover">Browse Discover</RouterLink></template>
      </p>
    </section>

    <!-- Stats: 2 × 2 -->
    <section class="th-dash-stats" aria-label="Your numbers">
      <RouterLink to="/profile?tab=reviews" class="card th-stat">
        <span class="th-stat-label">Your rating</span>
        <b>{{ profile?.rating.count ? profile.rating.average.toFixed(1) : '—' }}</b>
        <StarRating v-if="profile?.rating.count" :model-value="profile.rating.average" :size="14" />
        <small v-else class="th-muted">No reviews yet</small>
      </RouterLink>
      <RouterLink to="/trades" class="card th-stat">
        <span class="th-stat-label">Trades completed</span>
        <b>{{ profile?.tradesCompleted ?? '—' }}</b>
        <small class="th-muted">{{ accepted.length }} in progress</small>
      </RouterLink>
      <RouterLink to="/trades" class="card th-stat">
        <span class="th-stat-label">Open offers</span>
        <b>{{ openOffers }}</b>
        <small :class="competing ? 'th-stat-warn' : 'th-muted'">{{ competing ? `${competing} competing` : 'No competition' }}</small>
      </RouterLink>
      <RouterLink to="/trades" class="card th-stat">
        <span class="th-stat-label">Unread messages</span>
        <b>{{ unreadTotal }}</b>
        <small class="th-muted">{{ unreadChats ? `in ${unreadChats} trade${unreadChats === 1 ? '' : 's'}` : 'All caught up' }}</small>
      </RouterLink>
    </section>

    <!-- Needs your action -->
    <section class="card th-dash-card th-dash-actions" aria-labelledby="dash-actions">
      <div class="th-dash-card-head">
        <h2 id="dash-actions"><AppIcon name="alert" :size="18" />Needs your action <span v-if="actionCount" class="th-count">{{ actionCount }}</span></h2>
        <RouterLink to="/trades" class="th-link small">All trades</RouterLink>
      </div>
      <div v-if="loading" class="th-skeleton" style="aspect-ratio: auto; height: 120px"></div>
      <div v-else-if="!actionCount" class="th-dash-empty">
        <AppIcon name="check" :size="26" />
        <strong>Nothing waiting on you</strong>
        <p>Offers to answer, meetups to pick and reviews to leave will show up here.</p>
      </div>
      <ul v-else class="th-dash-list">
        <li v-for="a in steps.slice(0, 5)" :key="a.id">
          <RouterLink :to="a.to" class="th-dash-row">
            <UserAvatar :name="a.who?.name || ''" :src="a.who?.avatarUrl" />
            <span class="th-dash-row-text">
              <b>{{ a.step }}</b>
              <span class="th-muted small">{{ a.who?.name }} · {{ a.items.map((l) => l.title).join(', ') }}</span>
            </span>
            <span v-if="a.unread" class="th-trade-flag th-flag-unread"><AppIcon name="chat" :size="12" />{{ a.unread }}</span>
            <AppIcon name="chevron" :size="16" class="th-muted" />
          </RouterLink>
        </li>

        <!-- One review left: a normal row -->
        <li v-if="toRate.length === 1">
          <RouterLink :to="toRate[0].to" class="th-dash-row">
            <span class="th-dash-icon th-dash-star"><AppIcon name="star" :size="16" /></span>
            <span class="th-dash-row-text">
              <b>Rate {{ toRate[0].who?.name || 'them' }}</b>
              <span class="th-muted small">{{ toRate[0].items.map((l) => l.title).join(', ') }}</span>
            </span>
            <AppIcon name="chevron" :size="16" class="th-muted" />
          </RouterLink>
        </li>
        <!-- Several: one row that opens the list -->
        <li v-else-if="toRate.length > 1">
          <button type="button" class="th-dash-row" :aria-expanded="rateOpen" @click="rateOpen = !rateOpen">
            <span class="th-dash-icon th-dash-star"><AppIcon name="star" :size="16" /></span>
            <span class="th-dash-row-text">
              <b>Rate {{ toRate.length }} traders</b>
              <span class="th-muted small">{{ rateNames }}</span>
            </span>
            <AppIcon name="chevron" :size="16" class="th-muted th-dash-caret" :class="{ 'is-open': rateOpen }" />
          </button>
          <ul v-if="rateOpen" class="th-dash-sublist">
            <li v-for="r in toRate" :key="r.id">
              <RouterLink :to="r.to" class="th-dash-row">
                <UserAvatar :name="r.who?.name || ''" :src="r.who?.avatarUrl" size="sm" />
                <span class="th-dash-row-text">
                  <b>{{ r.who?.name }}</b>
                  <span class="th-muted small">{{ r.items.map((l) => l.title).join(', ') }}</span>
                </span>
                <span class="th-dash-rate">Rate</span>
              </RouterLink>
            </li>
          </ul>
        </li>
      </ul>
      <RouterLink v-if="steps.length > 5" to="/trades" class="th-link small th-dash-more">See {{ steps.length - 5 }} more</RouterLink>
    </section>

    <!-- This week -->
    <section class="card th-dash-card th-dash-week" aria-labelledby="dash-week">
      <div class="th-dash-card-head"><h2 id="dash-week"><AppIcon name="clock" :size="18" />This week</h2></div>
      <div class="th-week">
        <div v-for="d in week" :key="d.key" class="th-week-day" :class="{ 'has-meetup': d.meetups.length, 'is-today': d.name === 'Today' }">
          <span>{{ d.name }}</span>
          <b>{{ d.date }}</b>
          <i v-for="m in d.meetups" :key="m.trade._id"></i>
        </div>
      </div>
      <ul v-if="weekMeetups.length" class="th-week-list">
        <li v-for="m in weekMeetups" :key="m.trade._id">
          <RouterLink :to="`/trades/${m.trade._id}`">
            <span class="data">{{ timeOf(m.at) }}</span>
            <span>{{ placeName(m.trade.meetup.name) }} <span class="th-muted">with {{ otherUser(m.trade, me)?.name }}</span></span>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="th-muted small mb-0 px-1">No meetups in the next 7 days.</p>
    </section>
  </div>
</template>

<style>
/* Two rows on wide screens: [next | stats] then [actions | week]. Cards in a row share a height. */
.th-dash { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
@media (min-width: 992px) {
  .th-dash {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    grid-template-areas:
      'next stats'
      'actions week';
  }
  .th-dash-next { grid-area: next; }
  .th-dash-stats { grid-area: stats; }
  .th-dash-actions { grid-area: actions; }
  .th-dash-week { grid-area: week; }
  /* No meetup: the short "no meetups" line spans the top, and the rest moves up */
  .th-dash.no-meetup {
    grid-template-areas:
      'next next'
      'actions stats'
      'actions week';
    grid-template-rows: auto auto 1fr;
  }
}
.th-dash-card { padding: 16px; }
.th-dash-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.th-dash-card-head h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 17px; font-weight: 750; }
.th-dash-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 22px 12px; text-align: center; color: var(--ink-muted); }
.th-dash-empty strong { color: var(--ink); }
.th-dash-empty p { margin: 0; max-width: 40ch; font-size: 14px; }

/* Next meetup */
.th-dash-next.is-soon { box-shadow: 0 0 0 2px var(--lime), var(--shadow-card); }
.th-next { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
@media (min-width: 640px) { .th-next { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: center; } }
.th-next-map .th-livemap, .th-next-map .th-map { height: 220px; }
.th-next-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.th-next-info h3 { margin: 4px 0 0; font-size: 22px; font-weight: 750; }
.th-next-countdown {
  display: inline-flex; align-self: flex-start; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px;
  background: var(--lime-soft); color: var(--lime-ink); font-weight: 800; font-size: 14px;
}
.th-next-countdown.is-now { background: var(--brick); color: #fff; animation: th-pulse-soft 1.6s ease infinite; }
@keyframes th-pulse-soft { 50% { opacity: 0.75; } }
.th-next-who { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.th-next-check { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-muted); }
.th-next-bar { height: 6px; border-radius: 999px; background: var(--paper-sunk); overflow: hidden; }
.th-next-bar span { display: block; height: 100%; border-radius: inherit; background: var(--emerald); transition: width 0.4s ease; }
.th-next-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.th-next-none { margin: 0; color: var(--ink-muted); font-size: 14px; }
.th-next-none a { font-weight: 700; }
.th-dash.no-meetup .th-dash-next .th-dash-card-head { margin-bottom: 4px; }

/* Stats: 2 × 2, stretching to the height of the meetup card */
.th-dash-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1fr; gap: 12px; }
.th-stat {
  display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 14px; color: var(--ink); text-decoration: none;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
}
.th-stat:hover { color: var(--ink); transform: translateY(-2px); box-shadow: var(--shadow-pop); }
.th-stat-label { color: var(--ink-muted); font: 600 12px/16px var(--font-sans); }
.th-stat b { font: 750 30px/1.15 var(--font-display); }
.th-stat small { font-size: 12px; }
.th-stat-warn { color: #9A6B00; font-weight: 700; }
[data-theme="dark"] .th-stat-warn { color: #E4B54A; }

/* Needs your action */
.th-dash-list { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
.th-dash-row {
  display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; border: 0; border-radius: var(--radius-md);
  background: none; color: var(--ink); text-align: left; text-decoration: none; transition: background 0.15s ease;
}
.th-dash-row:hover { background: var(--paper-sunk); color: var(--ink); }
.th-dash-row-text { display: flex; flex-direction: column; flex: 1; min-width: 0; line-height: 19px; }
.th-dash-row-text b { font-size: 14px; }
.th-dash-row-text .small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.th-dash-icon { display: inline-flex; flex: none; width: 40px; height: 40px; align-items: center; justify-content: center; border-radius: 50%; background: var(--paper-sunk); }
.th-dash-star { color: #C98A12; background: #FBF0D6; }
[data-theme="dark"] .th-dash-star { background: rgba(228, 167, 42, 0.16); color: #E4B54A; }
.th-dash-caret { transform: rotate(90deg); transition: transform 0.2s ease; }
.th-dash-caret.is-open { transform: rotate(-90deg); }
.th-dash-sublist { margin: 2px 0 4px 26px; padding: 0 0 0 12px; border-left: 2px solid var(--line); list-style: none; }
.th-dash-rate { flex: none; padding: 3px 10px; border-radius: 999px; background: var(--lime-soft); color: var(--lime-ink); font-size: 12px; font-weight: 800; }
.th-dash-more { display: inline-block; margin: 8px 0 0 8px; }

/* This week: 7 in a row; 4 + 3 in the narrow side column */
.th-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; margin-bottom: 12px; }
@media (min-width: 992px) { .th-week { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.th-week-day {
  display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 2px; border-radius: 12px; background: var(--paper-sunk);
  font-size: 11px; color: var(--ink-muted); min-height: 62px;
}
.th-week-day b { font: 750 17px/1.1 var(--font-display); color: var(--ink); }
.th-week-day i { width: 7px; height: 7px; border-radius: 50%; background: var(--emerald); }
.th-week-day.has-meetup { background: var(--lime-soft); color: var(--lime-ink); }
.th-week-day.is-today { box-shadow: inset 0 0 0 1.5px var(--ink); }
.th-week-list { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.th-week-list a { display: flex; flex-direction: column; gap: 1px; padding: 6px 8px; border-radius: var(--radius-sm); color: var(--ink); text-decoration: none; font-size: 14px; }
.th-week-list a:hover { background: var(--paper-sunk); }
.th-week-list .data { color: var(--ink-muted); font-size: 12px; }

@media (max-width: 575.98px) {
  .th-stat b { font-size: 26px; }
  .th-week { gap: 4px; }
  .th-week-day { min-height: 56px; padding: 6px 0; }
}
</style>
