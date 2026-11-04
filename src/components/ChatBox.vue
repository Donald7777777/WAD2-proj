<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { api, errorMessage } from '@/lib/api'
import { useNotificationStore } from '@/stores/notifications'
import ImageUploader from './ImageUploader.vue'
import AppIcon from './AppIcon.vue'
import UserAvatar from './UserAvatar.vue'
import { formatMessageTime } from '@/lib/format'

// The trade chat (feature 3).
// - New messages arrive instantly over the app's live connection (with a slow check as a backup)
// - "Hannah is typing…" while the other person types
// - "Seen" under your last message once they've read it
// - Search: filter the conversation and highlight what matches
const props = defineProps({
  // Phone chat page: show a back arrow and the other person's avatar in the header
  backTo: { type: String, default: '' },
  otherAvatar: { type: String, default: '' },
  tradeId: String,
  currentUserId: String,
  disabled: Boolean,
  // Name shown in the chat header
  otherName: { type: String, default: '' },
  // When the other person last read this chat (from the trade), for "Seen"
  otherReadAt: { type: String, default: '' },
  // Why chat is off, shown above the message box (e.g. you blocked this person)
  closedNote: { type: String, default: '' },
})
// Tell the parent when a system message arrives (e.g. the other user accepted)
const emit = defineEmits(['system-message'])

const notes = useNotificationStore()
const messages = ref([])
const newText = ref('')
const error = ref('')
const messageList = ref(null)
const BACKUP_POLL_MS = 15000
let timer = null
let stopListening = null
// Animation helpers: show "sending" dots, and pop in messages that arrive after the first load
const sending = ref(false)
const freshIds = ref(new Set())
function markFresh(id) {
  freshIds.value = new Set(freshIds.value).add(id)
}

function lastTimestamp() {
  const last = messages.value[messages.value.length - 1]
  return last ? last.createdAt : null
}

async function scrollToBottom() {
  await nextTick()
  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight
  }
}

// Fetch only messages newer than the last one we have
let fetching = false
async function fetchNew() {
  if (fetching) return
  fetching = true
  try {
    const response = await api.get(`/trades/${props.tradeId}/messages`, {
      params: { after: lastTimestamp() },
    })
    // Skip anything already shown (e.g. a message we just sent)
    const fresh = response.data.filter((m) => !messages.value.some((old) => old._id === m._id))
    if (fresh.length > 0) {
      const isFirstLoad = messages.value.length === 0
      messages.value.push(...fresh)
      if (!isFirstLoad) fresh.forEach((m) => markFresh(m._id))
      if (!searching.value) scrollToBottom()
      if (!isFirstLoad && fresh.some((m) => m.type === 'system')) {
        emit('system-message')
      }
      // Their message arrived: they're not typing any more
      if (fresh.some((m) => m.type !== 'system' && !isMine(m))) typingName.value = ''
      markRead()
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    fetching = false
  }
}

async function send(imageUrl = '') {
  if (!newText.value.trim() && !imageUrl) return
  if (sending.value) return
  sending.value = true
  const text = newText.value
  newText.value = ''
  lastTypingSent = 0
  scrollToBottom()
  try {
    const response = await api.post(`/trades/${props.tradeId}/messages`, { text, imageUrl })
    markFresh(response.data._id)
    messages.value.push(response.data)
    scrollToBottom()
  } catch (e) {
    newText.value = text
    error.value = errorMessage(e)
  } finally {
    sending.value = false
  }
}

function isMine(message) {
  return message.sender?._id === props.currentUserId
}

function formatTime(date) {
  return formatMessageTime(date)
}

// ---------- Read receipts ("Seen") ----------
const theirReadAt = ref(props.otherReadAt || '')
watch(
  () => props.otherReadAt,
  (at) => {
    if (at && (!theirReadAt.value || at > theirReadAt.value)) theirReadAt.value = at
  },
)
// Your newest message, and whether they've read it
const myLast = computed(() => [...messages.value].reverse().find((m) => m.type !== 'system' && isMine(m)))
const seen = computed(() => Boolean(myLast.value && theirReadAt.value && new Date(theirReadAt.value) >= new Date(myLast.value.createdAt)))

// Tell the server you've read the chat (only while the tab is actually visible)
let readTimer = null
function markRead() {
  if (document.hidden || props.disabled) return
  clearTimeout(readTimer)
  readTimer = setTimeout(() => api.post(`/trades/${props.tradeId}/read`).catch(() => {}), 400)
}
function onVisible() {
  if (!document.hidden) {
    fetchNew()
    markRead()
  }
}

// ---------- Typing ----------
const typingName = ref('')
let typingTimer = null
let lastTypingSent = 0
// While you type, tell the other person at most every 2.5 s
function onInput() {
  const now = Date.now()
  if (!newText.value.trim() || now - lastTypingSent < 2500 || props.disabled) return
  lastTypingSent = now
  api.post(`/trades/${props.tradeId}/typing`).catch(() => {})
}
function showTyping(name) {
  typingName.value = name || props.otherName || 'They'
  clearTimeout(typingTimer)
  // Hide it if nothing else arrives for a few seconds
  typingTimer = setTimeout(() => (typingName.value = ''), 4000)
  if (!searching.value) scrollToBottom()
}

// ---------- Search ----------
const searching = ref(false)
const query = ref('')
const searchInput = ref(null)
const q = computed(() => query.value.trim().toLowerCase())
const shown = computed(() =>
  q.value ? messages.value.filter((m) => m.type !== 'system' && m.text !== '(photo)' && m.text.toLowerCase().includes(q.value)) : messages.value,
)
async function toggleSearch() {
  searching.value = !searching.value
  query.value = ''
  if (searching.value) {
    await nextTick()
    searchInput.value?.focus()
  } else {
    scrollToBottom()
  }
}
// Split text around the matches so they can be highlighted
function parts(text) {
  if (!q.value) return [{ text, hit: false }]
  const out = []
  const lower = text.toLowerCase()
  let i = 0
  while (i < text.length) {
    const at = lower.indexOf(q.value, i)
    if (at === -1) {
      out.push({ text: text.slice(i), hit: false })
      break
    }
    if (at > i) out.push({ text: text.slice(i, at), hit: false })
    out.push({ text: text.slice(at, at + q.value.length), hit: true })
    i = at + q.value.length
  }
  return out
}
// Jump from a search result back to it in the full conversation
async function jumpTo(message) {
  searching.value = false
  query.value = ''
  await nextTick()
  const el = messageList.value?.querySelector(`[data-id="${message._id}"]`)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el?.classList.add('is-found')
  setTimeout(() => el?.classList.remove('is-found'), 1600)
}

// ---------- Live updates ----------
onMounted(() => {
  fetchNew()
  // A slow backup check, in case the live connection is down
  timer = setInterval(fetchNew, BACKUP_POLL_MS)
  stopListening = notes.onTradeEvent((event) => {
    if (String(event.tradeId) !== String(props.tradeId)) return
    if (event.type === 'chat' || event.type === 'notification') fetchNew()
    else if (event.type === 'typing') showTyping(event.name)
    else if (event.type === 'read' && event.at) theirReadAt.value = event.at
  })
  document.addEventListener('visibilitychange', onVisible)
})

onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(typingTimer)
  clearTimeout(readTimer)
  stopListening?.()
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
  <section class="card th-chat" aria-label="Chat">
    <div class="th-chat-head">
      <RouterLink v-if="backTo" :to="backTo" class="th-chat-back" aria-label="Back to trade"><AppIcon name="back" :size="20" /></RouterLink>
      <UserAvatar v-if="backTo" :name="otherName || 'Trader'" :src="otherAvatar" size="sm" />
      <span v-else class="th-card-icon"><AppIcon name="chat" /></span>
      <div class="th-chat-title">
        <h2>{{ otherName ? `Chat with ${otherName}` : 'Chat' }}</h2>
        <p>
          <Transition name="th-fade" mode="out-in">
            <span v-if="typingName" key="typing" class="th-chat-typing-label">{{ typingName }} is typing…</span>
            <span v-else key="sub">{{ backTo ? 'Trade chat' : 'Messages and trade updates in one place.' }}</span>
          </Transition>
        </p>
      </div>
      <button
        type="button"
        class="th-chat-searchbtn"
        :class="{ 'is-on': searching }"
        :aria-label="searching ? 'Close search' : 'Search messages'"
        :aria-pressed="searching"
        @click="toggleSearch"
      >
        <AppIcon :name="searching ? 'x' : 'search'" :size="18" />
      </button>
    </div>

    <!-- Search the conversation -->
    <div v-if="searching" class="th-chat-search">
      <AppIcon name="search" :size="16" />
      <input ref="searchInput" v-model="query" type="search" placeholder="Search this chat" aria-label="Search this chat" @keydown.esc="toggleSearch" />
      <span v-if="q" class="th-muted small">{{ shown.length }} found</span>
    </div>

    <div ref="messageList" class="th-chat-log" aria-live="polite">
      <p v-if="messages.length === 0" class="th-chat-event">No messages yet. Say hi.</p>
      <p v-else-if="q && !shown.length" class="th-chat-event">No messages match "{{ query }}".</p>

      <template v-for="message in shown" :key="message._id">
        <!-- Trade updates are shown as events -->
        <div
          v-if="message.type === 'system'"
          class="th-chat-event"
          :class="{ 'is-new': freshIds.has(message._id) }"
          :data-id="message._id"
        >
          {{ message.text }}
        </div>

        <div
          v-else
          class="th-bubble"
          :class="[isMine(message) ? 'th-bubble-you' : 'th-bubble-them', { 'is-new': freshIds.has(message._id), 'is-result': q }]"
          :data-id="message._id"
          :role="q ? 'button' : null"
          :tabindex="q ? 0 : null"
          @click="q && jumpTo(message)"
          @keydown.enter="q && jumpTo(message)"
        >
          <img v-if="message.imageUrl" :src="message.imageUrl" alt="Photo" class="th-bubble-img" />
          <div v-if="message.text !== '(photo)'">
            <template v-for="(part, i) in parts(message.text)" :key="i">
              <mark v-if="part.hit" class="th-chat-hit">{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </div>
          <div class="th-bubble-time">
            {{ formatTime(message.createdAt) }}
            <!-- Sent tick: a tiny version of the logo smile -->
            <svg v-if="isMine(message)" class="th-sent-smile" width="16" height="10" viewBox="0 0 16 10" aria-label="Sent">
              <circle cx="3" cy="3" r="2" />
              <circle cx="13" cy="3" r="2" />
              <path d="M3 3 C1.5 10 14.5 10 13 3" pathLength="1" />
            </svg>
          </div>
        </div>
        <!-- Read receipt under your newest message -->
        <span v-if="!q && message === myLast" class="th-chat-seen" :class="{ 'is-seen': seen }">
          {{ seen ? `Seen by ${otherName || 'them'}` : 'Delivered' }}
        </span>
      </template>

      <!-- While your message is on its way -->
      <div v-if="sending" class="th-bubble th-bubble-you th-typing" aria-label="Sending">
        <i></i><i></i><i></i>
      </div>
      <!-- The other person is typing -->
      <div v-else-if="typingName && !q" class="th-bubble th-bubble-them th-typing" :aria-label="`${typingName} is typing`">
        <i></i><i></i><i></i>
      </div>
    </div>

    <div class="th-chat-foot">
      <p v-if="closedNote" class="th-chat-closed-note mb-2"><AppIcon name="lock" :size="16" />{{ closedNote }}</p>
      <div v-if="error" class="th-field-error mb-2" role="alert">{{ error }}</div>
      <form class="th-composer" @submit.prevent="send()">
        <input
          v-model="newText"
          type="text"
          class="form-control"
          :placeholder="disabled ? 'Chat is closed' : 'Type a message'"
          aria-label="Message"
          :disabled="disabled"
          @input="onInput"
        />
        <button class="th-send" :class="{ 'is-sending': sending }" type="submit" :disabled="disabled" aria-label="Send">
          <AppIcon name="send" />
        </button>
      </form>
      <details v-if="!disabled" class="th-photo-send">
        <summary><AppIcon name="camera" :size="16" />Send a photo</summary>
        <ImageUploader folder="chat" :show-preview="false" @uploaded="send($event.url)" />
      </details>
    </div>
  </section>
</template>

<style>
.th-chat-closed-note { display: flex; gap: 8px; align-items: flex-start; margin: 0; padding: 8px 10px; border-radius: var(--radius-md); background: var(--paper-sunk); color: var(--ink-muted); font-size: 13px; line-height: 1.4; }
.th-chat-closed-note svg { flex: none; margin-top: 1px; }
.th-chat-title { flex: 1; min-width: 0; }
.th-chat-typing-label { color: var(--emerald); font-weight: 600; }
.th-chat-searchbtn {
  display: inline-flex; flex: none; width: 36px; height: 36px; align-items: center; justify-content: center; border: 1px solid var(--line);
  border-radius: 50%; background: var(--paper-raised); color: var(--ink); transition: background 0.2s ease, border-color 0.2s ease;
}
.th-chat-searchbtn:hover, .th-chat-searchbtn.is-on { border-color: var(--line-strong); background: var(--paper-sunk); }
.th-chat-search {
  display: flex; align-items: center; gap: 8px; padding: 8px var(--space-4); border-bottom: 1px solid var(--line); background: var(--paper-raised);
}
.th-chat-search input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ink); font-size: 14px; outline: none; }
.th-chat-hit { padding: 0 2px; border-radius: 3px; background: #F6D84A; color: #2B2200; }
.th-bubble.is-result { cursor: pointer; }
.th-bubble.is-result:hover { filter: brightness(0.97); }
.th-bubble.is-found { animation: th-chat-found 1.6s ease; }
@keyframes th-chat-found { 0%, 60% { box-shadow: 0 0 0 3px #F6D84A; } 100% { box-shadow: none; } }
.th-chat-seen { align-self: flex-end; margin: -4px 4px 0; font-size: 11px; color: var(--ink-muted); }
.th-chat-seen.is-seen { color: var(--emerald); font-weight: 600; }
.th-fade-enter-active, .th-fade-leave-active { transition: opacity 0.2s ease; }
.th-fade-enter-from, .th-fade-leave-to { opacity: 0; }
</style>
