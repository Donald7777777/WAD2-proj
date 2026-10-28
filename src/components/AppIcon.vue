<script setup>
// Line icons in the TradeHappy style (24px grid, 1.75 stroke, round caps).
// Decorative by default; pass `label` when the icon is the only content of a control.
defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 20 },
  label: { type: String, default: '' },
})

const paths = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9.5h11V10"/><path d="M10 19.5v-5h4v5"/>',
  discover: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
  spark: '<path d="M12 3.5l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z"/>',
  swap: '<path d="M7 7.5h11.5l-3.5-3.5M17 16.5H5.5L9 20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-3.8 4-5.5 7-5.5s6 1.7 7 5.5"/>',
  logout: '<path d="M14 4.5h4.5v15H14M10 8l-4 4 4 4M6 12h9.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  camera: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13.2" r="3.2"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M20.5 15.5l-5-5-9 9"/>',
  send: '<path d="M5 12h13M13 6l6 6-6 6"/>',
  chat: '<path d="M4.5 6h15v10h-9l-4.5 3.5V16H4.5z"/>',
  flag: '<path d="M6 21V4.5M6 5h11l-2 4 2 4H6"/>',
  alert: '<path d="M12 4.5l8.5 15h-17z"/><path d="M12 10.5v4M12 17.2v.3"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.3"/>',
  edit: '<path d="M5 19l1-4 9.5-9.5 3 3L9 18z"/><path d="M13.5 7.5l3 3"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/>',
  back: '<path d="M19 12H6M11 6l-6 6 6 6"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  heart: '<path d="M12 19.5s-7-4.3-7-9.7a4 4 0 0 1 7-2.6 4 4 0 0 1 7 2.6c0 5.4-7 9.7-7 9.7z"/>',
  sort: '<path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3"/>',
  bookmark: '<path d="M7 4.5h10a1 1 0 0 1 1 1v14l-6-3.8-6 3.8v-14a1 1 0 0 1 1-1z"/>',
  moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  star: '<path d="M12 4l2.5 5.2 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
}
</script>

<template>
  <svg
    class="th-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :role="label ? 'img' : null"
    :aria-label="label || null"
    :aria-hidden="label ? null : 'true'"
    v-html="paths[name]"
  ></svg>
</template>
