<script setup>
import { toasts, dismissToast } from '@/lib/toast'
import AppIcon from './AppIcon.vue'
</script>

<template>
  <div class="th-toasts" aria-live="polite">
    <TransitionGroup name="th-toast">
      <div v-for="toast in toasts" :key="toast.id" class="th-toast" :data-tone="toast.tone" role="status">
        <span class="th-toast-icon"><AppIcon :name="toast.icon" :size="18" /></span>
        <span class="th-toast-text">{{ toast.text }}</span>
        <button type="button" class="th-toast-close" aria-label="Dismiss" @click="dismissToast(toast.id)">
          <AppIcon name="x" :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
