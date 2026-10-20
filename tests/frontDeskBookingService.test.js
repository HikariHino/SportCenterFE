import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const storage = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    storage.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/frontDeskBookingService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of storage) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const sessions = [1, 2, 3].map(id => ({ id, classId: 10, startsAt: `2099-10-${20 + id}T11:00:00Z`, endsAt: `2099-10-${20 + id}T12:30:00Z`, status: 'Scheduled', capacity: 20, currentEnrollment: 0, availableSeats: 20 }))
const options = { classId: 10, memberId: 1, sessionIds: [1, 2, 3] }
const saved = (id, changes = {}) => ({ id: 100 + id, ...sessions[id - 1], sessionId: id, memberId: 1, status: 'Registered', sessionStatus: 'Scheduled', ...changes })
function mockApi({ registrations = [], catalog = sessions, subscriptions = [{ status: 'Active', startDate: '2000-01-01T00:00:00Z', endDate: '2100-01-01T00:00:00Z' }], member = { memberId: 1, isActive: true }, repeatedPages = false, failAt, lostAt, afterPost } = {}) {
  const state = { registrations: [...registrations], catalog: [...catalog], posts: [], reads: [], failReads: false }
  api.defaults.adapter = async config => {
    const url = config.url
    let data
    if (config.method === 'post') {
      const id = Number(url.match(/class-sessions\/(\d+)\/registrations\/members\/1/)[1])
      state.posts.push(id)
      if (state.posts.length === failAt) throw new Error('Booking failed')
      assert.ok(!state.registrations.some(item => String(item.sessionId) === String(id) && item.status !== 'Cancelled'), 'Never POST an existing registration twice')
      data = { ...state.catalog.find(item => item.id === id), id: 1000 + state.registrations.length, sessionId: id, status: 'Registered', sessionStatus: 'Scheduled', classId: 10 }
      state.registrations.push(data)
      afterPost?.(state, id)
      if (state.posts.length === lostAt) throw new Error('Response lost')
    } else {
      state.reads.push(url)
      if (state.failReads) throw new Error('Timetable unavailable')
      if (url === '/members/1') data = member
      else if (url === '/member-subscriptions/members/1') data = subscriptions
      else if (url === '/classes/10') data = { id: 10, isActive: true }
      else {
        const source = url === '/classes' ? [{ id: 10 }, { id: 20 }, { id: 30 }] : url.includes('/class-registrations/') ? state.registrations : state.catalog
        const page = Number(config.params.page)
        data = { items: source.slice(repeatedPages ? 0 : page - 1, repeatedPages ? 1 : page), total: source.length, page }
      }
    }
    return { data: { success: true, data }, status: 200, statusText: 'OK', headers: {}, config }
  }
  return state
}

test('loads all class, session and member registration pages', async () => {
  mockApi({ registrations: [saved(1), saved(2), saved(3)] })
  assert.equal((await service.getFrontDeskBookingClasses()).length, 3)
  assert.equal((await service.getFrontDeskBookingSessions(10)).length, 3)
  assert.equal((await service.getFrontDeskMemberBooking(1)).registrations.length, 3)
})

test('registers selected sessions only, skips already booked sessions and permits remaining sessions of that class', async () => {
  const state = mockApi({ registrations: [saved(1)] })
  const result = await service.registerFrontDeskClassSessions({ ...options, sessionIds: [1, 3, 3] })
  assert.deepEqual(state.posts, [3])
  assert.deepEqual(result.registered, ['3'])
  assert.deepEqual(result.existing, ['1'])
  assert.equal(result.error, '')
  assert.ok(!state.registrations.some(item => item.sessionId === 2))
})

test('a conflict on a later registration page blocks all selected writes before booking', async () => {
  const state = mockApi({ registrations: [saved(1, { status: 'Cancelled' }), saved(2, { sessionId: 200, classId: 20, className: 'Boxing', startsAt: '2099-10-22T11:30:00Z' })] })
  const result = await service.registerFrontDeskClassSessions(options)
  assert.equal(state.posts.length, 0)
  assert.equal(result.blocked[0].id, '2')
  assert.match(result.blocked[0].reason, /Boxing/)
})

test('a cancelled registration can be rebooked and adjacent slots are allowed', async () => {
  const state = mockApi({ registrations: [saved(1, { status: 'Cancelled' }), saved(2, { sessionId: 200, classId: 20, startsAt: sessions[0].endsAt, endsAt: '2099-10-21T14:00:00Z' })] })
  const result = await service.registerFrontDeskClassSessions({ ...options, sessionIds: [1] })
  assert.deepEqual(state.posts, [1])
  assert.equal(result.registered.length, 1)
})

test('selecting a cancelled, full, missing or internally conflicting session never creates a partial selection', async () => {
  for (const catalog of [[sessions[0], { ...sessions[1], status: 'Cancelled' }, sessions[2]], [sessions[0], { ...sessions[1], availableSeats: 0 }, sessions[2]], [sessions[0]], [sessions[0], { ...sessions[0], id: 2 }]]) {
    const state = mockApi({ catalog })
    const result = await service.registerFrontDeskClassSessions({ ...options, sessionIds: [1, 2] })
    assert.equal(state.posts.length, 0)
    assert.ok(result.error)
  }
})

test('inactive members, expired packages and incomplete or repeated schedule pages fail closed', async () => {
  for (const setup of [{ member: { memberId: 1, isActive: false } }, { subscriptions: [] }, { subscriptions: [{ status: 'Active', startDate: '2000-01-01', endDate: '2001-01-01' }] }, { registrations: [saved(1, { startsAt: null })] }, { registrations: [saved(1), saved(2)], repeatedPages: true }]) {
    const state = mockApi(setup)
    await assert.rejects(service.registerFrontDeskClassSessions(options))
    assert.equal(state.posts.length, 0)
  }
})

test('conflicts introduced after the first booking stop later writes and preserve confirmed seats', async () => {
  const state = mockApi({ afterPost: (current, id) => { if (id === 1) current.registrations.push(saved(2, { sessionId: 200, classId: 20, className: 'Boxing' })) } })
  const result = await service.registerFrontDeskClassSessions(options)
  assert.deepEqual(state.posts, [1])
  assert.deepEqual(result.registered, ['1'])
  assert.deepEqual(result.remaining, ['2', '3'])
  assert.match(result.error, /Boxing/)
})

test('a partial failure is retryable and a lost successful response is reconciled without duplicate POSTs', async () => {
  const state = mockApi({ failAt: 2 })
  const first = await service.registerFrontDeskClassSessions(options)
  assert.deepEqual(first.registered, ['1'])
  assert.deepEqual(first.remaining, ['2', '3'])
  const retry = await service.registerFrontDeskClassSessions({ ...options, sessionIds: first.remaining })
  assert.equal(retry.error, '')
  assert.deepEqual(state.posts, [1, 2, 2, 3])
  const lost = mockApi({ lostAt: 2 })
  const result = await service.registerFrontDeskClassSessions(options)
  assert.equal(result.error, '')
  assert.deepEqual(lost.posts, [1, 2, 3])
  assert.equal(result.registered.length, 3)
})

test('concurrent submissions for the same member are serialized and re-read the saved timetable', async () => {
  const state = mockApi()
  const result = await Promise.all([service.registerFrontDeskClassSessions(options), service.registerFrontDeskClassSessions(options)])
  assert.deepEqual(state.posts, [1, 2, 3])
  assert.equal(result[0].registered.length, 3)
  assert.equal(result[1].existing.length, 3)
})

test('a failed timetable refresh during a batch stops further writes', async () => {
  const state = mockApi({ afterPost: current => { current.failReads = true } })
  const result = await service.registerFrontDeskClassSessions(options)
  assert.deepEqual(state.posts, [1])
  assert.deepEqual(result.remaining, ['2', '3'])
  assert.match(result.error, /Timetable unavailable/)
})
