import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as auth from '../src/utils/auth.js'
import { createBrowserSessionPresence, getBrowserSessionPresence } from '../src/utils/browserSessionPresence.js'

const storage = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key) }
}

async function browser(run) {
  const descriptors = new Map(['localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const held = new Set(), tabs = []
  const sharedPresence = getBrowserSessionPresence(), originalPresence = { ...sharedPresence }
  const locks = {
    query: async () => ({ held: [...held], pending: [] }),
    request(name, { signal }, callback) {
      const lock = { name }
      held.add(lock)
      signal.addEventListener('abort', () => held.delete(lock), { once: true })
      return Promise.resolve(callback(lock)).finally(() => held.delete(lock))
    },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage() })
  const createTab = () => {
    const presence = createBrowserSessionPresence({ locks }), session = storage()
    const tab = { session, presence, close: () => presence.stop(), select() {
      Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session })
      Object.assign(sharedPresence, presence)
      return auth
    } }
    tabs.push(tab)
    return tab
  }
  try { await run({ createTab, held }) }
  finally {
    tabs.forEach(tab => tab.close())
    Object.assign(sharedPresence, originalPresence)
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
}

const account = role => ({ userId: 7, fullName: 'Session Test', role, refreshTokenKey: 'synthetic-refresh' })

for (const role of ['Member', 'Coach', 'Receptionist', 'CenterManager']) {
  test(`${role}: a tab opened before login keeps the unremembered session alive after the login tab closes`, () => browser(async ({ createTab, held }) => {
    const first = createTab(), existing = createTab()
    await first.select().initializeBrowserSession()
    await existing.select().initializeBrowserSession()
    assert.equal(auth.getSavedUser(), null)
    first.select().saveSession(account(role), 'synthetic-token', false)
    const id = auth.getLoginSessionId()
    // AuthContext calls these when a storage/focus event arrives in the guest tab.
    assert.equal(existing.select().reconcileBrowserSession(), true)
    assert.equal(auth.getSavedUser().userId, 7)
    assert.equal(auth.getSavedUser().role, role.toLowerCase())
    first.close()
    assert.ok(held.size > 0, 'The already-open tab must hold the shared session')
    const third = createTab()
    await third.select().initializeBrowserSession()
    assert.equal(auth.getSavedUser().userId, 7)
    assert.equal(auth.getLoginSessionId(), id)
    assert.equal(existing.select().getToken(), 'synthetic-token')
    existing.close(); third.close()
    const reopened = createTab()
    await reopened.select().initializeBrowserSession()
    assert.equal(auth.getToken(), null, 'Closing every tab still expires an unremembered login')
  }))
}

test('sharing an unremembered session is idempotent and token renewal keeps the same presence', () => browser(async ({ createTab, held }) => {
  const first = createTab(), existing = createTab()
  await existing.select().initializeBrowserSession()
  first.select().saveSession(account('Member'), 'synthetic-token', false)
  const id = auth.getLoginSessionId()
  for (let i = 0; i < 5; i++) assert.equal(existing.select().getToken(), 'synthetic-token')
  assert.equal(held.size, 2)
  first.select().updateSessionTokens('renewed-token', 'renewed-refresh')
  assert.equal(existing.select().getToken(), 'renewed-token')
  assert.equal(auth.getLoginSessionId(), id)
  assert.equal(held.size, 2)
  auth.clearSession()
  assert.equal(first.select().getToken(), null)
  assert.equal(held.size, 0, 'Logged-out tabs release their old presence')
}))

test('replacing an account releases old presence without adopting or clearing the new login', () => browser(async ({ createTab, held }) => {
  const first = createTab(), existing = createTab()
  await existing.select().initializeBrowserSession()
  first.select().saveSession(account('Member'), 'old-token', false)
  const oldId = auth.getLoginSessionId()
  existing.select().getSavedUser()
  first.select().saveSession({ ...account('Coach'), userId: 8 }, 'new-token', false)
  assert.equal(existing.select().getToken(), null)
  assert.equal([...held].some(lock => lock.name === `sportcenter:open-session:${oldId}`), false)
  assert.equal(localStorage.getItem('token'), 'new-token')
  assert.equal(first.select().getSavedUser().userId, 8)
}))

test('sharing a remembered login does not create a browser-only presence or lose remember preference', () => browser(async ({ createTab, held }) => {
  const first = createTab(), existing = createTab()
  await existing.select().initializeBrowserSession()
  first.select().saveSession(account('Member'), 'remembered-token', true)
  assert.equal(existing.select().getSavedUser().userId, 7)
  assert.equal(held.size, 0)
  first.close(); existing.close()
  const reopened = createTab()
  await reopened.select().initializeBrowserSession()
  assert.equal(auth.getToken(), 'remembered-token')
}))
