<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'

// Pick the meetup day and time, in TradeHappy's style (instead of the browser's own pickers).
// - Calendar: only today and later can be picked
// - Times: every 30 minutes from 8 am to 10 pm, grouped; times that have passed today are greyed out
// v-model:date = "2026-10-30", v-model:time = "18:30"
const props = defineProps({
  date: { type: String, default: '' },
  time: { type: String, default: '' },
})
const emit = defineEmits(['update:date', 'update:time'])

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = ref(new Date())
const todayIso = computed(() => iso(now.value))

// ---------- Calendar ----------
const start = props.date ? new Date(`${props.date}T00:00`) : new Date()
const month = ref(new Date(start.getFullYear(), start.getMonth(), 1))
const monthLabel = computed(() => month.value.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }))
const canGoBack = computed(() => {
  const n = now.value
  return month.value > new Date(n.getFullYear(), n.getMonth(), 1)
})
function moveMonth(step) {
  month.value = new Date(month.value.getFullYear(), month.value.getMonth() + step, 1)
}
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// The days of the month, padded so the 1st lands under the right weekday (weeks start Monday)
const days = computed(() => {
  const first = month.value
  const lead = (first.getDay() + 6) % 7
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const out = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= count; d++) {
    const date = new Date(first.getFullYear(), first.getMonth(), d)
    const value = iso(date)
    out.push({ day: d, value, past: value < todayIso.value, today: value === todayIso.value })
  }
  return out
})
function pickDay(day) {
  if (!day || day.past) return
  emit('update:date', day.value)
  // A time that has already passed today is no longer valid
  if (day.value === todayIso.value && props.time && slotPassed(props.time, day.value)) emit('update:time', '')
}

// Quick picks
const quick = computed(() => {
  const t = new Date(now.value)
  const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)
  const sat = new Date(t.getFullYear(), t.getMonth(), t.getDate() + ((6 - t.getDay() + 7) % 7 || 7))
  return [
    { label: 'Today', value: iso(t) },
    { label: 'Tomorrow', value: iso(tomorrow) },
    { label: 'This Saturday', value: iso(sat) },
  ]
})
function pickQuick(value) {
  const d = new Date(`${value}T00:00`)
  month.value = new Date(d.getFullYear(), d.getMonth(), 1)
  pickDay({ value, past: false })
}

// ---------- Times ----------
const SLOTS = []
for (let h = 8; h <= 22; h++) for (const m of [0, 30]) if (!(h === 22 && m === 30)) SLOTS.push(`${pad(h)}:${pad(m)}`)
const GROUPS = [
  { name: 'Morning', icon: 'sun', from: '08:00', to: '11:59' },
  { name: 'Afternoon', icon: 'clock', from: '12:00', to: '17:59' },
  { name: 'Evening', icon: 'moon', from: '18:00', to: '22:00' },
]
// Today: anything earlier than 15 minutes from now is greyed out
function slotPassed(slot, date = props.date) {
  if (date !== todayIso.value) return false
  const [h, m] = slot.split(':').map(Number)
  const at = new Date(now.value)
  at.setHours(h, m, 0, 0)
  return at.getTime() < now.value.getTime() + 15 * 60 * 1000
}
const label = (slot) => {
  const [h, m] = slot.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ''} ${h < 12 ? 'am' : 'pm'}`
}
const groups = computed(() =>
  GROUPS.map((g) => ({ ...g, slots: SLOTS.filter((s) => s >= g.from && s <= g.to).map((s) => ({ value: s, passed: slotPassed(s) })) })),
)
const noTimesLeft = computed(() => props.date === todayIso.value && SLOTS.every((s) => slotPassed(s)))

// Keep "now" fresh, and clear a time that has just passed
const timer = setInterval(() => (now.value = new Date()), 60 * 1000)
watch(now, () => {
  if (props.time && slotPassed(props.time)) emit('update:time', '')
})
onUnmounted(() => clearInterval(timer))

const summary = computed(() => {
  if (!props.date) return 'Pick a day'
  const d = new Date(`${props.date}T${props.time || '00:00'}`)
  const day = d.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' })
  return props.time ? `${day}, ${label(props.time)}` : `${day}: now pick a time`
})
</script>

<template>
  <div class="th-when-pick">
    <div class="th-when-summary" :class="{ 'is-set': date && time }" aria-live="polite">
      <AppIcon name="clock" :size="16" />{{ summary }}
    </div>

    <div class="th-when-grid">
      <!-- Day -->
      <div class="th-cal" role="group" aria-label="Meetup day">
        <div class="th-cal-quick">
          <button v-for="q in quick" :key="q.label" type="button" class="th-chip" :aria-pressed="date === q.value" @click="pickQuick(q.value)">
            {{ q.label }}
          </button>
        </div>
        <div class="th-cal-head">
          <button type="button" class="th-cal-nav" :disabled="!canGoBack" aria-label="Previous month" @click="moveMonth(-1)">
            <AppIcon name="chevron" :size="18" class="th-flip" />
          </button>
          <b>{{ monthLabel }}</b>
          <button type="button" class="th-cal-nav" aria-label="Next month" @click="moveMonth(1)">
            <AppIcon name="chevron" :size="18" />
          </button>
        </div>
        <div class="th-cal-days">
          <span v-for="w in WEEKDAYS" :key="w" class="th-cal-weekday">{{ w.slice(0, 2) }}</span>
          <template v-for="(d, i) in days" :key="i">
            <span v-if="!d"></span>
            <button
              v-else
              type="button"
              class="th-cal-day"
              :class="{ 'is-today': d.today, 'is-on': d.value === date }"
              :disabled="d.past"
              :aria-pressed="d.value === date"
              :aria-label="new Date(`${d.value}T00:00`).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' })"
              @click="pickDay(d)"
            >
              {{ d.day }}
            </button>
          </template>
        </div>
      </div>

      <!-- Time -->
      <div class="th-times" role="group" aria-label="Meetup time">
        <p v-if="!date" class="th-muted small mb-0">Pick a day first.</p>
        <p v-else-if="noTimesLeft" class="th-muted small mb-0">No times left today. Pick another day.</p>
        <template v-else>
          <div v-for="g in groups" :key="g.name" class="th-time-group">
            <span class="th-time-group-name"><AppIcon :name="g.icon" :size="14" />{{ g.name }}</span>
            <div class="th-time-slots">
              <button
                v-for="s in g.slots"
                :key="s.value"
                type="button"
                class="th-time-slot"
                :class="{ 'is-on': s.value === time }"
                :disabled="s.passed"
                :aria-pressed="s.value === time"
                @click="emit('update:time', s.value)"
              >
                {{ label(s.value) }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
.th-when-pick { display: flex; flex-direction: column; gap: 12px; }
.th-when-summary {
  display: inline-flex; align-self: flex-start; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px;
  background: var(--paper-sunk); color: var(--ink-muted); font-size: 14px; font-weight: 600; transition: background 0.2s ease, color 0.2s ease;
}
.th-when-summary.is-set { background: var(--lime-soft); color: var(--ink); }
.th-when-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
@media (min-width: 640px) { .th-when-grid { grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); align-items: start; } }

/* Calendar */
.th-cal { padding: 12px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--paper-raised); }
.th-cal-quick { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.th-cal-quick .th-chip { padding: 4px 12px; min-height: 32px; font-size: 13px; }
.th-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; font-size: 15px; }
.th-cal-nav { display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: transparent; color: var(--ink); }
.th-cal-nav:hover:not(:disabled) { background: var(--paper-sunk); }
.th-cal-nav:disabled { opacity: 0.3; }
.th-cal-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
.th-cal-weekday { padding: 4px 0; color: var(--ink-muted); font: 600 11px/16px var(--font-mono); }
.th-cal-day {
  aspect-ratio: 1; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 50%;
  background: transparent; color: var(--ink); font-size: 14px; font-weight: 600; transition: background 0.15s ease, transform 0.15s ease;
}
.th-cal-day:hover:not(:disabled) { background: var(--mint-soft); }
.th-cal-day.is-today { box-shadow: inset 0 0 0 1.5px var(--emerald); }
.th-cal-day.is-on { background: var(--ink); color: var(--on-ink); transform: scale(1.05); }
.th-cal-day:disabled { color: var(--ink-muted); opacity: 0.35; text-decoration: line-through; cursor: not-allowed; }

/* Times */
.th-times { display: flex; flex-direction: column; gap: 12px; }
.th-time-group-name { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 6px; color: var(--ink-muted); font: 600 12px/16px var(--font-sans); }
.th-time-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; }
.th-time-slot {
  padding: 7px 4px; border: 1.5px solid var(--line); border-radius: 999px; background: var(--paper-raised); color: var(--ink);
  font-size: 13px; font-weight: 600; transition: border-color 0.15s ease, background 0.15s ease;
}
.th-time-slot:hover:not(:disabled) { border-color: var(--ink); }
.th-time-slot.is-on { border-color: var(--ink); background: var(--lime); color: var(--on-lime); }
.th-time-slot:disabled { opacity: 0.35; text-decoration: line-through; cursor: not-allowed; }
</style>
