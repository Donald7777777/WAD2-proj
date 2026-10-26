<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/api'
import logoMark from '@/assets/logo-mark.svg'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function login() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    // Go back to the page the user was trying to open, or home
    router.push(route.query.redirect || '/discover')
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
          <h1 class="th-auth-title">Log in</h1>
          <p class="th-muted mb-4">Welcome back. Your trades are waiting.</p>
          <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
          <form @submit.prevent="login">
            <div class="mb-3">
              <label class="form-label" for="email">Email</label>
              <input id="email" v-model.trim="email" type="email" class="form-control" required />
            </div>
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-baseline">
                <label class="form-label" for="password">Password</label>
                <RouterLink to="/forgot-password" class="small">Forgot password?</RouterLink>
              </div>
              <input id="password" v-model="password" type="password" class="form-control" autocomplete="current-password" required />
            </div>
            <button class="btn btn-success w-100" type="submit" :disabled="loading">Log in</button>
          </form>
          <p class="small mt-4 mb-0 text-center">
            No account yet? <RouterLink to="/register">Sign up</RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
