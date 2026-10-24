import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api'

// Keeps track of the logged-in user so every page can use it
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loaded = ref(false)

  // Ask the server who is logged in (the session cookie is sent automatically)
  async function fetchUser() {
    const response = await api.get('/auth/me')
    user.value = response.data
    loaded.value = true
  }

  async function login(email, password) {
    const response = await api.post('/auth/login', { email, password })
    user.value = response.data
  }

  async function register(name, email, password) {
    const response = await api.post('/auth/register', { name, email, password })
    user.value = response.data
  }

  async function logout() {
    await api.post('/auth/logout')
    user.value = null
  }

  async function saveWants(wants) {
    const response = await api.put('/auth/wants', { wants })
    user.value = response.data
  }

  return { user, loaded, fetchUser, login, register, logout, saveWants }
})
