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

  // Set or remove the profile picture; returns the old picture's storage path (to delete it)
  async function saveAvatar(avatarUrl, avatarPath) {
    const response = await api.put('/auth/profile', { avatarUrl, avatarPath })
    user.value = { ...user.value, ...response.data.user }
    return response.data.oldAvatarPath
  }

  // Block or unblock someone; keeps user.blocked (a list of ids) up to date
  async function toggleBlock(id) {
    const { data } = await api.post(`/users/${id}/block`)
    const others = (user.value.blocked || []).filter((b) => String(b) !== String(id))
    user.value = { ...user.value, blocked: data.blocked ? [...others, id] : others }
    return data.blocked
  }

  return { user, loaded, fetchUser, login, register, logout, saveWants, saveAvatar, toggleBlock }
})
