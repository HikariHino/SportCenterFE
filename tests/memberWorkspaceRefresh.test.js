import assert from 'node:assert/strict'
import { test } from 'node:test'
import { memberRefreshInterval, watchMemberResource } from '../src/utils/memberWorkspaceRefresh.js'
import { createWorkspaceResourceCache } from '../src/utils/workspaceResourceCache.js'

test('time-sensitive Member data refreshes every 10 seconds and other data every 30 seconds', () => {
  for (const key of ['subscriptions', 'subscription-data', 'payments', 'registrations', 'available-sessions', 'notifications:list:false:1', 'gym-history:{}']) assert.equal(memberRefreshInterval(key), 10000, key)
  for (const key of ['profile', 'packages', 'training-plans', 'support-tickets', 'gym-qr', 'member-read:1:{}']) assert.equal(memberRefreshInterval(key), 30000, key)
})

test('background refresh pauses in hidden windows and catches up on focus and visibility', () => {
  const events = new Map(), documentEvents = new Map()
  let tick, calls = 0, cleared = false
  const viewport = {
    setInterval(callback, interval) { tick = callback; assert.equal(interval, 10000); return 7 },
    clearInterval(id) { assert.equal(id, 7); cleared = true },
    addEventListener(name, callback) { events.set(name, callback) },
    removeEventListener(name) { events.delete(name) },
  }
  const document = { visibilityState: 'visible', addEventListener(name, callback) { documentEvents.set(name, callback) }, removeEventListener(name) { documentEvents.delete(name) } }
  const dispose = watchMemberResource(() => calls++, 10000, { viewport, document })
  tick(); assert.equal(calls, 1)
  document.visibilityState = 'hidden'
  tick(); events.get('focus')(); assert.equal(calls, 1)
  document.visibilityState = 'visible'
  documentEvents.get('visibilitychange')(); events.get('focus')(); assert.equal(calls, 3)
  dispose()
  assert.equal(cleared, true)
  assert.equal(events.size + documentEvents.size, 0)
})

test('shared Member reads deduplicate preload requests and preserve data after refresh failures', async () => {
  const cache = createWorkspaceResourceCache()
  let resolve, calls = 0
  const loader = () => { calls++; return new Promise(done => { resolve = done }) }
  const first = cache.load('subscriptions', loader)
  const second = cache.load('subscriptions', loader)
  await Promise.resolve()
  assert.equal(calls, 1)
  resolve([{ id: 1, status: 'Pending' }])
  await Promise.all([first, second])
  await assert.rejects(cache.load('subscriptions', async () => { throw new Error('offline') }, { force: true }))
  assert.equal(cache.snapshot('subscriptions').data[0].status, 'Pending')
  assert.equal(cache.snapshot('subscriptions').hasData, true)
})

test('confirmed mutations and account changes cannot be overwritten by stale background responses', async () => {
  const first = createWorkspaceResourceCache(), second = createWorkspaceResourceCache()
  let resolve
  const pending = first.load('payments', () => new Promise(done => { resolve = done }))
  await Promise.resolve()
  first.setData('payments', [{ id: 1, status: 'Completed' }])
  resolve([{ id: 1, status: 'Pending' }]); await pending
  assert.equal(first.snapshot('payments').data[0].status, 'Completed')
  assert.equal(second.snapshot('payments').hasData, false)
})
