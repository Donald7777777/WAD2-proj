<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import logoMark from '@/assets/logo-mark.svg'

// Forgot password: ask for a reset link.
// There's no email service yet, so the server prints the link in its terminal. While developing,
// it also sends the link back, and we show it here so the demo works.
const email = ref('')
const sent = ref(false)
const devLink = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const { data } = await api.post('/auth/forgot', { email: email.value })
    sent.value = true
    devLink.value = data.devResetLink || ''
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="th-auth">
    <div>
      <div class="card th-auth-card">
        <div class="card-body">
          <img :src="logoMark" width="48" height="48" alt="" class="mb-3" />
          <h1 class="th-auth-title">Forgot your password?</h1>
          <template v-if="!sent">
            <p class="th-muted mb-4">Enter your email and we'll send you a link to choose a new one.</p>
            <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
            <form @submit.prevent="submit">
              <div class="mb-3">
                <label class="form-label" for="email">Email</label>
                <input id="email" v-model.trim="email" type="email" class="form-control" autocomplete="email" required />
              </div>
              <button class="btn btn-success w-100" type="submit" :disabled="loading">{{ loading ? 'Sending…' : 'Send reset link' }}</button>
            </form>
          </template>
          <template v-else>
            <p class="th-muted">If <b>{{ email }}</b> has an account, a reset link is on its way. It works for 30 minutes.</p>
            <div v-if="devLink" class="th-devlink" role="status">
              <span class="eyebrow">Demo mode: no email service yet</span>
              <RouterLink :to="devLink" class="btn btn-primary w-100 mt-2">Open the reset link</RouterLink>
            </div>
          </template>
          <p class="small mt-4 mb-0 text-center"><RouterLink to="/login">Back to log in</RouterLink></p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.th-devlink { margin-top: 12px; padding: 12px; border-radius: var(--radius-md); background: var(--lagoon-soft); }
</style>
