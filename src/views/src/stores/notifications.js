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
const POLL_MS = 10000
const MAX_ITEMS = 20

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
  itemsAdded: { icon: 'plus', tone: 'success', title: (from) => `${from} added items to the trade` },
  requestDeclined: { icon: 'x', tone: 'info', title: (from) => `${from} declined your request` },
  update: { icon: 'info', tone: 'info', title: (from) => `Update from ${from}` },
}

const desktopSupported = typeof window !== 'undefined' && 'Notification' in window

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref([]) // newest first
  const unread = ref(0)
  const moment = ref(null) // the big pop-up: { tradeId, kind, title, them, give, get }
  const permission = ref(desktopSupported ? Notification.permission : 'unsupported')
  const ringKey = ref(0) // changes whenever something new arrives (makes the bell wiggle)

  let router = null
  let after = null
  let timer = null
  let running = false
  let stream = null
  const statuses = new Map() // tradeId -> last known status
  const seen = new Set() // ids already shown (the live stream and the safety-net check can both send one)

  function currentTradeId() {
    const route = router?.currentRoute.value
    return route?.name === 'trade' ? String(route.params.id) : null
  }

  function openTrade(tradeId) {
    router?.push(`/trades/${tradeId}`)
  }

  function desktopAlert(item) {
    if (!desktopSupported || permission.value !== 'granted' || !document.hidden) return
    try {
      const note = new Notification(item.title, { body: item.text, icon: '/favicon.svg', tag: String(item.id) })
      note.onclick = () => {
        window.focus()
        openTrade(item.tradeId)
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

  // "Mei Lin accepted the trade. Pick a meetup point below." -> "Accepted the trade. Pick a meetup point below."
  function eventText(raw) {
    const prefix = `${raw.from} `
    const rest = raw.text.startsWith(prefix) ? raw.text.slice(prefix.length) : raw.text
    return rest.charAt(0).toUpperCase() + rest.slice(1)
  }

  function handle(raw) {
    const look = LOOK[raw.kind] || LOOK.update
    const onThisTrade = currentTradeId() === String(raw.tradeId)
    // You're already looking at this trade: its chat and pop-up show the update, so stay quiet
    if (onThisTrade) return null
    const item = {
      id: raw._id,
      tradeId: raw.tradeId,
      kind: raw.kind,
      title: look.title(raw.from),
      text: raw.kind === 'message' ? raw.text : eventText(raw),
      icon: look.icon,
      tone: look.tone,
      at: raw.createdAt,
      read: false,
    }
    items.value = [item, ...items.value].slice(0, MAX_ITEMS)
    unread.value++
    ringKey.value++
    showToast(item.text, {
      title: item.title,
      icon: item.icon,
      tone: item.tone,
      duration: 5000,
      onClick: () => openTrade(item.tradeId),
    })
    desktopAlert(item)
    return item
  }

  // One new notification, from either the live stream or the safety-net check
  function receive(raw, previousStatus) {
    if (seen.has(String(raw._id))) return
    seen.add(String(raw._id))
    const item = handle(raw)
    if (item && ['accepted', 'rejected', 'cancelled'].includes(raw.kind)) showMoment(raw, previousStatus)
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
      for (const raw of data.items) receive(raw, previous.get(String(raw.tradeId)))
      after = data.now
    } catch {
      // Server busy or logged out; try again next round
    }
    if (running) timer = setTimeout(poll, POLL_MS)
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
  }

  function markAllRead() {
    unread.value = 0
    items.value = items.value.map((i) => ({ ...i, read: true }))
  }

  async function enableDesktop() {
    if (!desktopSupported) return
    permission.value = await Notification.requestPermission()
    if (permission.value === 'granted') {
      showToast('Desktop alerts are on. You will be notified even in another tab.', { icon: 'bell' })
    }
  }

  return { items, unread, moment, permission, ringKey, start, stop, markAllRead, enableDesktop, openTrade }
})
