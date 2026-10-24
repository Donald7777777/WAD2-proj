<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/api'
import { CATEGORIES } from '@/lib/constants'
import UserAvatar from '@/components/UserAvatar.vue'
import AppIcon from '@/components/AppIcon.vue'

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
  <div class="th-narrow">
    <div class="th-profile-head">
      <UserAvatar :name="auth.user.name" you size="lg" />
      <div>
        <h1>{{ auth.user.name }}</h1>
        <p>{{ auth.user.email }}</p>
      </div>
    </div>

    <section class="card th-panel">
      <h2>What are you looking for?</h2>
      <p class="th-muted">
        Add categories or keywords (e.g. "film lens", "turntable"). We use these to find matches for you.
      </p>

      <form class="th-search th-search-sm mb-3" @submit.prevent="addWant()">
        <AppIcon name="search" />
        <input v-model="newWant" placeholder="Add a keyword" aria-label="Add a keyword" />
        <button class="btn btn-primary btn-sm" type="submit">Add</button>
      </form>

      <div class="mb-2"><span class="eyebrow th-muted">Quick add</span></div>
      <div class="th-chips mb-4">
        <button v-for="c in CATEGORIES" :key="c" type="button" class="th-chip" @click="addWant(c)">
          <AppIcon name="plus" :size="16" />{{ c }}
        </button>
      </div>

      <div class="mb-2"><span class="eyebrow th-muted">Your wants</span></div>
      <div class="th-wants mb-4">
        <p v-if="wants.length === 0" class="th-muted small mb-0">Nothing added yet.</p>
        <span v-for="(want, index) in wants" :key="want" class="th-want">
          {{ want }}
          <button type="button" :aria-label="`Remove ${want}`" @click="removeWant(index)">
            <AppIcon name="x" :size="14" />
          </button>
        </span>
      </div>

      <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>
      <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
      <div>
        <button class="btn btn-primary" @click="save">Save wants</button>
      </div>
    </section>
  </div>
</template>
