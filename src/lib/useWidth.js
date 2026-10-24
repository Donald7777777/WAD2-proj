import { ref, onMounted, onUnmounted } from 'vue'

// Tracks an element's width in pixels, so SVG curves can be drawn at their real size
// (stretching an SVG would distort the line and break the "draw" animation).
export function useWidth(elementRef, fallback = 400) {
  const width = ref(fallback)
  let observer = null
  onMounted(() => {
    const el = elementRef.value
    if (!el) return
    width.value = el.clientWidth || fallback
    if ('ResizeObserver' in window) {
      observer = new ResizeObserver(([entry]) => {
        width.value = Math.max(Math.round(entry.contentRect.width), 120)
      })
      observer.observe(el)
    }
  })
  onUnmounted(() => observer?.disconnect())
  return width
}

// Point on a cubic Bezier curve at t (0..1); points are [x, y]
export function bezierPoint([p0, p1, p2, p3], t) {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]
}

export const toPath = ([p0, p1, p2, p3]) => `M${p0} C${p1} ${p2} ${p3}`
