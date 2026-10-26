<script setup>
import { ref, computed } from 'vue'

// Stars out of 5. Display mode shows an average (e.g. 4.5 fills four and a half stars);
// with `editable` it becomes a picker (click, hover, or arrow keys).
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  editable: Boolean,
  size: { type: Number, default: 18 },
})
const emit = defineEmits(['update:modelValue'])

const hover = ref(0)
const shown = computed(() => hover.value || props.modelValue)
const fill = (i) => Math.max(0, Math.min(1, shown.value - (i - 1))) * 100

function pick(value) {
  if (props.editable) emit('update:modelValue', value)
}
function onKey(event) {
  if (!props.editable) return
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') pick(Math.min(5, (props.modelValue || 0) + 1))
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') pick(Math.max(1, (props.modelValue || 1) - 1))
}
const STAR = 'M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'
</script>

<template>
  <span
    class="th-stars"
    :class="{ 'is-editable': editable }"
    :role="editable ? 'slider' : 'img'"
    :aria-label="editable ? 'Rating' : `${modelValue} out of 5 stars`"
    :aria-valuemin="editable ? 1 : null"
    :aria-valuemax="editable ? 5 : null"
    :aria-valuenow="editable ? modelValue : null"
    :tabindex="editable ? 0 : null"
    @keydown="onKey"
    @mouseleave="hover = 0"
  >
    <component
      :is="editable ? 'button' : 'span'"
      v-for="i in 5"
      :key="i"
      :type="editable ? 'button' : null"
      class="th-star"
      :class="{ 'is-pop': editable && modelValue === i }"
      :tabindex="editable ? -1 : null"
      :aria-label="editable ? `${i} star${i > 1 ? 's' : ''}` : null"
      @mouseenter="editable && (hover = i)"
      @click="pick(i)"
    >
      <svg :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient :id="`th-star-${i}-${fill(i)}`">
            <stop :offset="`${fill(i)}%`" stop-color="#F5B82E" />
            <stop :offset="`${fill(i)}%`" stop-color="var(--line)" />
          </linearGradient>
        </defs>
        <path :d="STAR" :fill="`url(#th-star-${i}-${fill(i)})`" stroke="#E0A21A" stroke-width="0.8" stroke-linejoin="round" />
      </svg>
    </component>
  </span>
</template>

<style>
.th-stars { display: inline-flex; align-items: center; gap: 2px; vertical-align: middle; }
.th-stars.is-editable { gap: 6px; outline: none; }
.th-stars.is-editable:focus-visible { box-shadow: 0 0 0 3px var(--focus); border-radius: 8px; }
.th-star { display: inline-flex; padding: 0; border: 0; background: none; line-height: 0; }
.th-stars.is-editable .th-star { cursor: pointer; transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1); }
.th-stars.is-editable .th-star:hover { transform: scale(1.18); }
.th-star.is-pop svg { animation: th-heart-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
</style>
