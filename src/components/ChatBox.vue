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
  try {
    const response = await api.post(`/trades/${props.tradeId}/messages`, {
      text: newText.value,
      imageUrl,
    })
    messages.value.push(response.data)
    newText.value = ''
    scrollToBottom()
  } catch (e) {
    error.value = errorMessage(e)
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
        <div v-if="message.type === 'system'" class="th-chat-event">{{ message.text }}</div>

        <div v-else class="th-bubble" :class="isMine(message) ? 'th-bubble-you' : 'th-bubble-them'">
          <img v-if="message.imageUrl" :src="message.imageUrl" alt="Photo" class="th-bubble-img" />
          <div v-if="message.text !== '(photo)'">{{ message.text }}</div>
          <div class="th-bubble-time">{{ formatTime(message.createdAt) }}</div>
        </div>
      </template>
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
        <button class="th-send" type="submit" :disabled="disabled" aria-label="Send">
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
