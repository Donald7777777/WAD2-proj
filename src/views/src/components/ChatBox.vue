<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { api, errorMessage } from '@/lib/api'
import ImageUploader from './ImageUploader.vue'
import AppIcon from './AppIcon.vue'
import { formatMessageTime } from '@/lib/format'

const props = defineProps({
  tradeId: String,
  currentUserId: String,
  disabled: Boolean,
  // Name shown in the chat header
  otherName: { type: String, default: '' },
})
// Tell the parent when a system message arrives (e.g. the other user accepted)
const emit = defineEmits(['system-message'])

const messages = ref([])
const newText = ref('')
const error = ref('')
const messageList = ref(null)
let timer = null
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
async function fetchNew() {
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
      scrollToBottom()
      if (!isFirstLoad && fresh.some((m) => m.type === 'system')) {
        emit('system-message')
      }
    }
  } catch (e) {
    error.value = errorMessage(e)
  }
}

async function send(imageUrl = '') {
  if (!newText.value.trim() && !imageUrl) return
  if (sending.value) return
  sending.value = true
  const text = newText.value
  newText.value = ''
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

// Check for new messages every 3 seconds while this page is open
onMounted(() => {
  fetchNew()
  timer = setInterval(fetchNew, 3000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <section class="card th-chat" aria-label="Chat">
    <div class="th-chat-head">
      <span class="th-card-icon"><AppIcon name="chat" /></span>
      <div>
        <h2>{{ otherName ? `Chat with ${otherName}` : 'Chat' }}</h2>
        <p>Messages and trade updates in one place.</p>
      </div>
    </div>

    <div ref="messageList" class="th-chat-log" aria-live="polite">
      <p v-if="messages.length === 0" class="th-chat-event">No messages yet. Say hi.</p>

      <template v-for="message in messages" :key="message._id">
        <!-- Trade updates are shown as events -->
        <div v-if="message.type === 'system'" class="th-chat-event" :class="{ 'is-new': freshIds.has(message._id) }">
          {{ message.text }}
        </div>

        <div
          v-else
          class="th-bubble"
          :class="[isMine(message) ? 'th-bubble-you' : 'th-bubble-them', { 'is-new': freshIds.has(message._id) }]"
        >
          <img v-if="message.imageUrl" :src="message.imageUrl" alt="Photo" class="th-bubble-img" />
          <div v-if="message.text !== '(photo)'">{{ message.text }}</div>
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
      </template>

      <!-- While your message is on its way -->
      <div v-if="sending" class="th-bubble th-bubble-you th-typing" aria-label="Sending">
        <i></i><i></i><i></i>
      </div>
    </div>

    <div class="th-chat-foot">
      <div v-if="error" class="th-field-error mb-2" role="alert">{{ error }}</div>
      <form class="th-composer" @submit.prevent="send()">
        <input
          v-model="newText"
          type="text"
          class="form-control"
          :placeholder="disabled ? 'Chat is closed' : 'Type a message'"
          aria-label="Message"
          :disabled="disabled"
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
