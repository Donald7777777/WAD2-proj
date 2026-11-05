<script setup>
import PasswordInput from '@/components/PasswordInput.vue'
import { ref, onMounted, onUnmounted } from 'vue'
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

// After 5 wrong passwords in a row, the Log in button is locked for 30 seconds.
// The count and lock time are kept in localStorage, so reloading the page doesn't skip the wait.
const MAX_TRIES = 5
const LOCK_SECONDS = 30
const secondsLeft = ref(0)
let timer = null

function readLock() {
  try {
    return JSON.parse(localStorage.getItem('th-login-lock')) || { fails: 0, until: 0 }
  } catch {
    return { fails: 0, until: 0 }
  }
}
function saveLock(lock) {
  try {
    localStorage.setItem('th-login-lock', JSON.stringify(lock))
  } catch {
    // Private browsing: the lock still works until the page is reloaded
  }
}

// Count down once a second while locked
function tick() {
  const { until } = readLock()
  secondsLeft.value = Math.max(0, Math.ceil((until - Date.now()) / 1000))
  if (!secondsLeft.value) {
    clearInterval(timer)
    timer = null
  }
}
function startCountdown() {
  tick()
  if (secondsLeft.value && !timer) timer = setInterval(tick, 1000)
}
onMounted(startCountdown)
onUnmounted(() => clearInterval(timer))

async function login() {
  if (secondsLeft.value) return
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    saveLock({ fails: 0, until: 0 })
    // Go back to the page the user was trying to open, or home
    router.push(route.query.redirect || '/discover')
  } catch (e) {
    error.value = errorMessage(e)
    // 401 = wrong email or password (not a network problem)
    if (e.response?.status === 401) {
      const lock = readLock()
      lock.fails++
      if (lock.fails >= MAX_TRIES) {
        saveLock({ fails: 0, until: Date.now() + LOCK_SECONDS * 1000 })
        error.value = `Too many wrong tries. Please wait ${LOCK_SECONDS} seconds before trying again.`
        startCountdown()
      } else {
        saveLock(lock)
        const left = MAX_TRIES - lock.fails
        if (left <= 2) error.value += ` ${left} ${left === 1 ? 'try' : 'tries'} left before a ${LOCK_SECONDS}-second wait.`
      }
    }
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
              <PasswordInput id="password" v-model="password" autocomplete="current-password" required />
            </div>
            <button class="btn btn-success w-100" type="submit" :disabled="loading || secondsLeft > 0">
              {{ secondsLeft ? `Try again in ${secondsLeft}s` : 'Log in' }}
            </button>
          </form>
          <p class="small mt-4 mb-0 text-center">
            No account yet? <RouterLink to="/register">Sign up</RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
