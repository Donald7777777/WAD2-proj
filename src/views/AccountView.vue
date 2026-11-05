<script setup>
import PasswordInput from '@/components/PasswordInput.vue'
import { ref, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, errorMessage } from '@/lib/api'
import { deleteImage } from '@/lib/storage'
import { showToast } from '@/lib/toast'
import { passwordProblem, PASSWORD_HINT } from '@/lib/validation'
import UserAvatar from '@/components/UserAvatar.vue'
import AppIcon from '@/components/AppIcon.vue'

// Account settings: change password, people you've blocked, delete account
const auth = useAuthStore()
const router = useRouter()

// ---------- Change password ----------
const current = ref('')
const next = ref('')
const repeat = ref('')
const pwError = ref('')
const pwSaving = ref(false)
async function changePassword() {
  pwError.value = ''
  const problem = passwordProblem(next.value)
  if (problem) {
    pwError.value = problem
    return
  }
  if (next.value !== repeat.value) {
    pwError.value = "The new passwords don't match."
    return
  }
  pwSaving.value = true
  try {
    await api.put('/auth/password', { currentPassword: current.value, newPassword: next.value })
    current.value = next.value = repeat.value = ''
    showToast('Password changed.', { icon: 'lock' })
  } catch (e) {
    pwError.value = errorMessage(e)
  } finally {
    pwSaving.value = false
  }
}

// ---------- Blocked users ----------
const blocked = ref([])
const blockedLoaded = ref(false)
async function loadBlocked() {
  try {
    blocked.value = (await api.get('/auth/blocked')).data
  } catch {
    // Shown as empty
  }
  blockedLoaded.value = true
}
async function unblock(person) {
  try {
    await auth.toggleBlock(person._id)
    blocked.value = blocked.value.filter((p) => p._id !== person._id)
    showToast(`${person.name} is unblocked.`, { icon: 'user', tone: 'info' })
  } catch (e) {
    showToast(errorMessage(e), { tone: 'danger', icon: 'x' })
  }
}
onMounted(loadBlocked)

// ---------- Delete account ----------
const confirmText = ref('')
const deletePassword = ref('')
const delError = ref('')
const deleting = ref(false)
async function deleteAccount() {
  delError.value = ''
  deleting.value = true
  try {
    const { data } = await api.delete('/auth/account', { data: { password: deletePassword.value } })
    // Remove the photos from storage too (best effort)
    await Promise.allSettled((data.imagePaths || []).map((p) => deleteImage(p)))
    auth.user = null
    showToast('Your account has been deleted. Take care!', { icon: 'check', tone: 'info' })
    router.push('/')
  } catch (e) {
    delError.value = errorMessage(e)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <RouterLink to="/profile" class="th-back"><AppIcon name="back" :size="18" />My profile</RouterLink>
  <div class="th-page-head">
    <div>
      <h1>Account settings</h1>
      <p>Signed in as {{ auth.user.email }}</p>
    </div>
  </div>

  <div class="th-settings">
    <!-- Password -->
    <section class="card th-panel" aria-labelledby="pw-title">
      <h2 id="pw-title"><AppIcon name="lock" :size="20" />Change password</h2>
      <form class="th-settings-form" @submit.prevent="changePassword">
        <label class="form-label" for="pw-current">Current password</label>
        <PasswordInput id="pw-current" v-model="current" autocomplete="current-password" required />
        <label class="form-label" for="pw-new">New password</label>
        <PasswordInput id="pw-new" v-model="next" autocomplete="new-password" required />
        <div class="form-text">{{ PASSWORD_HINT }}</div>
        <label class="form-label" for="pw-repeat">New password again</label>
        <PasswordInput id="pw-repeat" v-model="repeat" autocomplete="new-password" required />
        <div v-if="pwError" class="th-field-error" role="alert">{{ pwError }}</div>
        <div><button class="btn btn-primary" type="submit" :disabled="pwSaving">{{ pwSaving ? 'Saving…' : 'Change password' }}</button></div>
      </form>
    </section>

    <!-- Blocked -->
    <section class="card th-panel" aria-labelledby="blocked-title">
      <h2 id="blocked-title"><AppIcon name="x" :size="20" />Blocked people</h2>
      <p class="th-muted">You won't see each other's listings, and you can't trade or message each other.</p>
      <p v-if="blockedLoaded && !blocked.length" class="th-muted small mb-0">You haven't blocked anyone.</p>
      <ul v-else class="th-blocked-list">
        <li v-for="person in blocked" :key="person._id">
          <UserAvatar :name="person.name" :src="person.avatarUrl" />
          <b>{{ person.name }}</b>
          <button type="button" class="btn btn-sm btn-outline-dark ms-auto" @click="unblock(person)">Unblock</button>
        </li>
      </ul>
    </section>

    <!-- Delete -->
    <section class="card th-panel th-danger-zone" aria-labelledby="del-title">
      <h2 id="del-title"><AppIcon name="trash" :size="20" />Delete account</h2>
      <p class="th-muted">
        This cancels your open and accepted trades, removes your listings (except ones you've already traded), and
        can't be undone. Past trades and reviews stay, under "Deleted user".
      </p>
      <form class="th-settings-form" @submit.prevent="deleteAccount">
        <label class="form-label" for="del-confirm">Type <b>DELETE</b> to confirm</label>
        <input id="del-confirm" v-model="confirmText" type="text" class="form-control" autocomplete="off" />
        <label class="form-label" for="del-password">Your password</label>
        <PasswordInput id="del-password" v-model="deletePassword" autocomplete="current-password" />
        <div v-if="delError" class="th-field-error" role="alert">{{ delError }}</div>
        <div>
          <button class="btn btn-danger" type="submit" :disabled="deleting || confirmText !== 'DELETE' || !deletePassword">
            {{ deleting ? 'Deleting…' : 'Delete my account' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style>
.th-settings { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; max-width: 1100px; }
@media (min-width: 992px) { .th-settings { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; } .th-danger-zone { grid-column: 1 / -1; } }
.th-settings h2 { display: flex; align-items: center; gap: 8px; }
.th-settings-form { display: flex; flex-direction: column; gap: 6px; max-width: 420px; }
.th-settings-form .form-label { margin: 6px 0 0; }
.th-settings-form .btn { margin-top: 8px; }
.th-blocked-list { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.th-blocked-list li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-md); background: var(--paper-sunk); }
.th-danger-zone { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--brick) 45%, transparent); }
.th-danger-zone h2 { color: var(--brick); }
</style>
