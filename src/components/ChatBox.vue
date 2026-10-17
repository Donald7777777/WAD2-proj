<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { api, errorMessage } from '@/lib/api'
import ImageUploader from './ImageUploader.vue'

const props = defineProps({
  tradeId: String,
  currentUserId: String,
  disabled: Boolean,
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
  return new Date(date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
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
  <div class="card">
    <div class="card-header fw-semibold">Chat</div>
    <div ref="messageList" class="card-body message-list">
      <p v-if="messages.length === 0" class="text-secondary small">No messages yet.</p>

      <template v-for="message in messages" :key="message._id">
        <!-- Trade updates are shown as cards -->
        <div v-if="message.type === 'system'" class="alert alert-light border small text-center py-2">
          {{ message.text }}
        </div>

        <div v-else class="d-flex mb-2" :class="isMine(message) ? 'justify-content-end' : 'justify-content-start'">
          <div class="bubble p-2 rounded" :class="isMine(message) ? 'bg-success text-white' : 'bg-light border'">
            <div v-if="!isMine(message)" class="small fw-semibold">{{ message.sender?.name }}</div>
            <img v-if="message.imageUrl" :src="message.imageUrl" alt="Photo" class="img-fluid rounded mb-1" />
            <div v-if="message.text !== '(photo)'">{{ message.text }}</div>
            <div class="tiny opacity-75">{{ formatTime(message.createdAt) }}</div>
          </div>
        </div>
      </template>
    </div>

    <div class="card-footer">
      <div v-if="error" class="text-danger small mb-1">{{ error }}</div>
      <form class="input-group" @submit.prevent="send()">
        <input
          v-model="newText"
          type="text"
          class="form-control"
          placeholder="Type a message"
          :disabled="disabled"
        />
        <button class="btn btn-success" type="submit" :disabled="disabled">Send</button>
      </form>
      <details v-if="!disabled" class="mt-2 small">
        <summary>Send a photo</summary>
        <ImageUploader folder="chat" :show-preview="false" @uploaded="send($event.url)" />
      </details>
    </div>
  </div>
</template>

<style scoped>
.message-list {
  height: 360px;
  overflow-y: auto;
}
.bubble {
  max-width: 75%;
}
.tiny {
  font-size: 0.7rem;
}
</style>
