<script setup>
import { toasts, dismissToast } from '@/lib/toast'
import AppIcon from './AppIcon.vue'

function open(toast) {
  if (!toast.onClick) return
  toast.onClick()
  dismissToast(toast.id)
}
</script>

<template>
  <div class="th-toasts" aria-live="polite">
    <TransitionGroup name="th-toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="th-toast"
        :class="{ 'is-clickable': toast.onClick }"
        :data-tone="toast.tone"
        role="status"
        @click="open(toast)"
      >
        <span class="th-toast-icon"><AppIcon :name="toast.icon" :size="18" /></span>
        <span class="th-toast-text">
          <b v-if="toast.title" class="th-toast-title">{{ toast.title }}</b>
          {{ toast.text }}
        </span>
        <button type="button" class="th-toast-close" aria-label="Dismiss" @click.stop="dismissToast(toast.id)">
          <AppIcon name="x" :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
