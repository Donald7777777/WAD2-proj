<script setup>
// Five-step progress for one trade. Steps before `current` are done; `current` is in progress.
defineProps({
  current: { type: Number, required: true },
})

const steps = ['Proposed', 'Accepted', 'Meetup set', 'Inspected', 'Traded']
</script>

<template>
  <ol class="th-timeline" :aria-label="`Trade progress: step ${Math.min(current + 1, steps.length)} of ${steps.length}`">
    <li
      v-for="(step, index) in steps"
      :key="step"
      class="th-step"
      :data-state="index < current ? 'done' : index === current ? 'now' : null"
      :aria-current="index === current ? 'step' : null"
    >
      <span class="th-step-bar"></span>
      <span class="th-step-label">{{ step }}</span>
    </li>
  </ol>
</template>
