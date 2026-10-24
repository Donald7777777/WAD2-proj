// Small motion helpers used across the app. No extra packages needed.
// Every effect is skipped when the user has "reduce motion" switched on in their OS.

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

const canHover = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

// ---------- v-reveal: fade + rise in when scrolled into view ----------
// Usage: <div v-reveal="index"> (index staggers items in a grid)
let revealObserver = null
function getRevealObserver() {
  if (!revealObserver && 'IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            revealObserver.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 },
    )
  }
  return revealObserver
}

export const vReveal = {
  mounted(el, binding) {
    const observer = getRevealObserver()
    if (!observer || prefersReducedMotion()) return
    el.classList.add('th-reveal')
    el.style.transitionDelay = `${((Number(binding.value) || 0) % 8) * 55}ms`
    observer.observe(el)
  },
  unmounted(el) {
    revealObserver?.unobserve(el)
  },
}

// ---------- v-tilt: card leans towards the cursor with a soft glare ----------
export const vTilt = {
  mounted(el) {
    if (prefersReducedMotion() || !canHover()) return
    el.classList.add('th-tilt')
    const max = 6 // degrees
    el._tiltMove = (event) => {
      const rect = el.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width
      const y = (event.clientY - rect.top) / rect.height
      el.style.setProperty('--tilt-x', `${(0.5 - y) * max}deg`)
      el.style.setProperty('--tilt-y', `${(x - 0.5) * max}deg`)
      el.style.setProperty('--glare-x', `${x * 100}%`)
      el.style.setProperty('--glare-y', `${y * 100}%`)
    }
    el._tiltLeave = () => {
      el.style.setProperty('--tilt-x', '0deg')
      el.style.setProperty('--tilt-y', '0deg')
    }
    el.addEventListener('pointermove', el._tiltMove)
    el.addEventListener('pointerleave', el._tiltLeave)
  },
  unmounted(el) {
    el.removeEventListener('pointermove', el._tiltMove)
    el.removeEventListener('pointerleave', el._tiltLeave)
  },
}

// ---------- countUp: animate a number from 0 to `to` ----------
export function countUp(to, onFrame, duration = 900) {
  if (prefersReducedMotion()) {
    onFrame(to)
    return
  }
  const start = performance.now()
  const step = (now) => {
    const t = Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    onFrame(Math.round(to * eased))
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// Run `callback` once when `el` scrolls into view
export function whenVisible(el, callback) {
  if (!el || !('IntersectionObserver' in window)) {
    callback()
    return () => {}
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect()
      callback()
    }
  })
  observer.observe(el)
  return () => observer.disconnect()
}

// ---------- flyTo: a copy of `fromEl` flies into `toEl`, which then bumps ----------
export function flyTo(fromEl, toEl) {
  if (!fromEl || !toEl || prefersReducedMotion()) return
  const from = fromEl.getBoundingClientRect()
  const to = toEl.getBoundingClientRect()
  const ghost = fromEl.cloneNode(true)
  ghost.classList.add('th-fly-ghost')
  Object.assign(ghost.style, {
    position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
    margin: 0, zIndex: 2000, pointerEvents: 'none',
  })
  document.body.appendChild(ghost)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const animation = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(0.8)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.2 },
    ],
    { duration: 650, easing: 'cubic-bezier(0.5, 0, 0.2, 1)' },
  )
  animation.onfinish = () => {
    ghost.remove()
    bump(toEl)
  }
}

// Quick "pop" on an element (e.g. a counter that just changed)
export function bump(el) {
  if (!el || prefersReducedMotion()) return
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], {
    duration: 350,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  })
}

// ---------- confetti: a short burst in the brand colours from `originEl` ----------
const CONFETTI_COLOURS = ['#C8F26A', '#7ED6B3', '#2FA39A', '#F4F5EF', '#1C7350']

export function confetti(originEl, { count = 46, spread = 260 } = {}) {
  if (prefersReducedMotion()) return
  const rect = originEl?.getBoundingClientRect() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 }
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span')
    piece.className = 'th-confetti'
    const size = 6 + Math.random() * 6
    Object.assign(piece.style, {
      left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size * (Math.random() > 0.5 ? 1 : 0.45)}px`,
      background: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
      borderRadius: Math.random() > 0.6 ? '50%' : '2px',
    })
    document.body.appendChild(piece)
    const angle = Math.random() * Math.PI * 2
    const distance = spread * (0.35 + Math.random() * 0.65)
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance * 0.7 - 80
    const spin = (Math.random() - 0.5) * 720
    piece
      .animate(
        [
          { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + 160}px)) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 1100 + Math.random() * 600, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
      )
      .finished.then(() => piece.remove())
  }
}
