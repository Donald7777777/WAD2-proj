<script setup>
// The TradeHappy logo drawn inline so it can animate.
// Lime dot = you, mint dot = the other trader, the smile = the swap between you.
// On hover (of the logo link) the line grows out of your dot, swings through the smile
// and reaches the other dot. Styles live in motion.css (.th-mark).
defineProps({
  size: { type: Number, default: 32 },
})
</script>

<template>
  <svg class="th-mark" :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="th-mark-link" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#C8F26A" />
        <stop offset="100%" stop-color="#7ED6B3" />
      </linearGradient>
    </defs>
    <rect class="th-mark-bg" width="64" height="64" rx="18" />
    <g transform="translate(7.04 6.65) scale(0.78)">
      <!-- Resting smile with swap arrowheads -->
      <g class="th-mark-smile">
        <path d="M13 37 C19 52 45 52 51 37" fill="none" stroke="#F4F5EF" stroke-width="5" stroke-linecap="round" />
        <path
          d="M8.5 37.5 L13 31.5 L18.5 36.5 Z M55.5 37.5 L51 31.5 L45.5 36.5 Z"
          fill="#F4F5EF"
          stroke="#F4F5EF"
          stroke-width="2.5"
          stroke-linejoin="round"
        />
      </g>
      <!-- Hover: one line leaves your dot, runs along the smile and climbs into theirs -->
      <path
        class="th-mark-link"
        d="M22 24 C17 28 13 32 13 37 C19 52 45 52 51 37 C51 32 47 28 42 24"
        pathLength="1"
        fill="none"
        stroke="url(#th-mark-link)"
        stroke-width="5"
        stroke-linecap="round"
      />
      <circle class="th-mark-dot th-mark-you" cx="22" cy="24" r="7" fill="#C8F26A" />
      <circle class="th-mark-dot th-mark-them" cx="42" cy="24" r="7" fill="#7ED6B3" />
    </g>
  </svg>
</template>
