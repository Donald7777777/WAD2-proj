<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import UserAvatar from '@/components/UserAvatar.vue'
import RatingSummary from '@/components/RatingSummary.vue'
import AppIcon from '@/components/AppIcon.vue'

// Find other traders by name (results update as you type)
const route = useRoute()
const router = useRouter()
const search = ref(route.query.q || '')
const people = ref([])
const searched = ref(false)
const loading = ref(false)
const error = ref('')
const input = ref(null)

let timer = null
async function run() {
  const text = search.value.trim()
  router.replace({ query: text ? { q: text } : {} })
  if (!text) {
    people.value = []
    searched.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/users', { params: { search: text } })
    people.value = data
    searched.value = true
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(run, 250)
})
onMounted(() => {
  input.value?.focus()
  if (search.value) run()
})
</script>

<template>
  <div class="th-page-head">
    <div>
      <h1>Find people</h1>
      <p>Search for other traders by name to see their listings and reviews.</p>
    </div>
  </div>

  <label class="th-search mb-4">
    <AppIcon name="search" />
    <input ref="input" v-model="search" type="search" placeholder="Search by name, e.g. Daniel" aria-label="Search people by name" />
    <span v-if="loading" class="th-photo-spinner" style="width: 20px; height: 20px; border-width: 2px"></span>
  </label>

  <div v-if="error" class="alert alert-danger">{{ error }}</div>
  <div v-if="searched && !people.length && !loading" class="th-empty">
    <strong>No one called "{{ search }}"</strong>
    <p>Check the spelling, or try just their first name.</p>
  </div>
  <div v-else-if="!searched" class="th-empty">
    <AppIcon name="user" :size="28" />
    <strong>Who are you looking for?</strong>
    <p>Start typing a name.</p>
  </div>

  <TransitionGroup name="th-photo" tag="div" class="th-people">
    <RouterLink v-for="person in people" :key="person._id" :to="`/users/${person._id}`" class="card th-person">
      <UserAvatar :name="person.name" :src="person.avatarUrl" size="lg" />
      <span class="th-person-text">
        <b>{{ person.name }}</b>
        <RatingSummary :rating="person.rating" :size="14" />
        <span class="th-muted small">{{ person.listingCount }} item{{ person.listingCount === 1 ? '' : 's' }} up for trade</span>
      </span>
      <AppIcon name="chevron" :size="20" class="th-muted" />
    </RouterLink>
  </TransitionGroup>
</template>

<style>
.th-people { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.th-person {
  flex-direction: row; align-items: center; gap: 14px; padding: 14px 16px; text-decoration: none; color: var(--ink);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, border-color 0.2s ease;
}
.th-person:hover { color: var(--ink); transform: translateY(-2px); box-shadow: var(--shadow-pop); border-color: var(--line-strong); }
.th-person-text { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.th-person-text b { font-size: 16px; }
</style>
