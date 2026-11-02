<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/api'
import { isValidEmail, passwordProblem, nameProblem, PASSWORD_HINT } from '@/lib/validation'
import logoMark from '@/assets/logo-mark.svg'

const auth = useAuthStore()
const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

async function register() {
  error.value = ''
  const problem =
    nameProblem(name.value) || (!isValidEmail(email.value) && 'Please enter a valid email address.') || passwordProblem(password.value)
  if (problem) {
    error.value = problem
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }
  loading.value = true
  try {
    await auth.register(name.value, email.value, password.value)
    // New users set their wants first so matching works
    router.push('/profile?tab=wants')
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
          <h1 class="th-auth-title">Create an account</h1>
          <p class="th-muted mb-4">Start swapping things you no longer use.</p>
          <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
          <form @submit.prevent="register">
            <div class="mb-3">
              <label class="form-label" for="name">Name</label>
              <input id="name" v-model.trim="name" type="text" class="form-control" required />
            </div>
            <div class="mb-3">
              <label class="form-label" for="email">Email</label>
              <input id="email" v-model.trim="email" type="email" class="form-control" required />
            </div>
            <div class="mb-3">
              <label class="form-label" for="password">Password</label>
              <input id="password" v-model="password" type="password" class="form-control" required />
              <div class="form-text">{{ PASSWORD_HINT }}</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="confirm">Confirm password</label>
              <input id="confirm" v-model="confirmPassword" type="password" class="form-control" required />
            </div>
            <button class="btn btn-success w-100" type="submit" :disabled="loading">Sign up</button>
          </form>
          <p class="small mt-4 mb-0 text-center">
            Already have an account? <RouterLink to="/login">Log in</RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
