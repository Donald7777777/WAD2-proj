<script setup>
import { ref } from 'vue'
import { uploadImage } from '@/lib/storage'

const props = defineProps({
  folder: { type: String, default: 'listings' },
  // Show an existing photo (e.g. when editing a listing)
  initialUrl: { type: String, default: '' },
  // Hide the preview (e.g. in the chat box, where the photo is sent straight away)
  showPreview: { type: Boolean, default: true },
})
const emit = defineEmits(['uploaded'])

const uploading = ref(false)
const error = ref('')
const previewUrl = ref(props.initialUrl)

async function onFileChange(event) {
  const file = event.target.files[0]
  if (!file) return

  error.value = ''
  uploading.value = true
  try {
    const result = await uploadImage(file, props.folder)
    previewUrl.value = result.url
    emit('uploaded', result)
  } catch (e) {
    error.value = e.message
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}
</script>

<template>
  <div>
    <input type="file" class="form-control th-file" accept="image/*" :disabled="uploading" @change="onFileChange" />
    <div v-if="uploading" class="form-text">Uploading…</div>
    <div v-if="error" class="th-field-error">{{ error }}</div>
    <img v-if="showPreview && previewUrl" :src="previewUrl" alt="Uploaded photo" class="th-upload-preview mt-3" />
  </div>
</template>

<style scoped>
.th-upload-preview {
  display: block;
  width: 100%;
  max-width: 280px;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
}
</style>
