import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createBrowserSessionPresence } from '../src/utils/browserSessionPresence.js'

function lockManager() {
  const held = new Set()
  return {
    query: async () => ({ held: [...held], pending: [] }),
    request(name, { signal }, callback) {
      const lock = { name }
      held.add(lock)
      signal.addEventListener('abort', () => held.delete(lock), { once: true })
      return Promise.resolve(callback(lock)).finally(() => held.delete(lock))
    },
  }
}

test('a new tab finds the login while any other tab holds it, and cannot find it after the last tab closes', async () => {
  const locks = lockManager()
  const first = createBrowserSessionPresence({ locks }), second = createBrowserSessionPresence({ locks })
  const reopened = createBrowserSessionPresence({ locks })
  first.start('login-1')
  assert.equal(await second.hasLiveTab('login-1'), true)
  second.start('login-1')
  first.stop()
  assert.equal(await reopened.hasLiveTab('login-1'), true)
  second.stop()
  assert.equal(await reopened.hasLiveTab('login-1'), false)
})

test('presence distinguishes accounts and releases the old login when switching accounts', async () => {
  const locks = lockManager(), tab = createBrowserSessionPresence({ locks })
  tab.start('old')
  tab.start('new')
  assert.equal(await tab.hasLiveTab('old'), false)
  assert.equal(await tab.hasLiveTab('new'), true)
  tab.stop()
  assert.equal(await tab.hasLiveTab('new'), false)
})

function channels() {
  const groups = new Map()
  return name => {
    const group = groups.get(name) || new Set()
    groups.set(name, group)
    const channel = {
      onmessage: null,
      postMessage(data) { for (const peer of group) if (peer !== channel) queueMicrotask(() => peer.onmessage?.({ data })) },
      close() { group.delete(channel); channel.onmessage = null },
    }
    group.add(channel)
    return channel
  }
}

test('channel fallback distinguishes an open tab from a closed session without relying on stored credentials', async () => {
  const createChannel = channels()
  const first = createBrowserSessionPresence({ createChannel, timeout: 10 })
  const other = createBrowserSessionPresence({ createChannel, timeout: 10 })
  first.start('session')
  assert.equal(await other.hasLiveTab('session'), true)
  assert.equal(await other.hasLiveTab('other-account'), false)
  first.stop()
  assert.equal(await other.hasLiveTab('session'), false)
})
