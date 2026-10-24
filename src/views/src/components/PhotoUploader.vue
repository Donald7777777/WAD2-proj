<script setup>
import { ref, computed, watch } from 'vue'
import { uploadImage } from '@/lib/storage'
import AppIcon from './AppIcon.vue'

// Upload several photos for a listing. v-model is an array of { path, url }; the first is the cover.
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  folder: { type: String, default: 'listings' },
  max: { type: Number, default: 6 },
})
const emit = defineEmits(['update:modelValue', 'busy'])

const input = ref(null)
const uploading = ref(0) // how many are on their way
const error = ref('')
const spaceLeft = computed(() => props.max - props.modelValue.length - uploading.value)
// Lets the form disable Save until every photo has finished uploading
watch(uploading, (n) => emit('busy', n > 0))

function pick() {
  input.value?.click()
}

async function onFiles(event) {
  error.value = ''
  const files = [...event.target.files].slice(0, Math.max(spaceLeft.value, 0))
  event.target.value = ''
  if (files.length === 0) {
    error.value = `You can add up to ${props.max} photos.`
    return
  }
  uploading.value += files.length
  // Upload in parallel, then add them all at once in the order they were picked
  const results = await Promise.allSettled(
    files.map((file) => uploadImage(file, props.folder).finally(() => uploading.value--)),
  )
  const added = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  const failed = results.find((r) => r.status === 'rejected')
  if (failed) error.value = failed.reason?.message || 'A photo could not be uploaded.'
  if (added.length) emit('update:modelValue', [...props.modelValue, ...added])
}

function remove(index) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  )
}

function makeCover(index) {
  const list = [...props.modelValue]
  const [photo] = list.splice(index, 1)
  emit('update:modelValue', [photo, ...list])
}
</script>

<template>
  <div class="th-photos">
    <TransitionGroup name="th-photo" tag="div" class="th-photos-grid">
      <figure v-for="(photo, index) in modelValue" :key="photo.url" class="th-photo" :class="{ 'is-cover': index === 0 }">
        <img :src="photo.url" :alt="`Photo ${index + 1}`" />
        <span v-if="index === 0" class="th-photo-cover">Cover</span>
        <div class="th-photo-actions">
          <button v-if="index > 0" type="button" class="th-photo-btn" @click="makeCover(index)">
            <AppIcon name="spark" :size="14" />Set cover
          </button>
          <button type="button" class="th-photo-btn th-photo-remove" :aria-label="`Remove photo ${index + 1}`" @click="remove(index)">
            <AppIcon name="x" :size="14" />
          </button>
        </div>
      </figure>

      <div v-for="n in uploading" :key="`up-${n}`" class="th-photo th-photo-loading" aria-label="Uploading">
        <span class="th-photo-spinner"></span>
      </div>

      <button v-if="spaceLeft > 0" key="add" type="button" class="th-photo th-photo-add" @click="pick">
        <AppIcon name="plus" :size="24" />
        <span>{{ modelValue.length ? 'Add more' : 'Add photos' }}</span>
        <small>{{ modelValue.length }}/{{ max }}</small>
      </button>
    </TransitionGroup>

    <input ref="input" type="file" accept="image/*" multiple class="visually-hidden" @change="onFiles" />
    <div class="form-text">The first photo is the cover. Add up to {{ max }}; each under 5 MB.</div>
    <div v-if="error" class="th-field-error">{{ error }}</div>
  </div>
</template>

<style>
.th-photos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
.th-photo {
  position: relative; margin: 0; aspect-ratio: 1; border-radius: var(--radius-md); overflow: hidden;
  background: var(--paper-sunk); border: 1px solid var(--line);
}
.th-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.th-photo.is-cover { box-shadow: 0 0 0 2px var(--lime-ink); }
.th-photo-cover {
  position: absolute; left: 6px; top: 6px; padding: 3px 8px; border-radius: 999px;
  background: var(--lime); color: var(--on-lime); font: 600 11px/1 var(--font-sans);
}
.th-photo-actions {
  position: absolute; inset: auto 6px 6px 6px; display: flex; justify-content: space-between; gap: 6px;
  opacity: 0; transform: translateY(4px); transition: opacity 0.2s ease, transform 0.2s ease;
}
.th-photo:hover .th-photo-actions, .th-photo:focus-within .th-photo-actions { opacity: 1; transform: none; }
@media (hover: none) { .th-photo-actions { opacity: 1; transform: none; } }
.th-photo-btn {
  display: inline-flex; align-items: center; gap: 4px; height: 28px; padding: 0 8px; border: 0; border-radius: 999px;
  background: rgba(16, 48, 42, 0.82); color: #F4F5EF; font: 600 11px/1 var(--font-sans); white-space: nowrap;
}
.th-photo-remove { margin-left: auto; width: 28px; justify-content: center; padding: 0; }
.th-photo-btn:hover { background: #10302A; }
.th-photo-add {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer;
  border: 2px dashed var(--line-strong); background: var(--paper-raised); color: var(--ink); font-weight: 600; font-size: 13px;
  transition: border-color 0.2s ease, transform 0.2s ease;
}
.th-photo-add:hover { border-color: var(--ink); transform: translateY(-2px); }
.th-photo-add small { color: var(--ink-muted); font: 500 11px/1 var(--font-mono); }
.th-photo-loading { display: flex; align-items: center; justify-content: center; }
.th-photo-spinner { width: 26px; height: 26px; border-radius: 50%; border: 3px solid var(--line); border-top-color: var(--emerald); animation: th-spin 0.8s linear infinite; }
.th-photo-move { transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
.th-photo-enter-active { transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.th-photo-enter-from { opacity: 0; transform: scale(0.8); }
.th-photo-leave-active { position: absolute; opacity: 0; transition: opacity 0.2s ease; }
</style>
