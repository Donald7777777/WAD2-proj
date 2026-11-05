<script setup>
import PasswordInput from '@/components/PasswordInput.vue'
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '@/lib/api'
import { showToast } from '@/lib/toast'
import { passwordProblem, PASSWORD_HINT } from '@/lib/validation'
import logoMark from '@/assets/logo-mark.svg'

// Choose a new password from a reset link (/reset-password?token=...)
const route = useRoute()
const router = useRouter()
const password = ref('')
const repeat = ref('')
const error = ref('')
const loading = ref(false)
const token = String(route.query.token || '')

async function submit() {
  error.value = ''
  const problem = passwordProblem(password.value)
  if (problem) {
    error.value = problem
    return
  }
  if (password.value !== repeat.value) {
    error.value = "The passwords don't match."
    return
  }
  loading.value = true
  try {
    await api.post('/auth/reset', { token, password: password.value })
    showToast('Password reset. Log in with your new password.', { icon: 'lock' })
    router.push('/login')
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
          <h1 class="th-auth-title">Choose a new password</h1>
          <div v-if="!token" class="alert alert-warning" role="alert">
            This link is missing its code. <RouterLink to="/forgot-password">Ask for a new link</RouterLink>.
          </div>
          <template v-else>
            <div v-if="error" class="alert alert-danger" role="alert">
              {{ error }} <RouterLink v-if="error.includes('expired')" to="/forgot-password">Get a new link</RouterLink>
            </div>
            <form @submit.prevent="submit">
              <div class="mb-3">
                <label class="form-label" for="password">New password</label>
                <PasswordInput id="password" v-model="password" autocomplete="new-password" required />
                <div class="form-text">{{ PASSWORD_HINT }}</div>
              </div>
              <div class="mb-3">
                <label class="form-label" for="repeat">New password again</label>
                <PasswordInput id="repeat" v-model="repeat" autocomplete="new-password" required />
              </div>
              <button class="btn btn-success w-100" type="submit" :disabled="loading">{{ loading ? 'Saving…' : 'Save new password' }}</button>
            </form>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
