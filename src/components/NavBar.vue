<script setup>
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppIcon from './AppIcon.vue'
import UserAvatar from './UserAvatar.vue'
import LogoMark from './LogoMark.vue'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <!-- Top bar: every screen size -->
  <header class="th-topbar">
    <div class="container-fluid th-page th-topbar-inner">
      <RouterLink class="th-logo" to="/discover" aria-label="TradeHappy home">
        <LogoMark :size="32" />
        <span class="th-logo-word">Trade<em>Happy</em></span>
      </RouterLink>

      <!-- Desktop links (the mobile tab bar below covers these on small screens) -->
      <nav class="th-topnav d-none d-lg-flex" aria-label="Main">
        <RouterLink to="/discover" class="th-topnav-link" exact-active-class="is-active">Discover</RouterLink>
        <template v-if="auth.user">
          <RouterLink to="/my-listings" class="th-topnav-link" active-class="is-active">My listings</RouterLink>
          <RouterLink to="/trades" class="th-topnav-link" active-class="is-active">My trades</RouterLink>
        </template>
      </nav>

      <div class="th-topbar-actions">
        <template v-if="auth.user">
          <RouterLink class="btn btn-offer btn-sm d-none d-lg-inline-flex" to="/listings/new">
            <AppIcon name="plus" :size="16" />List an item
          </RouterLink>

          <div class="dropdown">
            <button
              class="th-account-btn"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              :aria-label="`Account menu for ${auth.user.name}`"
            >
              <UserAvatar :name="auth.user.name" you />
              <span class="d-none d-lg-inline">{{ auth.user.name }}</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end th-menu">
              <li><RouterLink class="dropdown-item" to="/profile"><AppIcon name="user" :size="18" />Profile and wants</RouterLink></li>
              <li><RouterLink class="dropdown-item" to="/my-listings"><AppIcon name="box" :size="18" />My listings</RouterLink></li>
              <li><hr class="dropdown-divider" /></li>
              <li>
                <button class="dropdown-item" type="button" @click="logout"><AppIcon name="logout" :size="18" />Log out</button>
              </li>
            </ul>
          </div>
        </template>
        <template v-else>
          <RouterLink class="btn btn-ghost btn-sm" to="/login">Log in</RouterLink>
          <RouterLink class="btn btn-primary btn-sm" to="/register">Sign up</RouterLink>
        </template>
      </div>
    </div>
  </header>

  <!-- Bottom tab bar: phones and tablets, logged-in users -->
  <nav v-if="auth.user" class="th-tabbar d-lg-none" aria-label="Main">
    <RouterLink to="/discover" class="th-tab" exact-active-class="is-active">
      <AppIcon name="discover" />Discover
    </RouterLink>
    <RouterLink to="/trades" class="th-tab" active-class="is-active">
      <AppIcon name="swap" />Trades
    </RouterLink>
    <RouterLink to="/listings/new" class="th-tab th-tab-new" aria-label="List an item">
      <span class="th-tab-new-btn"><AppIcon name="plus" /></span>List
    </RouterLink>
    <RouterLink to="/my-listings" class="th-tab" active-class="is-active">
      <AppIcon name="box" />Listings
    </RouterLink>
    <RouterLink to="/profile" class="th-tab" active-class="is-active">
      <AppIcon name="user" />Profile
    </RouterLink>
  </nav>
</template>
