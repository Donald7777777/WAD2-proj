<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import { deleteImage } from '@/lib/storage'
import { CATEGORIES, CONDITIONS } from '@/lib/constants'
import PhotoUploader from '@/components/PhotoUploader.vue'

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
  // All photos as { path, url }; the first is the cover
  images: [],
})
// Photos the listing had when the page opened, so removed ones can be deleted from storage on save
const originalPaths = ref([])
const loaded = ref(!isEdit.value)
const error = ref('')
const saving = ref(false)
const photosUploading = ref(false)


async function save() {
  error.value = ''
  saving.value = true
  try {
    let response
    if (isEdit.value) {
      response = await api.put(`/listings/${route.params.id}`, form.value)
      // Remove the old photo from storage if it was replaced
      // Remove photos that were taken out of the listing from Supabase Storage
      const kept = new Set(form.value.images.map((img) => img.path))
      originalPaths.value.filter((path) => path && !kept.has(path)).forEach((path) => deleteImage(path).catch(() => {}))
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
      // Older listings only have one photo (imageUrl); newer ones have the images list
      images: listing.images?.length
        ? listing.images.map((img) => ({ path: img.path, url: img.url }))
        : listing.imageUrl
          ? [{ path: listing.imagePath, url: listing.imageUrl }]
          : [],
    }
    originalPaths.value = form.value.images.map((img) => img.path)
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
        <label class="form-label">Photos</label>
        <PhotoUploader v-model="form.images" folder="listings" :max="6" @busy="photosUploading = $event" />
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
        <button class="btn btn-primary" type="submit" :disabled="saving || photosUploading">
          {{ photosUploading ? 'Uploading photos…' : isEdit ? 'Save changes' : 'Create listing' }}
        </button>
      </div>
    </form>
  </div>
</template>
