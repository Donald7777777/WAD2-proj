<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { confetti } from '@/lib/motion'
import { useWidth, bezierPoint, toPath } from '@/lib/useWidth'

// The logo's smile, used as a link between the two traders.
//   pending -> faint dotted arc (proposal still open)
//   linked  -> the arc draws itself from you to them, dots pop, confetti (trade accepted)
//   done    -> same as linked, labelled "Traded!"
//   broken  -> the arc snaps in the middle and droops (cancelled / declined)
const props = defineProps({
  you: { type: String, required: true },
  them: { type: String, required: true },
  state: { type: String, default: 'pending' }, // 'pending' | 'linked' | 'done' | 'broken'
  brokenLabel: { type: String, default: 'Trade cancelled' },
})

const HEIGHT = 64
const bridge = ref(null)
const burstPoint = ref(null)
const width = useWidth(bridge)

// The smile curve at the bridge's real pixel size, plus its two halves for the "snap"
const curve = computed(() => {
  const w = width.value
  return [
    [14, 12],
    [w * 0.2, HEIGHT + 4],
    [w * 0.8, HEIGHT + 4],
    [w - 14, 12],
  ]
})
const halves = computed(() => {
  const [p0, p1, p2, p3] = curve.value
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const a = mid(p0, p1), b = mid(p1, p2), c = mid(p2, p3)
  const d = mid(a, b), e = mid(b, c)
  const m = mid(d, e)
  return { left: toPath([p0, a, d, m]), right: toPath([m, e, c, p3]) }
})
const middle = computed(() => bezierPoint(curve.value, 0.5))

// Which animation is playing. Clearing it and setting it again restarts the CSS animations.
const play = ref('')

const initials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?'

const label = computed(
  () =>
    ({
      pending: 'Proposal open',
      linked: "It's a deal!",
      done: 'Traded!',
      broken: props.brokenLabel,
    })[props.state],
)

async function animate(kind, withConfetti) {
  play.value = ''
  await nextTick()
  requestAnimationFrame(() => {
    play.value = kind
    // Burst once the line has nearly reached the other dot
    if (withConfetti) setTimeout(() => confetti(burstPoint.value), 650)
  })
}

// First load: draw the line in quietly if the trade is already agreed
onMounted(() => {
  if (props.state === 'linked' || props.state === 'done') animate('draw', false)
})

// Live changes while the page is open: celebrate or snap
watch(
  () => props.state,
  (now, before) => {
    if ((now === 'linked' || now === 'done') && before === 'pending') animate('draw', true)
    else if (now === 'done' && before === 'linked') animate('done', true)
    else if (now === 'broken') animate('snap', false)
  },
)
</script>

<template>
  <section class="th-tlink" :data-state="state" :data-play="play" :aria-label="`Trade link: ${label}`">
    <div class="th-tlink-row">
      <div class="th-tlink-node th-tlink-you">
        <span class="th-tlink-dot">{{ initials(you) }}</span>
        <span class="th-tlink-name">You</span>
      </div>

      <div ref="bridge" class="th-tlink-bridge">
        <svg class="th-tlink-svg" :width="width" :height="HEIGHT" :viewBox="`0 0 ${width} ${HEIGHT}`" aria-hidden="true">
          <defs>
            <linearGradient id="th-tlink-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#C8F26A" />
              <stop offset="55%" stop-color="#7ED6B3" />
              <stop offset="100%" stop-color="#2FA39A" />
            </linearGradient>
          </defs>
          <!-- Whole smile (pending / linked / done) -->
          <path class="th-tlink-arc" :d="toPath(curve)" pathLength="1" />
          <!-- The two halves it breaks into -->
          <path
            class="th-tlink-half th-tlink-half-l"
            :d="halves.left"
            :style="{ transformOrigin: `${curve[0][0]}px ${curve[0][1]}px` }"
          />
          <path
            class="th-tlink-half th-tlink-half-r"
            :d="halves.right"
            :style="{ transformOrigin: `${curve[3][0]}px ${curve[3][1]}px` }"
          />
        </svg>
        <span ref="burstPoint" class="th-tlink-burst" :style="{ top: `${middle[1]}px` }" aria-hidden="true"></span>
        <span class="th-tlink-crack" :style="{ top: `${middle[1]}px` }" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="th-tlink-label">{{ label }}</span>
      </div>

      <div class="th-tlink-node th-tlink-them">
        <span class="th-tlink-dot">{{ initials(them) }}</span>
        <span class="th-tlink-name">{{ them }}</span>
      </div>
    </div>
  </section>
</template>
