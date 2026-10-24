<script setup>
import { ref, computed } from 'vue'
import { useWidth, bezierPoint, toPath } from '@/lib/useWidth'

// Five-step progress for one trade, drawn as one long smile that fills up as the deal comes together.
// Steps before `current` are done; `current` is in progress.
const props = defineProps({
  current: { type: Number, required: true },
})

const steps = ['Proposed', 'Accepted', 'Meetup set', 'Inspected', 'Traded']
const HEIGHT = 58

const box = ref(null)
const width = useWidth(box, 600)

// The smile curve (same shape as the logo) at the real pixel size
const curve = computed(() => {
  const w = width.value
  return [
    [10, 10],
    [w * 0.24, HEIGHT],
    [w * 0.76, HEIGHT],
    [w - 10, 10],
  ]
})

// Place the five dots evenly by distance along the curve, so they line up with the fill
const nodes = computed(() => {
  const samples = 240
  const points = Array.from({ length: samples + 1 }, (_, i) => bezierPoint(curve.value, i / samples))
  const lengths = [0]
  for (let i = 1; i <= samples; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]))
  }
  const total = lengths[samples]
  return steps.map((_, i) => {
    const index = lengths.findIndex((l) => l >= (total * i) / (steps.length - 1) - 0.01)
    const [x, y] = points[index === -1 ? samples : index]
    return { left: `${x}px`, top: `${y}px` }
  })
})

// How much of the smile is filled: up to the step in progress (all of it once traded)
const fill = computed(() => Math.min(props.current, steps.length - 1) / (steps.length - 1))
</script>

<template>
  <div ref="box" class="th-arcline">
    <svg class="th-arcline-svg" :width="width" :height="HEIGHT" :viewBox="`0 0 ${width} ${HEIGHT}`" aria-hidden="true">
      <defs>
        <linearGradient id="th-arcline-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#C8F26A" />
          <stop offset="55%" stop-color="#7ED6B3" />
          <stop offset="100%" stop-color="#2FA39A" />
        </linearGradient>
      </defs>
      <path class="th-arcline-track" :d="toPath(curve)" />
      <path class="th-arcline-fill" :d="toPath(curve)" pathLength="1" :style="{ strokeDashoffset: 1 - fill }" />
    </svg>

    <ol class="th-timeline" :aria-label="`Trade progress: step ${Math.min(current + 1, steps.length)} of ${steps.length}`">
      <li
        v-for="(step, index) in steps"
        :key="step"
        class="th-step"
        :style="nodes[index]"
        :data-state="index < current ? 'done' : index === current ? 'now' : null"
        :aria-current="index === current ? 'step' : null"
      >
        <span class="th-step-bar"></span>
        <span class="th-step-label">{{ step }}</span>
      </li>
    </ol>
  </div>
</template>
