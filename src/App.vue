<script setup>
import { RouterView, useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import ToastHost from './components/ToastHost.vue'

// The landing page (meta.bare) is full screen, without the top bar
const route = useRoute()
</script>

<template>
  <NavBar v-if="!route.meta.bare" />
  <main :class="route.meta.bare ? 'th-bare' : 'container-fluid th-page th-main'">
    <!-- Pages fade and rise in when you navigate (styles in motion.css) -->
    <RouterView v-slot="{ Component, route: current }">
      <Transition name="th-route" mode="out-in">
        <div :key="current.path">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>
  </main>
  <ToastHost />
</template>
