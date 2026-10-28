import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/lib/api'
import { showToast } from '@/lib/toast'
import { useAuthStore } from './auth'

// Notifications for new chat messages and trade events (accepted, rejected, countered...).
// While you are logged in, the app keeps a live connection open (GET /api/notifications/stream),
// so the server pushes each new thing the moment it happens. As a safety net it also asks
// what's new every 10 seconds, and straight away when you come back to the tab
// (GET /api/notifications). Each new thing shows up as:
//   - a pop-up in the corner (toast) you can click to open the trade
//   - an entry in the bell menu in the top bar, with an unread count
//   - a desktop notification, if you're in another tab and turned them on
// When the other person accepts / declines / cancels, the big TradeMoment pop-up
// also appears, whatever page you are on.
// Nothing is lost while you're away: the first check after you log in (or reload) brings back
// your recent history for the bell, and anything that happened since you were last here is
// shown as "missed" (a summary toast, plus the most important pop-ups).
// The live connection also tells the trade page about new chat messages, typing and "seen",
// through onTradeEvent().
const POLL_MS = 10000
const MAX_ITEMS = 30

const LOOK = {
  message: { icon: 'chat', tone: 'info', title: (from) => from },
  accepted: { icon: 'check', tone: 'success', title: (from) => `${from} accepted your trade` },
  rejected: { icon: 'x', tone: 'danger', title: (from) => `${from} declined your proposal` },
  countered: { icon: 'swap', tone: 'info', title: (from) => `${from} sent a counter offer` },
  cancelled: { icon: 'x', tone: 'danger', title: (from) => `${from} cancelled the trade` },
  proposed: { icon: 'spark', tone: 'success', title: (from) => `New proposal from ${from}` },
  meetup: { icon: 'pin', tone: 'info', title: (from) => `${from} set the meetup` },
  completed: { icon: 'check', tone: 'success', title: () => 'Trade complete!' },
  confirmed: { icon: 'check', tone: 'info', title: (from) => `${from} confirmed the handover` },
  requested: { icon: 'plus', tone: 'info', title: (from) => `${from} asked you to add more` },
  liked: { icon: 'heart', tone: 'success', title: (from) => `${from} liked your listing` },
  saved: { icon: 'bookmark', tone: 'success', title: (from) => `${from} saved your listing` },
  meetupChanged: { icon: 'pin', tone: 'danger', title: (from) => `${from} changed the meetup` },
  reviewed: { icon: 'spark', tone: 'success', title: (from) => `${from} left you a review` },
  itemsAdded: { icon: 'plus', tone: 'success', title: (from) => `${from} added items to the trade` },
  requestDeclined: { icon: 'x', tone: 'info', title: (from) => `${from} declined your request` },
  competitor: { icon: 'alert', tone: 'danger', title: () => 'You have a competitor!' },
  competingOffer: { icon: 'swap', tone: 'success', title: (from) => `${from} made a competing offer` },
  offerClosed: { icon: 'x', tone: 'info', title: () => 'Offer closed' },
  reminder: { icon: 'clock', tone: 'info', title: () => 'Meetup reminder', long: true },
  meetupNow: { icon: 'pin', tone: 'success', title: () => "It's meetup time!", long: true },
  meetupOverdue: { icon: 'alert', tone: 'danger', title: () => 'Did the swap happen?', long: true },
  offerWithdrawn: { icon: 'x', tone: 'info', title: () => 'Offer withdrawn' },
  offerEdited: { icon: 'edit', tone: 'info', title: (from) => `${from} changed their offer` },
  update: { icon: 'info', tone: 'info', title: (from) => `Update from ${from}` },
}

const desktopSupported = typeof window !== 'undefined' && 'Notification' in window

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref([]) // newest first
  const unread = ref(0)
  const moment = ref(null) // the big pop-up: { tradeId, kind, title, them, give, get }
  const permission = ref(desktopSupported ? Notification.permission : 'unsupported')
  const ringKey = ref(0) // changes whenever something new arrives (makes the bell wiggle)
  const newLikes = ref(0) // likes/saves on your listings since you last opened the Likes page (the dot on its tab)
  // The "you got a review" pop-up: { tradeId, from, fromId, fromAvatar, rating, comment, average, count }
  const reviewMoment = ref(null)
  // The competing-offer pop-up: { kind: 'competitor' | 'newOffer', tradeId, listingId, listing, rival, items, ... }
  const offerMoment = ref(null)

  let router = null
  let after = null
  let timer = null
  let running = false
  let stream = null
  const statuses = new Map() // tradeId -> last known status
  const seen = new Set() // ids already shown (the live stream and the safety-net check can both send one)
  // Trade-page listeners: (event) => void, event = { type: 'chat' | 'typing' | 'read' | 'notification', tradeId, ... }
  const tradeListeners = new Set()
  function onTradeEvent(fn) {
    tradeListeners.add(fn)
    return () => tradeListeners.delete(fn)
  }
  function tradeEvent(event) {
    for (const fn of tradeListeners) {
      try {
        fn(event)
      } catch {
        // One broken listener shouldn't stop the others
      }
    }
  }

  function currentTradeId() {
    const route = router?.currentRoute.value
    return route?.name === 'trade' ? String(route.params.id) : null
  }

  function openTrade(tradeId) {
    router?.push(`/trades/${tradeId}`)
  }

  // Where tapping a notification goes: the trade, your likes activity, or your reviews
  function open(item) {
    if (item.kind === 'liked' || item.kind === 'saved') router?.push(`/activity?listing=${item.listingId}`)
    else if (item.kind === 'competitor' && item.listingId) router?.push(`/listings/${item.listingId}#offers`)
    else if (item.kind === 'reviewed') router?.push('/profile?tab=reviews')
    else if (item.tradeId) openTrade(item.tradeId)
  }

  function desktopAlert(item) {
    if (!desktopSupported || permission.value !== 'granted' || !document.hidden) return
    try {
      const note = new Notification(item.title, { body: item.text, icon: '/favicon.svg', tag: String(item.id) })
      note.onclick = () => {
        window.focus()
        open(item)
        note.close()
      }
    } catch {
      // Some browsers only allow notifications from a service worker; the toast still shows
    }
  }

  // The big pop-up for accept / decline / cancel by the other person
  async function showMoment(item, previousStatus) {
    let kind = 'linked'
    let title = ''
    if (item.kind === 'rejected') {
      kind = 'declined'
      title = 'Proposal declined'
    } else if (item.kind === 'cancelled') {
      kind = 'broken'
      title = previousStatus === 'accepted' ? 'Trade cancelled' : 'Proposal withdrawn'
      // The owner switched to a competing offer
      if (item.text?.includes('to go with another offer')) title = 'They went with another offer'
    } else if (item.kind === 'completed') {
      kind = 'completed'
      title = 'Congratulations!'
    }
    try {
      const { data: trade } = await api.get(`/trades/${item.tradeId}`)
      const me = useAuthStore().user?._id
      const iAmProposer = trade.proposer._id === me
      moment.value = {
        tradeId: item.tradeId,
        kind,
        title,
        them: (iAmProposer ? trade.receiver.name : trade.proposer.name) || item.from,
        themAvatar: (iAmProposer ? trade.receiver.avatarUrl : trade.proposer.avatarUrl) || '',
        give: (iAmProposer ? trade.offeredListings : trade.requestedListings).map((l) => l.title),
        get: (iAmProposer ? trade.requestedListings : trade.offeredListings).map((l) => l.title),
        // For "Make a new offer" after a decline: the first of their items
        retryListingId: (iAmProposer ? trade.requestedListings : trade.offeredListings)[0]?._id || null,
      }
      // So the trade page doesn't celebrate the same acceptance again
      if (kind === 'linked') {
        try {
          localStorage.setItem(`th-linked-${item.tradeId}`, '1')
        } catch {
          // Private mode: the trade page may show it once more, which is fine
        }
      }
    } catch {
      // If the trade can't be loaded, the toast and bell entry are still there
    }
  }

  // Someone rated you: "Mei left Ze Xin a 4-star review: "Great!"" -> pop-up with their picture,
  // the stars, their comment, and your new average
  async function showReviewMoment(raw) {
    const match = raw.text.match(/a (\d)-star review(?:: "([\s\S]*)"|\.)?$/)
    if (!match) return
    const me = useAuthStore().user?._id
    const next = {
      tradeId: raw.tradeId,
      from: raw.from,
      fromId: null,
      fromAvatar: '',
      rating: Number(match[1]),
      comment: match[2] || '',
      average: 0,
      count: 0,
    }
    const [trade, profile] = await Promise.allSettled([api.get(`/trades/${raw.tradeId}`), api.get(`/users/${me}`)])
    if (trade.status === 'fulfilled') {
      const t = trade.value.data
      const them = t.proposer._id === me ? t.receiver : t.proposer
      next.fromAvatar = them.avatarUrl || ''
      next.fromId = them._id
    }
    if (profile.status === 'fulfilled') {
      next.average = profile.value.data.rating.average
      next.count = profile.value.data.rating.count
    }
    reviewMoment.value = next
  }

  // Competing offers:
  //   'competitor' (you offered for an item, someone else just did too): "You have a competitor!"
  //   'competingOffer' (you own the item, a new offer arrived while others exist): "Another offer!"
  async function showOfferMoment(raw) {
    const listingId = raw.listingId
    if (!listingId) return
    try {
      const [listingResponse, offersResponse] = await Promise.all([
        api.get(`/listings/${listingId}`),
        api.get(`/listings/${listingId}/offers`),
      ])
      const listing = listingResponse.data
      const offers = offersResponse.data
      const rivalName =
        raw.kind === 'competitor' ? raw.text.match(/^Heads up: (.+) also made an offer for /)?.[1] || 'Someone' : raw.from
      const theirs =
        raw.kind === 'competitor'
          ? offers.filter((o) => o.offerer.name === rivalName).at(-1)
          : offers.find((o) => String(o.tradeId) === String(raw.tradeId))
      const mine = offers.find((o) => o.mine)
      offerMoment.value = {
        kind: raw.kind === 'competitor' ? 'competitor' : 'newOffer',
        tradeId: raw.tradeId, // competitor: your trade; newOffer: the new offer
        listingId,
        listing: { title: listing.title, imageUrl: listing.imageUrl || '' },
        rival: { name: rivalName, avatarUrl: theirs?.offerer.avatarUrl || '' },
        items: theirs?.items || [],
        offerCount: offers.length,
        myStatus: mine?.status || '',
        ownerName: listing.owner?.name || 'The owner',
        reserved: listing.status === 'reserved',
      }
    } catch {
      // The bell entry is still there
    }
  }

  function clearNewLikes() {
    newLikes.value = 0
  }

  // "Mei Lin accepted the trade. Pick a meetup point below." -> "Accepted the trade. Pick a meetup point below."
  function eventText(raw) {
    // "Mei left Ze Xin a 4-star review: "Great!"" -> "★★★★☆ "Great!""
    const review = raw.kind === 'reviewed' && raw.text.match(/a (\d)-star review(?:: (.*))?/)
    if (review) return `${'★'.repeat(review[1])}${'☆'.repeat(5 - review[1])}${review[2] ? ` ${review[2]}` : ''}`
    const prefix = `${raw.from} `
    const rest = raw.text.startsWith(prefix) ? raw.text.slice(prefix.length) : raw.text
    return rest.charAt(0).toUpperCase() + rest.slice(1)
  }

  function makeItem(raw, read = false) {
    const look = LOOK[raw.kind] || LOOK.update
    return {
      id: raw._id,
      tradeId: raw.tradeId,
      listingId: raw.listingId || null,
      kind: raw.kind,
      title: look.title(raw.from),
      text: raw.kind === 'message' ? raw.text : eventText(raw),
      icon: look.icon,
      tone: look.tone,
      at: raw.createdAt,
      read,
    }
  }

  function handle(raw) {
    const onThisTrade = Boolean(raw.tradeId) && currentTradeId() === String(raw.tradeId)
    // You're already looking at this trade: its chat and pop-up show the update, so stay quiet
    // (meetup reminders still show, they're worth seeing anywhere)
    if (onThisTrade && !(LOOK[raw.kind] || LOOK.update).long) return null
    const item = makeItem(raw)
    items.value = [item, ...items.value].slice(0, MAX_ITEMS)
    if (raw.kind === 'liked' || raw.kind === 'saved') newLikes.value++
    unread.value++
    ringKey.value++
    // A review gets the big pop-up instead of a toast
    if (!['reviewed', 'competitor', 'competingOffer'].includes(raw.kind)) {
      showToast(item.text, {
        title: item.title,
        icon: item.icon,
        tone: item.tone,
        duration: (LOOK[raw.kind] || LOOK.update).long ? 12000 : 5000,
        onClick: () => open(item),
      })
    }
    desktopAlert(item)
    return item
  }

  // One new notification, from either the live stream or the safety-net check
  function receive(raw, previousStatus) {
    if (seen.has(String(raw._id))) return
    seen.add(String(raw._id))
    if (raw.tradeId) tradeEvent({ type: 'notification', tradeId: String(raw.tradeId), kind: raw.kind })
    // A review of you: the big pop-up, even when you're on that trade's page
    if (raw.kind === 'reviewed') showReviewMoment(raw)
    // Competing offers: their own pop-up too
    if (raw.kind === 'competitor' || raw.kind === 'competingOffer') showOfferMoment(raw)
    const item = handle(raw)
    if (item && ['accepted', 'rejected', 'cancelled', 'completed'].includes(raw.kind)) showMoment(raw, previousStatus)
    // Remember the trade's new status (for "cancelled" vs "withdrawn" next time)
    const next = { accepted: 'accepted', rejected: 'rejected', cancelled: 'cancelled', completed: 'completed' }[raw.kind]
    if (next) statuses.set(String(raw.tradeId), next)
  }

  async function poll() {
    clearTimeout(timer)
    try {
      const { data } = await api.get('/notifications', { params: after ? { after } : {} })
      const previous = new Map(statuses)
      for (const t of data.trades) statuses.set(String(t._id), t.status)
      if (data.history) loadHistory(data)
      else for (const raw of data.items) receive(raw, previous.get(String(raw.tradeId)))
      after = data.now
    } catch {
      // Server busy or logged out; try again next round
    }
    if (running) timer = setTimeout(poll, POLL_MS)
  }

  // First check after logging in / reloading: fill the bell with recent history, and catch you up
  // on what happened while you were away (since `seenAt`)
  function loadHistory(data) {
    const readAt = data.readAt ? new Date(data.readAt) : null
    const seenAt = data.seenAt ? new Date(data.seenAt) : null
    const history = data.items.filter((raw) => !seen.has(String(raw._id)))
    history.forEach((raw) => seen.add(String(raw._id)))
    // Newest first in the bell; read = older than the last time you opened the bell
    items.value = history
      .map((raw) => makeItem(raw, Boolean(readAt) && new Date(raw.createdAt) <= readAt))
      .reverse()
      .slice(0, MAX_ITEMS)
    unread.value = items.value.filter((i) => !i.read).length
    newLikes.value = history.filter(
      (raw) => ['liked', 'saved'].includes(raw.kind) && (!readAt || new Date(raw.createdAt) > readAt),
    ).length

    const missed = seenAt ? history.filter((raw) => new Date(raw.createdAt) > seenAt) : []
    if (!missed.length) return
    ringKey.value++
    showToast(`${missed.length} update${missed.length === 1 ? '' : 's'} while you were away. Open the bell to see them.`, {
      title: 'Welcome back!',
      icon: 'bell',
      tone: 'info',
      duration: 7000,
    })
    // The newest big moment of each kind still pops up (trade result, review, competing offer)
    const newest = (kinds) => [...missed].reverse().find((raw) => kinds.includes(raw.kind))
    const trade = newest(['accepted', 'rejected', 'cancelled', 'completed'])
    if (trade) showMoment(trade, trade.kind === 'cancelled' ? 'accepted' : undefined)
    const review = newest(['reviewed'])
    if (review) showReviewMoment(review)
    const offer = newest(['competitor', 'competingOffer'])
    if (offer) showOfferMoment(offer)
  }

  // Live connection: the server pushes each notification as soon as it is saved
  function connect() {
    if (typeof EventSource === 'undefined') return
    stream = new EventSource('/api/notifications/stream')
    stream.addEventListener('notification', (event) => {
      try {
        const raw = JSON.parse(event.data)
        receive(raw, statuses.get(String(raw.tradeId)))
      } catch {
        // Ignore a malformed message
      }
    })
    // For the trade page: new chat message (instant refresh), the other person typing, or "seen"
    for (const type of ['chat', 'typing', 'read']) {
      stream.addEventListener(type, (event) => {
        try {
          tradeEvent({ type, ...JSON.parse(event.data) })
        } catch {
          // Ignore a malformed message
        }
      })
    }
    // The browser reconnects by itself; catch up on anything missed while it was down
    stream.addEventListener('open', () => after && poll())
  }

  // Coming back to the tab: check straight away (background tabs are slowed down by the browser)
  function onVisible() {
    if (running && !document.hidden) poll()
  }

  function start(appRouter) {
    if (running) return
    router = appRouter
    running = true
    poll()
    connect()
    document.addEventListener('visibilitychange', onVisible)
  }

  function stop() {
    running = false
    clearTimeout(timer)
    stream?.close()
    stream = null
    document.removeEventListener('visibilitychange', onVisible)
    after = null
    seen.clear()
    statuses.clear()
    items.value = []
    unread.value = 0
    moment.value = null
    reviewMoment.value = null
    offerMoment.value = null
    newLikes.value = 0
  }

  // Opening the bell: everything so far counts as read (also on your other devices)
  function markAllRead() {
    if (!unread.value) return
    unread.value = 0
    // `fresh` keeps the "new" dot while the bell is open
    items.value = items.value.map((i) => ({ ...i, fresh: !i.read, read: true }))
    api.post('/notifications/read').catch(() => {})
  }

  async function enableDesktop() {
    if (!desktopSupported) return
    permission.value = await Notification.requestPermission()
    if (permission.value === 'granted') {
      showToast('Desktop alerts are on. You will be notified even in another tab.', { icon: 'bell' })
    }
  }

  return {
    items,
    unread,
    moment,
    reviewMoment,
    offerMoment,
    newLikes,
    permission,
    ringKey,
    start,
    stop,
    markAllRead,
    enableDesktop,
    openTrade,
    open,
    clearNewLikes,
    onTradeEvent,
  }
})
