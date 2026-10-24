// Display helpers (presentation only): dates, times and place names in the
// TradeHappy house style, e.g. "Sat 24 Oct · 2:00 pm" and "Bishan MRT Station".

// "2026-10-24", "14:00" -> "Sat 24 Oct · 2:00 pm"
export function formatMeetup(date, time) {
  if (!date) return ''
  const when = new Date(`${date}T${time || '00:00'}`)
  if (Number.isNaN(when.getTime())) return [date, time].filter(Boolean).join(' · ')
  const day = when.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })
  if (!time) return day
  const clock = when.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} · ${clock.toLowerCase()}`
}

// Chat timestamps: "6:10 pm" today, otherwise "Mon 19 Oct, 6:10 pm"
export function formatMessageTime(value) {
  const when = new Date(value)
  const clock = when.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
  if (when.toDateString() === new Date().toDateString()) return clock
  const day = when.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day}, ${clock}`
}

// OneMap returns names in capitals ("BISHAN MRT STATION (NS17 / CC15)"); show them in title case,
// keeping short codes such as MRT, NS17 and CC15 in capitals.
export function placeName(name = '') {
  return name
    .toLowerCase()
    .split(' ')
    .map((word) => {
      const bare = word.replace(/[^a-z0-9]/g, '')
      if (/\d/.test(bare) || ['mrt', 'lrt', 'cc', 'blk'].includes(bare)) return word.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}
