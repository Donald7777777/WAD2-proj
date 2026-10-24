<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { confetti, prefersReducedMotion } from '@/lib/motion'
import AppIcon from '@/components/AppIcon.vue'

// Landing page: a giant, interactive logo. Click the smile to connect the two dots and enter the app.
const router = useRouter()
const auth = useAuthStore()

const root = ref(null)
const logo = ref(null)
const canvas = ref(null)

// Pointer position, -1..1 from the centre of the screen (drives tilt, parallax, eyes, spotlight)
const pointer = ref({ x: 0, y: 0, px: 50, py: 50 })
// 0 (far from the logo) .. 1 (on the logo): the logo smiles wider as you get closer
const closeness = ref(0)
const hovering = ref(false)
const entering = ref(false)
const blinking = ref(false)
const magnet = ref({ x: 0, y: 0 })
// Phones and tablets say "Tap" instead of "Click"
const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches

// ---------- The logo ----------
const smileDepth = computed(() => 47 + closeness.value * 8 + (entering.value ? 4 : 0))
const smilePath = computed(() => `M13 37 C19 ${smileDepth.value} 45 ${smileDepth.value} 51 37`)
// The connecting line: leaves your dot, runs along the smile, climbs into their dot
const linkPath = computed(
  () => `M22 24 C17 28 13 32 13 37 C19 ${smileDepth.value} 45 ${smileDepth.value} 51 37 C51 32 47 28 42 24`,
)
// The dots look towards the cursor, like eyes
const eyes = computed(() => ({ x: pointer.value.x * 2.4, y: pointer.value.y * 2 }))

// ---------- "Almost connected" ----------
// One gradient line (same width and path as the smile) grows from your dot along the smile.
// On hover it stops just short of their dot, with a glowing tip; clicking closes the gap.
// The line and its tip are moved together every frame, so they always line up.
const linkEl = ref(null)
const progress = ref(0) // 0 = no line, 1 = fully connected
const tip = ref({ x: 22, y: 24 })
const snapped = ref(false)
const HOVER_STOP = 0.84 // how far the line gets on hover: a small, visible gap remains
const isNear = computed(() => progress.value > 0.6 && !snapped.value)

const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeIn = (t) => t * t * t

function updateTip() {
  const el = linkEl.value
  if (!el?.getTotalLength) return
  const point = el.getPointAtLength(el.getTotalLength() * progress.value)
  tip.value = { x: point.x, y: point.y }
}

let tween = 0
function drawTo(target, duration, ease) {
  cancelAnimationFrame(tween)
  const from = progress.value
  const start = performance.now()
  return new Promise((resolve) => {
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1)
      progress.value = from + (target - from) * ease(t)
      updateTip()
      if (t < 1) tween = requestAnimationFrame(step)
      else resolve()
    }
    tween = requestAnimationFrame(step)
  })
}

// The smile widens as you get closer, so keep the tip on the line when its shape changes
watch(linkPath, () => nextTick(updateTip))

function onLogoEnter() {
  hovering.value = true
  if (!entering.value && !prefersReducedMotion()) drawTo(HOVER_STOP, 850, easeOut)
}
function onLogoLeave() {
  hovering.value = false
  if (!entering.value) drawTo(0, 500, easeInOut)
}

const logoStyle = computed(() => {
  const tiltX = entering.value ? 0 : -pointer.value.y * 12
  const tiltY = entering.value ? 0 : pointer.value.x * 14
  return {
    transform: `translate(${magnet.value.x}px, ${magnet.value.y}px) perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
  }
})
const rootStyle = computed(() => ({
  '--px': pointer.value.x,
  '--py': pointer.value.y,
  '--mx': `${pointer.value.px}%`,
  '--my': `${pointer.value.py}%`,
}))

function onMove(event) {
  const w = window.innerWidth
  const h = window.innerHeight
  pointer.value = {
    x: (event.clientX / w) * 2 - 1,
    y: (event.clientY / h) * 2 - 1,
    px: (event.clientX / w) * 100,
    py: (event.clientY / h) * 100,
  }
  mouse.x = event.clientX
  mouse.y = event.clientY
  mouse.active = true
  if (!logo.value) return
  const rect = logo.value.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const distance = Math.hypot(event.clientX - cx, event.clientY - cy)
  closeness.value = Math.max(0, 1 - distance / (rect.width * 1.1))
  // Magnetic pull when the cursor is over the logo
  magnet.value = hovering.value && !entering.value ? { x: (event.clientX - cx) * 0.06, y: (event.clientY - cy) * 0.06 } : { x: 0, y: 0 }
}

function onLeave() {
  mouse.active = false
  hovering.value = false
  magnet.value = { x: 0, y: 0 }
}

// Click the smile: the line connects, their dot pops, confetti, then a green wave carries you in
function enter() {
  if (entering.value) return
  if (prefersReducedMotion()) {
    router.push('/discover')
    return
  }
  entering.value = true
  magnet.value = { x: 0, y: 0 }
  // Close the gap: a quick snap if the line is already nearly there, a full draw if not (e.g. a tap)
  const nearlyThere = progress.value > 0.5
  drawTo(1, nearlyThere ? 240 : 650, nearlyThere ? easeIn : easeInOut).then(() => {
    snapped.value = true
    confetti(logo.value, { count: 90, spread: Math.min(window.innerWidth, 900) * 0.45 })
    implode = true
    setTimeout(() => router.push('/discover'), 1150)
  })
}

// ---------- Rotating word in the tagline ----------
const words = ['film camera', 'old records', 'textbooks', 'guitar', 'bike', 'sneakers', 'board games']
const wordIndex = ref(0)

// ---------- Floating "items up for trade" ----------
const items = [
  { icon: 'camera', label: 'Film camera', x: 9, y: 18, depth: 1.4, delay: 0 },
  { icon: 'heart', label: 'Vinyl', x: 82, y: 14, depth: 0.8, delay: 1.2 },
  { icon: 'box', label: 'LEGO set', x: 6, y: 72, depth: 1.0, delay: 0.6 },
  { icon: 'spark', label: 'Ukulele', x: 86, y: 70, depth: 1.6, delay: 1.8 },
  { icon: 'image', label: 'Poster', x: 20, y: 44, depth: 0.5, delay: 2.4 },
  { icon: 'pin', label: 'Bike', x: 74, y: 42, depth: 0.6, delay: 0.9 },
  { icon: 'chat', label: 'Books', x: 30, y: 86, depth: 1.2, delay: 1.5 },
  { icon: 'clock', label: 'Watch', x: 66, y: 88, depth: 0.9, delay: 0.3 },
]

// ---------- Background network of dots that link up near the cursor ----------
const mouse = { x: -9999, y: -9999, active: false }
let implode = false
let nodes = []
let frame = 0
let ctx = null
let width = 0
let height = 0

function resize() {
  const c = canvas.value
  if (!c) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = window.innerWidth
  height = window.innerHeight
  c.width = width * dpr
  c.height = height * dpr
  ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const count = Math.round(Math.min(110, (width * height) / 14000))
  nodes = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    r: 1.2 + Math.random() * 2,
    lime: Math.random() > 0.5,
  }))
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  const linkDistance = 130
  const centreX = width / 2
  const centreY = height * 0.42
  for (const n of nodes) {
    if (implode) {
      // Everything rushes into the logo when you enter
      n.vx += (centreX - n.x) * 0.004
      n.vy += (centreY - n.y) * 0.004
      n.vx *= 0.92
      n.vy *= 0.92
    } else if (mouse.active) {
      const dx = mouse.x - n.x
      const dy = mouse.y - n.y
      const d = Math.hypot(dx, dy)
      if (d < 180 && d > 1) {
        n.vx += (dx / d) * 0.02
        n.vy += (dy / d) * 0.02
      }
    }
    n.vx = Math.max(-1.2, Math.min(1.2, n.vx)) * 0.995
    n.vy = Math.max(-1.2, Math.min(1.2, n.vy)) * 0.995
    n.x += n.vx
    n.y += n.vy
    if (n.x < 0 || n.x > width) n.vx *= -1
    if (n.y < 0 || n.y > height) n.vy *= -1
  }
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d < linkDistance) {
        ctx.strokeStyle = `rgba(126, 214, 179, ${(1 - d / linkDistance) * 0.22})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }
    if (mouse.active && !implode) {
      const d = Math.hypot(a.x - mouse.x, a.y - mouse.y)
      if (d < 170) {
        ctx.strokeStyle = `rgba(200, 242, 106, ${(1 - d / 170) * 0.55})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(mouse.x, mouse.y)
        ctx.stroke()
      }
    }
    ctx.fillStyle = a.lime ? 'rgba(200, 242, 106, 0.75)' : 'rgba(126, 214, 179, 0.75)'
    ctx.beginPath()
    ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function loop() {
  if (!document.hidden) draw()
  frame = requestAnimationFrame(loop)
}

let wordTimer = null
let blinkTimer = null
function scheduleBlink() {
  blinkTimer = setTimeout(
    () => {
      blinking.value = true
      setTimeout(() => (blinking.value = false), 160)
      scheduleBlink()
    },
    2400 + Math.random() * 3200,
  )
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  if (prefersReducedMotion()) {
    draw()
  } else {
    loop()
    wordTimer = setInterval(() => (wordIndex.value = (wordIndex.value + 1) % words.length), 2200)
    scheduleBlink()
  }
})

onUnmounted(() => {
  cancelAnimationFrame(frame)
  cancelAnimationFrame(tween)
  clearInterval(wordTimer)
  clearTimeout(blinkTimer)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <div
    ref="root"
    class="th-landing"
    :class="{ 'is-hover': hovering, 'is-entering': entering, 'is-snapped': snapped, 'is-near': isNear, 'is-blinking': blinking }"
    :style="rootStyle"
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <canvas ref="canvas" class="th-landing-net" aria-hidden="true"></canvas>
    <div class="th-landing-spot" aria-hidden="true"></div>

    <!-- Items up for trade, drifting at different depths -->
    <div class="th-landing-items" aria-hidden="true">
      <span
        v-for="item in items"
        :key="item.label"
        class="th-landing-item"
        :style="{ left: `${item.x}%`, top: `${item.y}%`, '--depth': item.depth, animationDelay: `-${item.delay}s` }"
      >
        <AppIcon :name="item.icon" :size="18" />{{ item.label }}
      </span>
    </div>

    <header class="th-landing-top">
      <span class="th-landing-brand">Trade<em>Happy</em></span>
      <nav class="th-landing-links">
        <template v-if="auth.user">
          <span class="th-landing-hi">Hi, {{ auth.user.name.split(' ')[0] }}</span>
        </template>
        <RouterLink v-else to="/login" class="th-landing-link">Log in</RouterLink>
        <RouterLink to="/discover" class="th-landing-link th-landing-skip">Enter site<AppIcon name="back" :size="16" class="th-flip" /></RouterLink>
      </nav>
    </header>

    <main class="th-landing-centre">
      <button
        ref="logo"
        type="button"
        class="th-landing-logo"
        :style="logoStyle"
        aria-label="Enter TradeHappy"
        @pointerenter="onLogoEnter"
        @pointerleave="onLogoLeave"
        @click="enter"
      >
        <span class="th-landing-ring" aria-hidden="true"></span>
        <span class="th-landing-ring th-landing-ring-2" aria-hidden="true"></span>
        <svg class="th-landing-mark" viewBox="0 0 64 64" shape-rendering="geometricPrecision" aria-hidden="true">
          <defs>
            <linearGradient id="th-landing-link" gradientUnits="userSpaceOnUse" x1="13" y1="0" x2="51" y2="0">
              <stop offset="0%" stop-color="#C8F26A" />
              <stop offset="100%" stop-color="#7ED6B3" />
            </linearGradient>
            <radialGradient id="th-landing-tip">
              <stop offset="0%" stop-color="#FFFFFF" />
              <stop offset="45%" stop-color="#DFFF9E" />
              <stop offset="100%" stop-color="#C8F26A" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="th-landing-bg" cx="35%" cy="25%" r="90%">
              <stop offset="0%" stop-color="#1C5444" />
              <stop offset="100%" stop-color="#0E2B24" />
            </radialGradient>
          </defs>
          <rect class="th-lm-bg" width="64" height="64" rx="18" fill="url(#th-landing-bg)" />
          <g transform="translate(7.04 6.65) scale(0.78)">
            <g class="th-lm-smile">
              <path :d="smilePath" fill="none" stroke="#F4F5EF" stroke-width="5" stroke-linecap="round" />
              <path
                class="th-lm-arrows"
                d="M8.5 37.5 L13 31.5 L18.5 36.5 Z M55.5 37.5 L51 31.5 L45.5 36.5 Z"
                fill="#F4F5EF"
                stroke="#F4F5EF"
                stroke-width="2.5"
                stroke-linejoin="round"
              />
            </g>
            <!-- The line, its glowing tip and the dots move together, so the line always starts at your dot -->
            <g :transform="`translate(${eyes.x} ${eyes.y})`">
              <path
                ref="linkEl"
                class="th-lm-link"
                :d="linkPath"
                pathLength="1"
                fill="none"
                stroke="url(#th-landing-link)"
                stroke-width="5"
                stroke-linecap="round"
                :style="{ strokeDashoffset: 1 - progress, opacity: progress > 0.002 ? 1 : 0 }"
              />
              <circle class="th-lm-dot th-lm-you" cx="22" cy="24" r="7" fill="#C8F26A" />
              <circle class="th-lm-dot th-lm-them" cx="42" cy="24" r="7" fill="#7ED6B3" />
              <g v-if="progress > 0.04 && !snapped" class="th-lm-tip">
                <circle class="th-lm-tip-glow" :cx="tip.x" :cy="tip.y" r="6.5" fill="url(#th-landing-tip)" />
                <circle class="th-lm-tip-core" :cx="tip.x" :cy="tip.y" r="2.1" fill="#FFFFFF" />
              </g>
              <!-- Flash where the line meets their dot -->
              <circle class="th-lm-flash" cx="42" cy="24" r="7" fill="none" stroke="#DFFF9E" stroke-width="2" />
            </g>
          </g>
        </svg>
      </button>

      <h1 class="th-landing-title">Trade<em>Happy</em></h1>
      <p class="th-landing-tag">
        Swap your
        <span class="th-landing-word">
          <Transition name="th-word" mode="out-in">
            <b :key="wordIndex">{{ words[wordIndex] }}</b>
          </Transition>
        </span>
        for what you <em>want.</em>
      </p>
      <p class="th-landing-hint">
        <span class="th-landing-hint-dot"></span>{{ entering ? 'Connecting you…' : `${isTouch ? 'Tap' : 'Click'} the smile to start` }}
      </p>
    </main>

    <!-- The wave that carries you into the app -->
    <div class="th-landing-wave" aria-hidden="true"></div>
  </div>
</template>

<style>
/* Landing page. It always sits on the dark forest background, so colours are fixed here. */
.th-landing {
  --px: 0;
  --py: 0;
  position: fixed; inset: 0; z-index: 1030; overflow: hidden;
  display: flex; flex-direction: column;
  background:
    radial-gradient(60% 50% at 80% 10%, rgba(47, 163, 154, 0.35), transparent 70%),
    radial-gradient(50% 45% at 10% 90%, rgba(200, 242, 106, 0.16), transparent 70%),
    linear-gradient(160deg, #0A221C 0%, #12352D 45%, #0F3A31 75%, #0B2721 100%);
  color: #F4F5EF; user-select: none; -webkit-user-select: none;
}
.th-landing-net { position: absolute; inset: 0; width: 100%; height: 100%; }
.th-landing-spot {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 40%), rgba(200, 242, 106, 0.12), transparent 70%);
}

/* Floating item tiles with parallax */
.th-landing-items { position: absolute; inset: 0; pointer-events: none; }
.th-landing-item {
  position: absolute; display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px;
  border-radius: 999px; font: 600 13px/1 var(--font-sans); color: #F4F5EF; white-space: nowrap;
  background: rgba(244, 245, 239, 0.07); border: 1px solid rgba(244, 245, 239, 0.14);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  translate: calc(var(--px) * var(--depth) * -28px) calc(var(--py) * var(--depth) * -22px);
  transition: translate 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease, scale 0.6s ease;
  animation: th-landing-bob 7s ease-in-out infinite;
  opacity: calc(0.45 + var(--depth) * 0.3); scale: calc(0.85 + var(--depth) * 0.12);
}
.th-landing-item svg { color: #C8F26A; }
@keyframes th-landing-bob { 50% { transform: translateY(-14px) rotate(-2deg); } }
@media (max-width: 767.98px) { .th-landing-item:nth-child(n + 5) { display: none; } }

/* Top bar */
.th-landing-top { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 22px clamp(16px, 4vw, 48px); }
.th-landing-brand { font: 750 20px/1 var(--font-display); letter-spacing: -0.02em; opacity: 0; transition: opacity 0.4s ease; }
.th-landing-brand em, .th-landing-title em { font-style: normal; color: #C8F26A; }
.th-landing-links { display: flex; align-items: center; gap: 8px; }
.th-landing-link {
  display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: 999px;
  color: #F4F5EF; text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid rgba(244, 245, 239, 0.22);
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}
.th-landing-link:hover { color: #10302A; background: #C8F26A; border-color: #C8F26A; transform: translateY(-1px); }
.th-landing-hi { font-weight: 600; font-size: 14px; opacity: 0.8; margin-right: 6px; }
.th-flip { transform: rotate(180deg); }

/* Centre: the giant logo */
.th-landing-centre { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 16px 6vh; text-align: center; }
.th-landing-logo {
  position: relative; width: min(52vh, 74vw); aspect-ratio: 1; padding: 0; border: 0; background: none; cursor: pointer;
  border-radius: 28%; transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1); transform-style: preserve-3d;
  -webkit-tap-highlight-color: transparent;
}
.th-landing-logo:focus-visible { outline: 3px solid #C8F26A; outline-offset: 10px; }
.th-landing-mark {
  position: relative; display: block; width: 100%; height: 100%; overflow: visible;
  filter: drop-shadow(0 30px 60px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 40px rgba(126, 214, 179, 0.18));
  animation: th-landing-breathe 5s ease-in-out infinite;
}
@keyframes th-landing-breathe { 50% { scale: 1.025; } }
.th-lm-bg { stroke: rgba(200, 242, 106, 0.25); stroke-width: 0.6; }
.th-lm-smile { transition: opacity 0.45s ease, filter 0.45s ease; }
/* Dash and opacity are driven frame by frame from the script */
.th-lm-link { stroke-dasharray: 1; filter: drop-shadow(0 0 1.5px rgba(200, 242, 106, 0.55)); }
.th-lm-dot { transform-box: fill-box; transform-origin: center; transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.th-landing.is-blinking .th-lm-dot { transform: scaleY(0.12); transition-duration: 0.08s; }

/* Hover: the line starts growing out of your dot, the arrowheads wiggle */
/* Hover: the white smile melts away completely (no grey ghost), the gradient line takes its place */
.th-landing.is-hover .th-lm-smile,
.th-landing.is-entering .th-lm-smile { opacity: 0; filter: blur(1.5px); }
.th-landing.is-hover .th-lm-you { transform: scale(1.08); }
/* Their dot leans towards the line as it gets close */
.th-landing.is-near .th-lm-them { transform: translate(-0.9px, 1.3px) scale(1.07); transition-duration: 0.6s; }
/* The glowing tip pulses while it waits */
.th-lm-tip-glow { transform-box: fill-box; transform-origin: center; animation: th-tip-pulse 1.1s ease-in-out infinite; }
@keyframes th-tip-pulse { 0%, 100% { transform: scale(0.75); opacity: 0.65; } 50% { transform: scale(1.15); opacity: 1; } }
.th-lm-flash { opacity: 0; transform-box: fill-box; transform-origin: center; pointer-events: none; }

/* Pulsing rings behind the logo */
.th-landing-ring {
  position: absolute; inset: 6%; border-radius: 30%; border: 2px solid rgba(200, 242, 106, 0.35); pointer-events: none;
  animation: th-landing-ring 3.2s ease-out infinite;
}
.th-landing-ring-2 { border-color: rgba(126, 214, 179, 0.3); animation-delay: 1.6s; }
@keyframes th-landing-ring { from { transform: scale(0.95); opacity: 0.9; } to { transform: scale(1.35); opacity: 0; } }

/* Text under the logo */
.th-landing-title { margin: clamp(12px, 3vh, 28px) 0 6px; font: 750 clamp(34px, 6vw, 64px)/1 var(--font-display); letter-spacing: -0.03em; color: #F4F5EF; }
.th-landing-tag { margin: 0; font-size: clamp(16px, 2.2vw, 21px); line-height: 1.4; color: rgba(244, 245, 239, 0.8); }
.th-landing-tag em { font-style: normal; color: #C8F26A; font-weight: 700; }
.th-landing-word { display: inline-block; min-width: 9ch; text-align: center; }
.th-landing-word b { display: inline-block; color: #7ED6B3; font-weight: 700; }
.th-word-enter-active, .th-word-leave-active { transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease, filter 0.3s ease; }
.th-word-enter-from { transform: translateY(70%); opacity: 0; filter: blur(4px); }
.th-word-leave-to { transform: translateY(-70%); opacity: 0; filter: blur(4px); }
.th-landing-hint {
  display: inline-flex; align-items: center; gap: 10px; margin: clamp(14px, 3vh, 26px) 0 0; padding: 8px 16px;
  border-radius: 999px; background: rgba(244, 245, 239, 0.08); font: 500 12px/1 var(--font-mono);
  letter-spacing: 0.08em; text-transform: uppercase; color: rgba(244, 245, 239, 0.85);
}
.th-landing-hint-dot { width: 8px; height: 8px; border-radius: 50%; background: #C8F26A; box-shadow: 0 0 0 0 rgba(200, 242, 106, 0.7); animation: th-landing-ping 1.6s ease-out infinite; }
@keyframes th-landing-ping { to { box-shadow: 0 0 0 10px rgba(200, 242, 106, 0); } }

/* Click: the smile connects, then everything zooms through into the app */
.th-landing.is-entering .th-lm-you { transform: scale(1.12); }
/* Snap: the gap closes, a ring flashes out of their dot and it pops */
.th-landing.is-snapped .th-lm-them { animation: th-landing-arrive 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.th-landing.is-snapped .th-lm-flash { animation: th-lm-flash 0.6s ease-out both; }
@keyframes th-lm-flash { from { opacity: 1; transform: scale(1); stroke-width: 3; } to { opacity: 0; transform: scale(2.6); stroke-width: 0.5; } }
.th-landing.is-snapped .th-lm-link { filter: drop-shadow(0 0 3px rgba(223, 255, 158, 0.9)); transition: filter 0.3s ease; }
@keyframes th-landing-arrive { 45% { transform: scale(1.6); } 100% { transform: scale(1.2); } }
.th-landing.is-snapped .th-landing-ring { animation: th-landing-burst 0.9s ease-out 0.05s both; }
@keyframes th-landing-burst { from { transform: scale(1); opacity: 1; border-width: 6px; } to { transform: scale(2.6); opacity: 0; border-width: 1px; } }
.th-landing.is-snapped .th-landing-mark { animation: th-landing-zoom 0.9s cubic-bezier(0.7, 0, 0.84, 0) 0.3s both; }
@keyframes th-landing-zoom { to { scale: 9; opacity: 0; } }
.th-landing.is-entering .th-landing-title,
.th-landing.is-entering .th-landing-tag,
.th-landing.is-entering .th-landing-items,
.th-landing.is-entering .th-landing-top { opacity: 0; transform: translateY(12px); transition: opacity 0.5s ease 0.5s, transform 0.5s ease 0.5s; }
.th-landing-wave {
  position: absolute; inset: 0; z-index: 5; pointer-events: none; background: #F4F5EF;
  clip-path: circle(0% at 50% 42%);
}
.th-landing.is-snapped .th-landing-wave { animation: th-landing-wave 0.75s cubic-bezier(0.65, 0, 0.35, 1) 0.5s both; }
@keyframes th-landing-wave {
  0% { clip-path: circle(0% at 50% 42%); background: #C8F26A; }
  50% { background: #7ED6B3; }
  100% { clip-path: circle(150% at 50% 42%); background: #F4F5EF; }
}

@media (max-width: 575.98px) {
  .th-landing-link:not(.th-landing-skip) { display: none; }
  .th-landing-logo { width: min(46vh, 80vw); }
}
@media (prefers-reduced-motion: reduce) {
  .th-landing-item, .th-landing-mark, .th-landing-ring { animation: none !important; }
}
</style>
