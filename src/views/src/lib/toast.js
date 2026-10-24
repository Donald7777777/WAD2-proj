import { reactive } from 'vue'

// Tiny notification system. Call showToast('Trade accepted!') from anywhere;
// <ToastHost /> in App.vue displays them.
export const toasts = reactive([])

let nextId = 1

// tone: 'success' (green), 'info' (neutral) or 'danger' (red)
// title: optional bold first line; onClick: makes the toast clickable (e.g. open the trade)
export function showToast(text, { tone = 'success', icon = 'check', duration = 3500, title = '', onClick = null } = {}) {
  const id = nextId++
  // Keep at most 3 on screen
  if (toasts.length >= 3) toasts.shift()
  toasts.push({ id, text, tone, icon, title, onClick })
  setTimeout(() => dismissToast(id), duration)
}

export function dismissToast(id) {
  const index = toasts.findIndex((t) => t.id === id)
  if (index !== -1) toasts.splice(index, 1)
}
