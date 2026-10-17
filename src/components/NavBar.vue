<script setup>
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <nav class="navbar navbar-expand-md navbar-dark bg-dark">
    <div class="container">
      <RouterLink class="navbar-brand fw-bold" to="/">
        Trade<span class="text-success">Happy</span>
      </RouterLink>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#mainNav"
        aria-controls="mainNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div id="mainNav" class="collapse navbar-collapse">
        <ul class="navbar-nav me-auto">
          <li class="nav-item"><RouterLink class="nav-link" to="/">Discover</RouterLink></li>
          <template v-if="auth.user">
            <li class="nav-item"><RouterLink class="nav-link" to="/my-listings">My listings</RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link" to="/trades">My trades</RouterLink></li>
          </template>
        </ul>

        <ul class="navbar-nav align-items-md-center">
          <template v-if="auth.user">
            <li class="nav-item">
              <RouterLink class="btn btn-success btn-sm me-md-2 my-2 my-md-0" to="/listings/new">
                + New listing
              </RouterLink>
            </li>
            <li class="nav-item"><RouterLink class="nav-link" to="/profile">{{ auth.user.name }}</RouterLink></li>
            <li class="nav-item">
              <button class="btn btn-link nav-link" @click="logout">Log out</button>
            </li>
          </template>
          <template v-else>
            <li class="nav-item"><RouterLink class="nav-link" to="/login">Log in</RouterLink></li>
            <li class="nav-item"><RouterLink class="nav-link" to="/register">Sign up</RouterLink></li>
          </template>
        </ul>
      </div>
    </div>
  </nav>
</template>
