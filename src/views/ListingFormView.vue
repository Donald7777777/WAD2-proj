<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import { deleteImage } from '@/lib/storage'
import { CATEGORIES, CONDITIONS } from '@/lib/constants'
import ImageUploader from '@/components/ImageUploader.vue'

const route = useRoute()
const router = useRouter()

// The same page is used for /listings/new and /listings/:id/edit
const isEdit = computed(() => Boolean(route.params.id))

const form = ref({
  title: '',
  description: '',
  category: '',
  condition: '',
  lookingFor: '',
  imagePath: '',
  imageUrl: '',
})
const originalImagePath = ref('')
const loaded = ref(!isEdit.value)
const error = ref('')
const saving = ref(false)

function onUploaded(result) {
  form.value.imagePath = result.path
  form.value.imageUrl = result.url
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    let response
    if (isEdit.value) {
      response = await api.put(`/listings/${route.params.id}`, form.value)
      // Remove the old photo from storage if it was replaced
      if (originalImagePath.value && originalImagePath.value !== form.value.imagePath) {
        deleteImage(originalImagePath.value).catch(() => {})
      }
    } else {
      response = await api.post('/listings', form.value)
    }
    router.push(`/listings/${response.data._id}`)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (!isEdit.value) return
  try {
    const response = await api.get(`/listings/${route.params.id}`)
    const listing = response.data
    form.value = {
      title: listing.title,
      description: listing.description,
      category: listing.category,
      condition: listing.condition,
      lookingFor: listing.lookingFor,
      imagePath: listing.imagePath,
      imageUrl: listing.imageUrl,
    }
    originalImagePath.value = listing.imagePath
    loaded.value = true
  } catch (e) {
    error.value = errorMessage(e)
  }
})
</script>

<template>
  <div class="th-narrow">
    <div class="th-page-head">
      <div>
        <h1>{{ isEdit ? 'Edit listing' : 'List an item' }}</h1>
        <p>Good photos and an honest condition get you better matches.</p>
      </div>
    </div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <form v-if="loaded" class="card th-panel" @submit.prevent="save">
      <div class="mb-4">
        <label class="form-label">Photo</label>
        <ImageUploader folder="listings" :initial-url="form.imageUrl" @uploaded="onUploaded" />
      </div>

      <div class="mb-3">
        <label class="form-label" for="title">Title</label>
        <input id="title" v-model.trim="form.title" class="form-control" placeholder="e.g. Canon AE-1 Program" required />
      </div>

      <div class="row g-3 mb-3">
        <div class="col-sm-6">
          <label class="form-label" for="category">Category</label>
          <select id="category" v-model="form.category" class="form-select" required>
            <option disabled value="">Choose…</option>
            <option v-for="c in CATEGORIES" :key="c">{{ c }}</option>
          </select>
        </div>
        <div class="col-sm-6">
          <label class="form-label" for="condition">Condition</label>
          <select id="condition" v-model="form.condition" class="form-select" required>
            <option disabled value="">Choose…</option>
            <option v-for="c in CONDITIONS" :key="c">{{ c }}</option>
          </select>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="description">Description</label>
        <textarea
          id="description"
          v-model="form.description"
          class="form-control"
          rows="4"
          placeholder="What it is, how old, anything that's worn or missing."
          required
        ></textarea>
      </div>

      <div class="mb-4">
        <label class="form-label" for="looking-for">What would you take for it? <span class="th-muted fw-normal">(optional)</span></label>
        <input id="looking-for" v-model.trim="form.lookingFor" class="form-control" placeholder="e.g. film lenses, turntable" />
        <div class="form-text">We use this to match you with people who have it.</div>
      </div>

      <div class="th-form-actions">
        <button class="btn btn-link" type="button" @click="router.back()">Cancel</button>
        <button class="btn btn-primary" type="submit" :disabled="saving">
          {{ isEdit ? 'Save changes' : 'Create listing' }}
        </button>
      </div>
    </form>
  </div>
</template>
