<script setup>
import { ref, computed } from 'vue'
import { api, errorMessage } from '@/lib/api'
import StarRating from './StarRating.vue'
import AppIcon from './AppIcon.vue'

// Rate the other trader (1-5 stars) and leave a comment, after a completed trade
const props = defineProps({
  tradeId: { type: String, required: true },
  them: { type: String, required: true },
})
const emit = defineEmits(['done'])

const rating = ref(0)
const comment = ref('')
const sending = ref(false)
const error = ref('')
const LABELS = ['', 'Not great', 'Could be better', 'Okay', 'Good', 'Amazing!']
const label = computed(() => LABELS[rating.value] || 'Tap a star')

async function submit() {
  if (!rating.value) {
    error.value = 'Pick 1 to 5 stars first.'
    return
  }
  sending.value = true
  error.value = ''
  try {
    const { data } = await api.post(`/trades/${props.tradeId}/review`, { rating: rating.value, comment: comment.value })
    emit('done', data.review)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <form class="th-reviewform" @submit.prevent="submit">
    <span class="th-reviewform-q">How was trading with {{ them }}?</span>
    <StarRating v-model="rating" editable :size="34" />
    <span class="th-reviewform-label" :class="{ 'is-set': rating }">{{ label }}</span>
    <textarea
      v-model="comment"
      class="form-control"
      rows="2"
      maxlength="500"
      :placeholder="`Say something about ${them} (optional), e.g. friendly, on time, item as described`"
    ></textarea>
    <div v-if="error" class="th-field-error">{{ error }}</div>
    <div class="th-reviewform-actions">
      <slot name="secondary"></slot>
      <button type="submit" class="btn btn-offer" :disabled="sending || !rating">
        <AppIcon name="send" :size="18" />{{ sending ? 'Sending…' : 'Submit review' }}
      </button>
    </div>
  </form>
</template>

<style>
.th-reviewform { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.th-reviewform-q { font-weight: 700; font-size: 15px; }
.th-reviewform-label { min-height: 20px; font-size: 13px; font-weight: 600; color: var(--ink-muted); transition: color 0.2s ease; }
.th-reviewform-label.is-set { color: #B7811A; }
.th-reviewform textarea { max-width: 460px; text-align: left; }
.th-reviewform-actions { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
</style>
