// Small helpers about a trade, from one user's point of view (used by My trades and Home)

export const isOpen = (t) => t.status === 'pending' || t.status === 'countered'
export const iAmProposer = (t, me) => String(t.proposer?._id || t.proposer) === String(me)
export const otherUser = (t, me) => (iAmProposer(t, me) ? t.receiver : t.proposer)

// Items on each side, whichever side I'm on
export function sides(t, me) {
  return iAmProposer(t, me)
    ? { mine: t.offeredListings || [], theirs: t.requestedListings || [] }
    : { mine: t.requestedListings || [], theirs: t.offeredListings || [] }
}

// The next thing *I* need to do on a trade, or '' if it's on them
export function myStep(t, me) {
  if (isOpen(t)) return String(t.turn) === String(me) ? (t.status === 'countered' ? 'Reply to their counter offer' : 'Reply to the offer') : ''
  if (t.status !== 'accepted') return ''
  if (!t.meetup?.name) return 'Pick a meetup spot'
  const mine = iAmProposer(t, me) ? 'proposerChecked' : 'receiverChecked'
  const confirmed = iAmProposer(t, me) ? t.proposerConfirmed : t.receiverConfirmed
  if ((t.checklist || []).some((c) => !c[mine])) return 'Tick the checklist at the meetup'
  if (!confirmed) return 'Confirm the handover'
  return ''
}

// What we're waiting for, when it's on them
export function theirStep(t, me) {
  const name = otherUser(t, me)?.name || 'them'
  if (isOpen(t)) return `Waiting for ${name} to reply`
  if (t.status === 'accepted') return t.meetup?.name ? `Waiting for ${name} to confirm the handover` : `Waiting for ${name} to pick a meetup`
  return ''
}

// When the meetup is, as a Date (or null)
export function meetupAt(t) {
  const m = t.meetup
  if (!m?.date || !m?.time) return null
  const at = new Date(`${m.date}T${m.time}`)
  return Number.isNaN(at.getTime()) ? null : at
}

// "in 2 days 4 hrs", "in 35 min", "now", "2 hrs ago"
export function countdown(at, now = new Date()) {
  const diff = at - now
  const abs = Math.abs(diff)
  const min = Math.round(abs / 60000)
  const hrs = Math.floor(abs / 3600000)
  const days = Math.floor(abs / 86400000)
  let text
  if (min < 1) return 'now'
  if (min < 60) text = `${min} min`
  else if (hrs < 24) text = `${hrs} hr${hrs === 1 ? '' : 's'}${min % 60 >= 5 ? ` ${min % 60} min` : ''}`
  else text = `${days} day${days === 1 ? '' : 's'}${hrs % 24 ? ` ${hrs % 24} hr${hrs % 24 === 1 ? '' : 's'}` : ''}`
  return diff > 0 ? `in ${text}` : `${text} ago`
}
