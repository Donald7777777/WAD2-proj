<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/api'

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
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }
  loading.value = true
  try {
    await auth.register(name.value, email.value, password.value)
    // New users set their wants first so matching works
    router.push('/profile')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-4">
      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h1 class="h4 mb-3">Create an account</h1>
          <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
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
              <input id="password" v-model="password" type="password" class="form-control" minlength="6" required />
              <div class="form-text">At least 6 characters.</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="confirm">Confirm password</label>
              <input id="confirm" v-model="confirmPassword" type="password" class="form-control" required />
            </div>
            <button class="btn btn-success w-100" type="submit" :disabled="loading">Sign up</button>
          </form>
          <p class="small mt-3 mb-0">
            Already have an account? <RouterLink to="/login">Log in</RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
