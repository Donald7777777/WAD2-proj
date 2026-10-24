<script setup>
import { ref, computed } from 'vue'
import { api, errorMessage } from '@/lib/api'
import ItemPicker from './ItemPicker.vue'
import AppIcon from './AppIcon.vue'

// "Could you add more?" on an open proposal.
// Either trader can ask the other to add more of their items (pick some and/or leave a note).
// The other trader then adds them, picks different ones, or declines.
const props = defineProps({
  trade: { type: Object, required: true },
  meId: { type: String, required: true },
  otherName: { type: String, required: true },
})
const emit = defineEmits(['updated'])

const asking = ref(false)
const theirItems = ref([])
const myItems = ref([])
const picked = ref([]) // items picked when asking
const note = ref('')
const answerPicks = ref([]) // items the responder picks for a note-only request
const busy = ref(false)
const error = ref('')

const otherId = computed(() => (props.trade.proposer._id === props.meId ? props.trade.receiver._id : props.trade.proposer._id))
const inTrade = computed(() => new Set([...props.trade.requestedListings, ...props.trade.offeredListings].map((l) => l._id)))
const open = computed(() => (props.trade.requests || []).filter((r) => r.status === 'open'))
const mine = computed(() => open.value.find((r) => String(r.by) === props.meId))
const forMe = computed(() => open.value.find((r) => String(r.by) !== props.meId))

const titles = (list) => list.map((l) => l.title).join(', ')

async function loadItems(owner) {
  const { data } = await api.get('/listings', { params: { owner } })
  return data.filter((l) => !inTrade.value.has(l._id))
}

async function startAsking() {
  error.value = ''
  try {
    theirItems.value = await loadItems(otherId.value)
    picked.value = []
    note.value = ''
    asking.value = true
  } catch (e) {
    error.value = errorMessage(e)
  }
}

function toggle(list, id) {
  const i = list.indexOf(id)
  if (i === -1) list.push(id)
  else list.splice(i, 1)
}

async function send() {
  busy.value = true
  error.value = ''
  try {
    const { data } = await api.post(`/trades/${props.trade._id}/requests`, { listingIds: picked.value, note: note.value })
    asking.value = false
    emit('updated', data)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

// A note-only request: show my own items so I can choose what to add
const needsPick = computed(() => forMe.value && forMe.value.listings.length === 0)
async function loadMine() {
  if (myItems.value.length) return
  try {
    myItems.value = await loadItems(props.meId)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

async function answer(accept) {
  busy.value = true
  error.value = ''
  try {
    const { data } = await api.post(`/trades/${props.trade._id}/requests/${forMe.value._id}/respond`, {
      accept,
      listingIds: needsPick.value ? answerPicks.value : undefined,
    })
    answerPicks.value = []
    emit('updated', data)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="th-addmore">
    <!-- They asked me -->
    <div v-if="forMe" class="th-addmore-card th-addmore-incoming">
      <span class="th-addmore-icon"><AppIcon name="plus" :size="18" /></span>
      <div class="th-addmore-body">
        <b>{{ otherName }} asked you to add {{ forMe.listings.length ? titles(forMe.listings) : 'more items' }}</b>
        <p v-if="forMe.note" class="th-addmore-note">“{{ forMe.note }}”</p>
        <div v-if="forMe.listings.length" class="th-addmore-thumbs">
          <span v-for="l in forMe.listings" :key="l._id" class="th-addmore-thumb">
            <img v-if="l.imageUrl" :src="l.imageUrl" :alt="l.title" />
            <AppIcon v-else name="image" :size="18" />
          </span>
        </div>
        <template v-if="needsPick">
          <p class="th-addmore-hint">Pick which of your items to add:</p>
          <button v-if="!myItems.length" type="button" class="btn btn-sm btn-outline-dark mb-2" @click="loadMine">Show my items</button>
          <ItemPicker v-else :listings="myItems" :selected-ids="answerPicks" side="you" @toggle="toggle(answerPicks, $event)" />
        </template>
        <div class="th-addmore-actions">
          <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="answer(false)">No thanks</button>
          <button type="button" class="btn btn-offer btn-sm" :disabled="busy || (needsPick && !answerPicks.length)" @click="answer(true)">
            <AppIcon name="plus" :size="16" />Add to trade
          </button>
        </div>
      </div>
    </div>

    <!-- I asked them -->
    <div v-if="mine" class="th-addmore-card">
      <span class="th-addmore-icon th-addmore-wait"><AppIcon name="clock" :size="18" /></span>
      <div class="th-addmore-body">
        <b>You asked {{ otherName }} to add {{ mine.listings.length ? titles(mine.listings) : 'more items' }}</b>
        <p v-if="mine.note" class="th-addmore-note">“{{ mine.note }}”</p>
        <span class="th-muted small">Waiting for their answer.</span>
      </div>
    </div>

    <!-- Ask for more -->
    <template v-if="!mine">
      <button v-if="!asking" type="button" class="th-addmore-ask" @click="startAsking">
        <AppIcon name="plus" :size="16" />Ask {{ otherName }} to add more
      </button>
      <div v-else class="th-addmore-card th-addmore-form">
        <div class="th-addmore-body">
          <b>Ask {{ otherName }} to add more</b>
          <p class="th-addmore-hint">Pick items of theirs you'd like as well, and/or leave a note.</p>
          <p v-if="!theirItems.length" class="th-muted small mb-2">They have no other available items. You can still leave a note.</p>
          <ItemPicker v-else :listings="theirItems" :selected-ids="picked" side="them" @toggle="toggle(picked, $event)" />
          <textarea
            v-model="note"
            class="form-control mt-2"
            rows="2"
            maxlength="300"
            placeholder="e.g. Could you add the top you listed too?"
          ></textarea>
          <div class="th-addmore-actions">
            <button type="button" class="btn btn-ghost btn-sm" @click="asking = false">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="busy || (!picked.length && !note.trim())" @click="send">
              <AppIcon name="send" :size="16" />Send request
            </button>
          </div>
        </div>
      </div>
    </template>

    <div v-if="error" class="th-field-error">{{ error }}</div>
  </div>
</template>

<style>
.th-addmore { display: flex; flex-direction: column; gap: 10px; padding: 0 var(--space-4) var(--space-4); }
.th-addmore-card {
  display: flex; gap: 12px; padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--line); background: var(--paper);
  animation: th-event-in 0.5s var(--ease-spring) both;
}
.th-addmore-incoming { background: var(--grad-soft); border-color: transparent; box-shadow: 0 0 0 2px var(--mint); }
.th-addmore-form { background: var(--paper-raised); }
.th-addmore-icon { display: inline-flex; width: 36px; height: 36px; flex: none; align-items: center; justify-content: center; border-radius: 50%; background: var(--lime); color: var(--on-lime); }
.th-addmore-wait { background: var(--paper-sunk); color: var(--ink-muted); }
.th-addmore-body { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
.th-addmore-body b { font-size: 15px; line-height: 20px; }
.th-addmore-note { margin: 0; font-style: italic; color: var(--ink-muted); }
.th-addmore-hint { margin: 0; font-size: 13px; color: var(--ink-muted); }
.th-addmore-thumbs { display: flex; gap: 6px; }
.th-addmore-thumb { width: 48px; height: 48px; border-radius: var(--radius-sm); overflow: hidden; background: var(--paper-sunk); display: inline-flex; align-items: center; justify-content: center; color: var(--ink-muted); }
.th-addmore-thumb img { width: 100%; height: 100%; object-fit: cover; }
.th-addmore-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
.th-addmore-ask {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px;
  border: 1.5px dashed var(--line-strong); background: transparent; color: var(--ink); font-weight: 600; font-size: 14px;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s var(--ease-spring);
}
.th-addmore-ask:hover { border-color: var(--ink); background: var(--paper-sunk); transform: translateY(-1px); }
</style>
