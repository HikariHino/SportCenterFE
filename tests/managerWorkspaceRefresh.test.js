import assert from 'node:assert/strict'
import { test } from 'node:test'
import { managerRefreshInterval, managerRelatedResources, watchManagerResource } from '../src/utils/managerWorkspaceRefresh.js'

test('Manager operations poll at 10 seconds and catalogs and reports at 30 seconds', () => {
  for (const key of ['overview', 'members', 'payments', 'classes', 'class-sessions:1', 'attendance:classes', 'roster:1', 'subscriptions:1', 'today-checkins:history:{}']) assert.equal(managerRefreshInterval(key), 10000, key)
  for (const key of ['staff', 'sports', 'coaches', 'rooms', 'packages', 'public-packages', 'policies', 'report-classes', 'revenue:2026']) assert.equal(managerRefreshInterval(key), 30000, key)
})

test('Manager background polling pauses while hidden, resumes on focus, and removes timers on cleanup', () => {
  let tick, count = 0, cleared = false
  const events = new Map(), documentEvents = new Map()
  const viewport = { setInterval(callback, interval) { tick = callback; assert.equal(interval, 10000); return 1 }, clearInterval() { cleared = true }, addEventListener: (key, cb) => events.set(key, cb), removeEventListener: key => events.delete(key) }
  const document = { visibilityState: 'hidden', addEventListener: (key, cb) => documentEvents.set(key, cb), removeEventListener: key => documentEvents.delete(key) }
  const dispose = watchManagerResource(() => count++, 10000, { viewport, document })
  tick(); events.get('focus')(); assert.equal(count, 0)
  document.visibilityState = 'visible'
  documentEvents.get('visibilitychange')(); tick(); assert.equal(count, 2)
  dispose(); assert.ok(cleared); assert.equal(events.size + documentEvents.size, 0)
})

test('confirmed Manager updates refresh only related catalogs and summaries', () => {
  assert.deepEqual(managerRelatedResources('staff'), ['coaches', 'overview'])
  assert.ok(managerRelatedResources('classes').includes('class-sessions:*'))
  assert.ok(managerRelatedResources('packages').includes('public-packages'))
  assert.deepEqual(managerRelatedResources('policies'), [])
})
