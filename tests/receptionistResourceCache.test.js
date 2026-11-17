import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createReceptionistResourceCache, prefetchReceptionistResources } from '../src/utils/receptionistResourceCache.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('Overview, prefetch and member tab share one request and subsequent visits reuse fresh data', async () => {
  const cache = createReceptionistResourceCache()
  const pending = deferred()
  let reads = 0
  const load = () => { reads++; return pending.promise }
  const overview = cache.load('members', load)
  const prefetch = cache.load('members', load)
  const memberTab = cache.load('members', load)
  assert.equal(overview, prefetch)
  assert.equal(memberTab, prefetch)
  assert.equal(cache.snapshot('members').fetching, true)
  pending.resolve([{ memberId: 9, fullName: 'Nguyễn Văn An' }])
  await Promise.all([overview, prefetch, memberTab])
  assert.equal(reads, 1)
  const cached = cache.snapshot('members')
  assert.equal(cached.hasData, true)
  assert.equal(cached.fetching, false)
  assert.equal((await cache.load('members', load))[0].memberId, 9)
  assert.equal(reads, 1)
})

test('stale reads refresh in the background while retaining visible records and the same snapshot between changes', async () => {
  let time = 1000
  const cache = createReceptionistResourceCache({ now: () => time })
  await cache.load('payments', () => [{ id: 10, status: 'Pending' }])
  const before = cache.snapshot('payments')
  assert.equal(cache.snapshot('payments'), before)
  time += 31000
  const newer = deferred()
  const refreshing = cache.load('payments', () => newer.promise)
  const during = cache.snapshot('payments')
  assert.equal(during.hasData, true)
  assert.equal(during.fetching, true)
  assert.equal(during.data[0].status, 'Pending')
  newer.resolve([{ id: 10, status: 'Completed' }])
  await refreshing
  assert.equal(cache.snapshot('payments').data[0].status, 'Completed')
  assert.equal(cache.snapshot('payments').updatedAt, time)
})

test('failed refreshes retain the last successful result and allow a deliberate retry', async () => {
  const cache = createReceptionistResourceCache()
  await cache.load('rooms', () => [{ id: 5 }])
  const error = new Error('Backend unavailable')
  await assert.rejects(cache.load('rooms', () => { throw error }, { force: true }))
  assert.equal(cache.snapshot('rooms').data[0].id, 5)
  assert.equal(cache.snapshot('rooms').hasData, true)
  assert.equal(cache.snapshot('rooms').error, error)
  assert.equal(cache.snapshot('rooms').fetching, false)
  await cache.load('rooms', () => [{ id: 6 }], { force: true })
  assert.equal(cache.snapshot('rooms').data[0].id, 6)
  assert.equal(cache.snapshot('rooms').error, null)
})

test('authorization and missing-route failures stop background retries while explicit refresh and new sessions can recover', async () => {
  for (const status of [401, 403, 404, 405]) {
    const cache = createReceptionistResourceCache()
    cache.setData('records', [{ id: 1 }])
    let requests = 0
    const error = Object.assign(new Error('Read rejected'), { response: { status } })
    const fail = () => { requests++; throw error }
    await assert.rejects(cache.load('records', fail, { force: true }), failure => failure === error)
    for (let tick = 0; tick < 40; tick++) {
      await assert.rejects(cache.load('records', fail, { force: true, background: true }), failure => failure === error)
      await assert.rejects(cache.load('records', fail), failure => failure === error)
    }
    assert.equal(requests, 1)
    assert.deepEqual(cache.snapshot('records').data, [{ id: 1 }])
    assert.equal(cache.snapshot('records').fetching, false)
    await cache.load('records', () => { requests++; return [{ id: 2 }] }, { force: true })
    assert.equal(requests, 2)
    assert.equal(cache.snapshot('records').error, null)
    await assert.rejects(cache.load('records', fail, { force: true }))
    cache.invalidate(['records'])
    await cache.load('records', () => { requests++; return [{ id: 3 }] })
    assert.equal(requests, 4)
    const newSession = createReceptionistResourceCache()
    await newSession.load('records', () => [{ id: 4 }])
    assert.equal(newSession.snapshot('records').data[0].id, 4)
  }
})

test('temporary network and server errors still retry on later background intervals', async () => {
  for (const status of [undefined, 500, 502, 503]) {
    const cache = createReceptionistResourceCache()
    const error = Object.assign(new Error('Temporary failure'), { response: status ? { status } : undefined })
    await assert.rejects(cache.load('records', () => { throw error }))
    await cache.load('records', () => [{ id: 1 }], { background: true, force: true })
    assert.equal(cache.snapshot('records').data[0].id, 1)
  }
})

test('a confirmed check-in cannot be overwritten by a slower earlier background read', async () => {
  const cache = createReceptionistResourceCache()
  await cache.load('checkins', () => [])
  const old = deferred()
  const request = cache.load('checkins', () => old.promise, { force: true })
  cache.setData('checkins', current => [{ id: 7, memberId: 9 }, ...current])
  old.resolve([])
  await request
  assert.equal(cache.snapshot('checkins').data[0].id, 7)
  assert.equal(cache.snapshot('checkins').fetching, false)
})

test('mutation invalidation defers reads until requested and rejects in-flight obsolete results', async () => {
  const cache = createReceptionistResourceCache()
  await cache.load('members', () => [{ memberId: 9 }])
  const old = deferred()
  const request = cache.load('members', () => old.promise, { force: true })
  cache.invalidate(['members'])
  assert.equal(cache.snapshot('members').updatedAt, -Infinity)
  old.resolve([{ memberId: 99 }])
  await request
  assert.equal(cache.snapshot('members').data[0].memberId, 9)
  await cache.load('members', () => [{ memberId: 10 }])
  assert.equal(cache.snapshot('members').data[0].memberId, 10)
})

test('different filters and selected weeks use independent cache entries and invalidation reaches all related views', async () => {
  const cache = createReceptionistResourceCache()
  cache.setData('support:all', [{ id: 1 }])
  cache.setData('support:Closed', [{ id: 2 }])
  cache.setData('sessions:3:4:2026-11-16', [{ id: 3 }])
  cache.setData('profile', { userId: 9 })
  cache.invalidate(['support:*', 'sessions:*'])
  assert.equal(cache.snapshot('support:all').updatedAt, -Infinity)
  assert.equal(cache.snapshot('support:Closed').updatedAt, -Infinity)
  assert.equal(cache.snapshot('sessions:3:4:2026-11-16').updatedAt, -Infinity)
  assert.equal(cache.snapshot('profile').data.userId, 9)
  assert.notEqual(cache.snapshot('profile').updatedAt, -Infinity)
})

test('workspace caches are isolated across accounts and late results cannot refill a cleared session', async () => {
  const first = createReceptionistResourceCache(), second = createReceptionistResourceCache()
  first.setData('profile', { userId: 9 })
  assert.equal(second.snapshot('profile').hasData, false)
  const late = deferred()
  const request = first.load('profile', () => late.promise, { force: true })
  first.clear()
  late.resolve({ userId: 9 })
  await request
  assert.equal(first.snapshot('profile').hasData, false)
  assert.equal(second.snapshot('profile').hasData, false)
})

test('only listeners for changed resources are notified and unsubscribe stops notifications', async () => {
  const cache = createReceptionistResourceCache()
  let members = 0, rooms = 0
  const unsubscribe = cache.subscribe('members', () => members++)
  cache.subscribe('rooms', () => rooms++)
  await cache.load('members', () => [])
  assert.ok(members > 0)
  assert.equal(rooms, 0)
  const count = members
  unsubscribe()
  cache.setData('members', [])
  assert.equal(members, count)
})

test('read prefetch is bounded to two tasks, reuses cache and tolerates a failed optional resource', async () => {
  const cache = createReceptionistResourceCache()
  let active = 0, maximum = 0, calls = 0
  const tasks = Array.from({ length: 8 }, (_, id) => ['read:' + id, async () => {
    active++; calls++; maximum = Math.max(maximum, active)
    await new Promise(resolve => setImmediate(resolve))
    active--
    if (id === 5) throw new Error('Optional resource failed')
    return [id]
  }])
  await prefetchReceptionistResources(cache, tasks)
  assert.equal(calls, 8)
  assert.ok(maximum <= 2)
  assert.equal(cache.snapshot('read:5').hasData, false)
  assert.equal(cache.snapshot('read:7').data[0], 7)
  await cache.load('read:7', tasks[7][1])
  assert.equal(calls, 8)
})

test('leaving the workspace stops scheduling additional prefetch tasks', async () => {
  const cache = createReceptionistResourceCache()
  let cancelled = false, calls = 0
  const tasks = Array.from({ length: 8 }, (_, id) => ['read:' + id, async () => {
    calls++
    cancelled = true
    return [id]
  }])
  await prefetchReceptionistResources(cache, tasks, { isCancelled: () => cancelled })
  assert.ok(calls <= 2)
})
