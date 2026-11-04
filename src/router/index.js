import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Landing page with the giant interactive logo; click the smile to enter
    { path: '/', name: 'landing', component: () => import('../views/LandingView.vue'), meta: { bare: true } },
    // Discover (browse + matches) is the app's home page
    { path: '/discover', name: 'home', component: HomeView },
    // The dashboard lives on your profile now (old links still work)
    { path: '/home', redirect: '/profile' },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue') },
    { path: '/forgot-password', name: 'forgot', component: () => import('../views/ForgotPasswordView.vue') },
    { path: '/reset-password', name: 'reset', component: () => import('../views/ResetPasswordView.vue') },
    {
      path: '/account',
      name: 'account',
      component: () => import('../views/AccountView.vue'),
      meta: { requiresAuth: true },
    },

    // Feature 1: listings & matching
    {
      path: '/listings/new',
      name: 'new-listing',
      component: () => import('../views/ListingFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/listings/:id/edit',
      name: 'edit-listing',
      component: () => import('../views/ListingFormView.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/listings/:id', name: 'listing', component: () => import('../views/ListingDetailView.vue') },
    {
      path: '/my-listings',
      name: 'my-listings',
      component: () => import('../views/MyListingsView.vue'),
      meta: { requiresAuth: true },
    },
    // People: search and public profiles (rating, reviews, listings)
    { path: '/people', name: 'people', component: () => import('../views/PeopleView.vue') },
    // Profiles: one page for everyone. Your own (/profile) also shows your private tabs.
    {
      path: '/users/:id',
      name: 'user',
      component: () => import('../views/ProfileView.vue'),
      // Your own id goes to /profile, so there's only ever one "you" page
      beforeEnter: (to) => {
        const auth = useAuthStore()
        if (auth.user && to.params.id === auth.user._id) return { path: '/profile', query: to.query }
      },
    },
    {
      path: '/activity',
      name: 'activity',
      component: () => import('../views/ActivityView.vue'),
      meta: { requiresAuth: true },
    },
    // Liked and saved items now live in tabs on the Profile page
    {
      path: '/saved',
      redirect: (to) => ({ path: '/profile', query: { tab: to.query.tab === 'liked' ? 'liked' : 'saved' } }),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },

    // Feature 2: proposals; features 3-5 (chat, meetup, checklist) live on the trade page
    {
      path: '/listings/:id/propose',
      name: 'propose',
      component: () => import('../views/ProposeTradeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/trades',
      name: 'trades',
      component: () => import('../views/TradesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/trades/:id/:section(chat|meetup|checklist)',
      name: 'trade-section',
      component: () => import('../views/TradeDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/trades/:id',
      name: 'trade',
      component: () => import('../views/TradeDetailView.vue'),
      meta: { requiresAuth: true },
    },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// Send logged-out users to the login page for pages that need an account
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loaded) {
    try {
      await auth.fetchUser()
    } catch {
      // Server not reachable; treat as logged out
    }
  }
  if (to.meta.requiresAuth && !auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
})

export default router
