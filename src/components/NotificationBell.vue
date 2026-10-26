<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useNotificationStore } from '@/stores/notifications'
import AppIcon from './AppIcon.vue'

// Bell in the top bar: unread count, and your recent notifications (last 14 days)
const notes = useNotificationStore()
const open = ref(false)
const root = ref(null)
const ringing = ref(false)

function toggle() {
  open.value = !open.value
  if (open.value) notes.markAllRead()
}

function go(item) {
  open.value = false
  notes.open(item)
}

// "just now", "3m", "2h"
function ago(date) {
  const seconds = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 45) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

// Wiggle when something new arrives
watch(
  () => notes.ringKey,
  () => {
    ringing.value = false
    requestAnimationFrame(() => (ringing.value = true))
  },
)

function onDocClick(event) {
  if (open.value && root.value && !root.value.contains(event.target)) open.value = false
}
function onKey(event) {
  if (event.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="th-bell-wrap">
    <button
      type="button"
      class="th-bell"
      :class="{ 'is-ringing': ringing, 'is-open': open }"
      :aria-label="notes.unread ? `Notifications, ${notes.unread} new` : 'Notifications'"
      :aria-expanded="open"
      @click="toggle"
      @animationend="ringing = false"
    >
      <AppIcon name="bell" :size="22" />
      <Transition name="th-badge">
        <span v-if="notes.unread" :key="notes.unread" class="th-bell-count">{{ notes.unread > 9 ? '9+' : notes.unread }}</span>
      </Transition>
    </button>

    <Transition name="th-panel">
      <div v-if="open" class="th-bell-panel" role="dialog" aria-label="Notifications">
        <div class="th-bell-head">
          <b>Notifications</b>
        </div>

        <div v-if="notes.items.length === 0" class="th-bell-empty">
          <span class="th-bell-empty-icon"><AppIcon name="bell" :size="22" /></span>
          <strong>You're all caught up</strong>
          <p>New messages and trade updates will show up here.</p>
        </div>

        <ul v-else class="th-bell-list">
          <li v-for="item in notes.items" :key="item.id">
            <button type="button" class="th-bell-item" :class="{ 'is-new': item.fresh || !item.read }" :data-tone="item.tone" @click="go(item)">
              <span class="th-bell-icon"><AppIcon :name="item.icon" :size="16" /></span>
              <span class="th-bell-text">
                <b>{{ item.title }}</b>
                <span>{{ item.text }}</span>
              </span>
              <time class="th-bell-time">{{ ago(item.at) }}</time>
              <span v-if="item.fresh || !item.read" class="th-bell-dot" aria-label="new"></span>
            </button>
          </li>
        </ul>

        <div v-if="notes.permission !== 'unsupported'" class="th-bell-foot">
          <button v-if="notes.permission === 'default'" type="button" class="btn btn-sm btn-outline-dark" @click="notes.enableDesktop">
            <AppIcon name="bell" :size="16" />Turn on desktop alerts
          </button>
          <span v-else-if="notes.permission === 'granted'" class="th-bell-note"><AppIcon name="check" :size="16" />Desktop alerts are on</span>
          <span v-else class="th-bell-note">Desktop alerts are blocked in your browser settings</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.th-bell-wrap { position: relative; }
.th-bell {
  position: relative; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px;
  border: 1.5px solid var(--line); border-radius: 50%; background: var(--paper-raised); color: var(--ink);
  transition: border-color 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.th-bell:hover, .th-bell.is-open { border-color: var(--line-strong); }
.th-bell:active { transform: scale(0.92); }
.th-bell.is-ringing svg { animation: th-bell-ring 0.9s ease; transform-origin: 50% 10%; }
@keyframes th-bell-ring {
  10% { transform: rotate(16deg); } 25% { transform: rotate(-14deg); } 40% { transform: rotate(10deg); }
  55% { transform: rotate(-6deg); } 70% { transform: rotate(3deg); } 100% { transform: none; }
}
.th-bell-count {
  position: absolute; top: -3px; right: -3px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center; background: var(--brick); color: #fff;
  font: 700 11px/1 var(--font-sans); box-shadow: 0 0 0 2px var(--paper);
}
.th-badge-enter-active { transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.th-badge-enter-from { transform: scale(0); }

.th-bell-panel {
  position: absolute; top: calc(100% + 10px); right: -8px; z-index: 1100; width: min(380px, calc(100vw - 24px));
  border-radius: var(--radius-lg); background: var(--paper-raised); border: 1px solid var(--line); box-shadow: var(--shadow-pop);
  overflow: hidden; transform-origin: top right;
}
@media (max-width: 575.98px) { .th-bell-panel { position: fixed; top: 70px; right: 12px; left: 12px; width: auto; } }
.th-panel-enter-active { transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.th-panel-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.th-panel-enter-from, .th-panel-leave-to { opacity: 0; transform: translateY(-6px) scale(0.96); }
.th-bell-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 10px; font-size: 16px; }

.th-bell-list { list-style: none; margin: 0; padding: 0 6px 6px; max-height: min(420px, 60vh); overflow-y: auto; }
.th-bell-item {
  display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px; border: 0; border-radius: var(--radius-md);
  background: transparent; color: var(--ink); text-align: left; animation: th-bell-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.th-bell-item:hover { background: var(--paper-sunk); }
@keyframes th-bell-in { from { opacity: 0; transform: translateY(-6px); } }
.th-bell-icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; flex: none; background: var(--lagoon-soft); color: var(--lagoon); }
.th-bell-item[data-tone="success"] .th-bell-icon { background: var(--lime-soft); color: var(--lime-ink); }
.th-bell-item[data-tone="danger"] .th-bell-icon { background: var(--brick-soft); color: var(--brick); }
.th-bell-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.th-bell-text b { font-size: 14px; line-height: 19px; }
.th-bell-text span { font-size: 13px; line-height: 18px; color: var(--ink-muted); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.th-bell-time { flex: none; font: 500 11px/19px var(--font-mono); color: var(--ink-muted); }

.th-bell-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 18px 20px 22px; color: var(--ink-muted); }
.th-bell-empty-icon { display: inline-flex; width: 44px; height: 44px; align-items: center; justify-content: center; border-radius: 50%; background: var(--mint-soft); color: var(--ink); margin-bottom: 6px; }
.th-bell-empty strong { color: var(--ink); font-size: 15px; }
.th-bell-empty p { margin: 0; font-size: 13px; }
.th-bell-foot { display: flex; justify-content: center; padding: 10px 12px 12px; border-top: 1px solid var(--line); }
.th-bell-note { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--ink-muted); text-align: center; }

/* Clickable toasts (from notifications) */
.th-toast.is-clickable { cursor: pointer; }
.th-toast.is-clickable:hover { transform: translateY(-2px); }
.th-toast-text { display: flex; flex-direction: column; max-width: 340px; }
.th-toast-title { font-weight: 700; }
.th-toast-title + * , .th-toast-text { font-weight: 500; }
@media (prefers-reduced-motion: reduce) { .th-bell.is-ringing svg, .th-bell-item { animation: none; } }
</style>
<style>
/* New since you last opened the bell */
.th-bell-item { position: relative; }
.th-bell-item.is-new { background: color-mix(in srgb, var(--lime-soft) 55%, transparent); }
.th-bell-dot { position: absolute; top: 50%; left: 1px; width: 7px; height: 7px; margin-top: -3.5px; border-radius: 50%; background: var(--brick); }
</style>
