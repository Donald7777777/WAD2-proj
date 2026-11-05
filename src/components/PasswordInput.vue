<script setup>
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'

// A password box with an eye button to peek at what you typed.
// Pass the usual input attributes (id, autocomplete, required, minlength...); they go to the input.
defineOptions({ inheritAttrs: false })
const model = defineModel({ type: String, default: '' })
const shown = ref(false)
</script>

<template>
  <div class="th-password">
    <input v-bind="$attrs" v-model="model" :type="shown ? 'text' : 'password'" class="form-control" />
    <button
      type="button"
      class="th-password-eye"
      :aria-label="shown ? 'Hide characters' : 'Show characters'"
      :aria-pressed="shown"
      @click="shown = !shown"
    >
      <AppIcon :name="shown ? 'eyeoff' : 'eye'" :size="20" />
    </button>
  </div>
</template>

<style>
.th-password { position: relative; }
.th-password .form-control { padding-right: 48px; }
.th-password-eye {
  position: absolute; top: 50%; right: 4px; display: inline-grid; place-items: center; width: 40px; height: 40px;
  margin-top: -20px; border: 0; border-radius: var(--radius-pill); background: transparent; color: var(--ink-muted);
  transition: background 160ms ease, color 160ms ease, transform 160ms ease;
}
.th-password-eye:hover { background: var(--paper-sunk); color: var(--ink); }
.th-password-eye:active { transform: scale(0.94); }
.th-password-eye:focus-visible { outline: 2px solid var(--ink); outline-offset: 1px; }
</style>
