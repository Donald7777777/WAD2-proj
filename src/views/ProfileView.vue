<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/api'
import { CATEGORIES } from '@/lib/constants'

const auth = useAuthStore()

// Work on a copy so changes are only kept when the user clicks Save
const wants = ref([...auth.user.wants])
const newWant = ref('')
const message = ref('')
const error = ref('')

function addWant(text) {
  const value = (text || newWant.value).trim()
  if (value && !wants.value.some((w) => w.toLowerCase() === value.toLowerCase())) {
    wants.value.push(value)
  }
  newWant.value = ''
}

function removeWant(index) {
  wants.value.splice(index, 1)
}

async function save() {
  message.value = ''
  error.value = ''
  try {
    await auth.saveWants(wants.value)
    message.value = 'Saved! Your matches on the Discover page are updated.'
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-lg-7">
      <h1 class="h4">{{ auth.user.name }}</h1>
      <p class="text-secondary">{{ auth.user.email }}</p>

      <div class="card card-body shadow-sm">
        <h2 class="h5">What are you looking for?</h2>
        <p class="small text-secondary">
          Add categories or keywords (e.g. "film lens", "turntable"). We use these to find matches for you.
        </p>

        <form class="input-group mb-2" @submit.prevent="addWant()">
          <input v-model="newWant" class="form-control" placeholder="Add a keyword" />
          <button class="btn btn-outline-success" type="submit">Add</button>
        </form>

        <div class="mb-3">
          <span class="small text-secondary me-1">Quick add:</span>
          <button
            v-for="c in CATEGORIES"
            :key="c"
            type="button"
            class="btn btn-light border btn-sm me-1 mb-1"
            @click="addWant(c)"
          >
            + {{ c }}
          </button>
        </div>

        <div class="mb-3">
          <p v-if="wants.length === 0" class="text-secondary small">Nothing added yet.</p>
          <span v-for="(want, index) in wants" :key="want" class="badge rounded-pill bg-success me-1 mb-1 p-2">
            {{ want }}
            <button
              type="button"
              class="btn-close btn-close-white ms-1"
              style="font-size: 0.6rem"
              :aria-label="`Remove ${want}`"
              @click="removeWant(index)"
            ></button>
          </span>
        </div>

        <div v-if="message" class="alert alert-success py-2">{{ message }}</div>
        <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
        <div>
          <button class="btn btn-success" @click="save">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>
