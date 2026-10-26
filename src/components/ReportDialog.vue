<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { api, errorMessage } from '@/lib/api'
import { showToast } from '@/lib/toast'
import AppIcon from './AppIcon.vue'

// Report a listing or a user. Reports are saved for the team to look at.
const props = defineProps({
  type: { type: String, required: true }, // 'listing' | 'user'
  targetId: { type: String, required: true },
  targetName: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const REASONS = {
  listing: [
    ['scam', 'Looks like a scam'],
    ['fake', 'Fake or not as described'],
    ['prohibited', 'Not allowed (e.g. weapons, drugs)'],
    ['offensive', 'Offensive photos or words'],
    ['other', 'Something else'],
  ],
  user: [
    ['scam', 'Tried to scam me'],
    ['harassment', 'Rude or harassing messages'],
    ['no-show', "Didn't show up to the meetup"],
    ['fake', 'Item was not as described'],
    ['other', 'Something else'],
  ],
}
const reasons = computed(() => REASONS[props.type])
const reason = ref('')
const details = ref('')
const sending = ref(false)
const error = ref('')
const dialog = ref(null)

async function submit() {
  error.value = ''
  if (!reason.value) {
    error.value = 'Pick a reason.'
    return
  }
  sending.value = true
  try {
    await api.post('/reports', { type: props.type, id: props.targetId, reason: reason.value, details: details.value })
    showToast('Thanks for reporting. Our team will take a look.', { icon: 'flag', tone: 'info' })
    emit('close')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    sending.value = false
  }
}

function onKey(event) {
  if (event.key === 'Escape') emit('close')
}
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  await nextTick()
  dialog.value?.querySelector('input')?.focus()
})
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="th-dialog-backdrop" @click.self="emit('close')">
    <form
      ref="dialog"
      class="th-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      @submit.prevent="submit"
    >
      <button type="button" class="th-moment-x" aria-label="Close" @click="emit('close')"><AppIcon name="x" :size="18" /></button>
      <span class="th-dialog-icon"><AppIcon name="flag" :size="20" /></span>
      <h2 id="report-title">Report {{ type === 'listing' ? 'this listing' : targetName || 'this user' }}</h2>
      <p class="th-muted">Tell us what's wrong. {{ type === 'user' ? `${targetName || 'They'} won't know who reported them.` : "The owner won't know it was you." }}</p>

      <fieldset class="th-dialog-reasons">
        <legend class="visually-hidden">Reason</legend>
        <label v-for="[value, label] in reasons" :key="value" class="th-dialog-reason" :class="{ 'is-on': reason === value }">
          <input v-model="reason" type="radio" name="reason" :value="value" />
          <span>{{ label }}</span>
        </label>
      </fieldset>

      <label class="form-label small mt-2" for="report-details">More details {{ reason === 'other' ? '' : '(optional)' }}</label>
      <textarea id="report-details" v-model="details" class="form-control" rows="3" maxlength="500" placeholder="What happened?"></textarea>
      <div v-if="error" class="th-field-error mt-2" role="alert">{{ error }}</div>

      <div class="th-dialog-actions">
        <button type="button" class="btn btn-ghost" @click="emit('close')">Cancel</button>
        <button type="submit" class="btn btn-danger" :disabled="sending">{{ sending ? 'Sending…' : 'Send report' }}</button>
      </div>
    </form>
  </div>
</template>

<style>
/* A small dialog (used by Report; the backdrop matches the trade pop-ups) */
.th-dialog-backdrop {
  position: fixed; inset: 0; z-index: 2500; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(8, 24, 19, 0.5); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); animation: th-moment-dim 0.25s ease both;
}
.th-dialog {
  position: relative; width: min(480px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; padding: 24px; border-radius: 22px;
  background: var(--paper-raised); box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.55); animation: th-moment-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.th-dialog h2 { margin: 10px 0 4px; font-size: 22px; font-weight: 750; }
.th-dialog-icon { display: inline-flex; width: 44px; height: 44px; align-items: center; justify-content: center; border-radius: 50%; background: #FBE3E0; color: var(--brick); }
.th-dialog-reasons { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; border: 0; }
.th-dialog-reason {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1.5px solid var(--line); border-radius: var(--radius-md);
  cursor: pointer; font-size: 14px; font-weight: 600; transition: border-color 0.15s ease, background 0.15s ease;
}
.th-dialog-reason:hover { border-color: var(--line-strong); }
.th-dialog-reason.is-on { border-color: var(--brick); background: color-mix(in srgb, #FBE3E0 60%, transparent); }
.th-dialog-reason input { accent-color: var(--brick); }
.th-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
[data-theme="dark"] .th-dialog-icon { background: #4A2420; }
[data-theme="dark"] .th-dialog-reason.is-on { background: #3A201D; }
</style>
