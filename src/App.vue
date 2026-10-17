<script setup>
import { RouterView } from 'vue-router'
import NavBar from './components/NavBar.vue'
</script>

<template>
  <NavBar />
  <main class="container py-4">
    <RouterView />
  </main>
</template>

<style>
body {
  background-color: #f4f5f0;
}
</style>
