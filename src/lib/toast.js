import { reactive } from 'vue'

// Tiny notification system. Call showToast('Trade accepted!') from anywhere;
// <ToastHost /> in App.vue displays them.
export const toasts = reactive([])

let nextId = 1

// tone: 'success' (green), 'info' (neutral) or 'danger' (red)
export function showToast(text, { tone = 'success', icon = 'check', duration = 3500 } = {}) {
  const id = nextId++
  toasts.push({ id, text, tone, icon })
  setTimeout(() => dismissToast(id), duration)
}

export function dismissToast(id) {
  const index = toasts.findIndex((t) => t.id === id)
  if (index !== -1) toasts.splice(index, 1)
}
