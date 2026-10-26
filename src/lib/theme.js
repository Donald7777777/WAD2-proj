import { ref } from 'vue'

// Light / dark theme. The design tokens (tokens.css) switch with data-theme on <html>.
// Your choice is remembered on this device; the default is light.
const KEY = 'th-theme'
export const theme = ref('light')

function apply(value) {
  theme.value = value === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme.value
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.value === 'dark' ? '#0D1916' : '#F4F5EF')
}

export function initTheme() {
  let saved = 'light'
  try {
    saved = localStorage.getItem(KEY) || 'light'
  } catch {
    // Private mode etc.: stay light
  }
  apply(saved)
}

export function toggleTheme() {
  apply(theme.value === 'dark' ? 'light' : 'dark')
  try {
    localStorage.setItem(KEY, theme.value)
  } catch {
    // Not saved, but still switched for now
  }
}
