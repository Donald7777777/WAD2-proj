<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/api'

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
    router.push(route.query.redirect || '/')
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
          <h1 class="h4 mb-3">Log in</h1>
          <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
          <form @submit.prevent="login">
            <div class="mb-3">
              <label class="form-label" for="email">Email</label>
              <input id="email" v-model.trim="email" type="email" class="form-control" required />
            </div>
            <div class="mb-3">
              <label class="form-label" for="password">Password</label>
              <input id="password" v-model="password" type="password" class="form-control" required />
            </div>
            <button class="btn btn-success w-100" type="submit" :disabled="loading">Log in</button>
          </form>
          <p class="small mt-3 mb-0">
            No account yet? <RouterLink to="/register">Sign up</RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
