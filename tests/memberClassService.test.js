import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server
let api
let service
const storageDescriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    storageDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/memberClassService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of storageDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const sessions = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, classId: 10, startsAt: `2099-10-${String(i + 1).padStart(2, '0')}T11:00:00Z`, endsAt: `2099-10-${String(i + 1).padStart(2, '0')}T12:30:00Z`, capacity: 20, currentEnrollment: 2, availableSeats: 18, status: 'Scheduled' }))
const activeSubscription = { id: 1, status: 'Active', startDate: '2000-01-01T00:00:00Z', endDate: '2100-01-01T00:00:00Z' }
function mockApi({ catalog = sessions, registrations = [], subscriptions = [activeSubscription], failAt, lostAt, readError, repeatedPages = false } = {}) {
  const state = { catalog: [...catalog], registrations: [...registrations], posts: [], reads: [] }
  api.defaults.adapter = async config => {
    let data
    if (config.url === '/member-subscriptions/mine') data = subscriptions
    else if (config.method === 'post') {
      const id = Number(config.url.match(/class-sessions\/(\d+)\/registrations/)[1])
      state.posts.push(id)
      if (state.posts.length === failAt) throw new Error('Simulated booking failure')
      assert.ok(!state.registrations.some(item => item.sessionId === id && item.status !== 'Cancelled'), 'A registered session must never be posted twice')
      data = { ...state.catalog.find(item => item.id === id), id: state.registrations.length + 100, sessionId: id, status: 'Registered', sessionStatus: 'Scheduled' }
      state.registrations.push(data)
      if (state.posts.length === lostAt) throw new Error('Response lost after successful registration')
    } else {
      if (readError && config.url === readError) throw new Error('Catalog unavailable')
      const page = Number(config.params.page)
      state.reads.push({ url: config.url, params: config.params })
      const items = config.url === '/class-registrations/mine' ? state.registrations : state.catalog
      const start = repeatedPages ? 0 : (page - 1) * 3
      data = { items: items.slice(start, start + 3), total: items.length, page, pageSize: 3 }
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  return state
}

test('class search uses the classes endpoint with server-side filters and pagination', async () => {
  const state = mockApi()
  await service.getMemberClasses({ search: 'Yoga', sportId: 1, coachId: 5, page: 2, pageSize: 12 })
  assert.equal(state.reads[0].url, '/classes')
  assert.deepEqual(state.reads[0].params, { search: 'Yoga', sportId: 1, coachId: 5, page: 2, pageSize: 12 })
})

test('a selected class loads every session page rather than the first visible page', async () => {
  const state = mockApi()
  const result = await service.getMemberClassSessions(10)
  assert.equal(result.items.length, 15)
  assert.deepEqual(state.reads.map(item => item.params.page), [1, 2, 3, 4, 5])
  assert.ok(state.reads.every(item => item.url === '/classes/10/sessions'))
})

test('register all includes later pages and skips registered, past, cancelled and full sessions', async () => {
  const catalog = [...sessions,
    { ...sessions[0], id: 16, startsAt: '2000-01-01T11:00:00Z' },
    { ...sessions[0], id: 17, status: 'Cancelled' },
    { ...sessions[0], id: 18, currentEnrollment: 20, availableSeats: 0 },
  ]
  const state = mockApi({ catalog, registrations: [{ id: 100, sessionId: 1, status: 'Registered' }] })
  const result = await service.bookClassSessions({ classId: 10, sessionIds: catalog.map(item => item.id) })
  assert.deepEqual(state.posts, sessions.slice(1).map(item => item.id))
  assert.equal(result.registered.length, 14)
  assert.deepEqual(result.existing, ['1'])
  assert.deepEqual(result.skipped.map(item => item.id), ['16', '17', '18'])
  assert.equal(result.remaining.length, 0)
})

test('a partial failure retains successful registrations and retry processes only the remainder', async () => {
  const state = mockApi({ failAt: 3 })
  const first = await service.bookClassSessions({ classId: 10, sessionIds: [1, 2, 3, 4, 5] })
  assert.deepEqual(first.registered, ['1', '2'])
  assert.deepEqual(first.remaining, ['3', '4', '5'])
  assert.equal(state.posts.length, 3)
  const retry = await service.bookClassSessions({ classId: 10, sessionIds: first.remaining })
  assert.equal(retry.remaining.length, 0)
  assert.equal(state.registrations.length, 5)
  assert.deepEqual(state.posts, [1, 2, 3, 3, 4, 5])
})

test('a lost successful response is reconciled before another registration is attempted', async () => {
  const state = mockApi({ lostAt: 2 })
  const result = await service.bookClassSessions({ classId: 10, sessionIds: [1, 2, 3] })
  assert.deepEqual(state.posts, [1, 2, 3])
  assert.deepEqual(result.registered, ['1', '2', '3'])
  assert.equal(result.remaining.length, 0)
})

test('repeating the same batch is idempotent, while cancelled registrations can be booked again', async () => {
  const state = mockApi({ registrations: [{ id: 100, sessionId: 1, status: 'Cancelled' }] })
  await service.bookClassSessions({ classId: 10, sessionIds: [1, 1, 2] })
  const again = await service.bookClassSessions({ classId: 10, sessionIds: [1, 2] })
  assert.deepEqual(state.posts, [1, 2])
  assert.deepEqual(again.existing, ['1', '2'])
})

test('missing membership, unavailable registration history and invalid repeated pages block every POST', async () => {
  for (const options of [{ subscriptions: [] }, { subscriptions: [{ ...activeSubscription, status: 'Pending' }] }, { subscriptions: [{ ...activeSubscription, endDate: '2001-01-01' }] }, { readError: '/class-registrations/mine' }, { repeatedPages: true }]) {
    const state = mockApi(options)
    await assert.rejects(service.bookClassSessions({ classId: 10, sessionIds: [1, 2] }))
    assert.equal(state.posts.length, 0)
  }
})

test('only consented sessions from the selected class are booked even if the class gains more sessions', async () => {
  const state = mockApi({ catalog: [...sessions, { ...sessions[0], id: 90, classId: 99 }] })
  const result = await service.bookClassSessions({ classId: 10, sessionIds: [1, 90, 999] })
  assert.deepEqual(state.posts, [1])
  assert.deepEqual(result.skipped.map(item => item.id), ['90', '999'])
})

test('booking reloads every registration page and skips overlaps with another class before POST', async () => {
  const registrations = Array.from({ length: 4 }, (_, i) => ({
    ...sessions[0], id: 100 + i, sessionId: 90 + i, classId: 99, status: 'Registered', sessionStatus: 'Scheduled',
    startsAt: i === 3 ? sessions[0].startsAt : '2099-09-01T11:00:00Z',
    endsAt: i === 3 ? sessions[0].endsAt : '2099-09-01T12:30:00Z',
  }))
  const state = mockApi({ registrations })
  const result = await service.bookClassSessions({ classId: 10, sessionIds: [1, 2] })
  assert.deepEqual(state.posts, [2])
  assert.deepEqual(result.skipped.map(item => item.id), ['1'])
  assert.match(result.skipped[0].reason, /Trùng lịch/)
  assert.deepEqual(state.reads.filter(item => item.url === '/class-registrations/mine').map(item => item.params.page), [1, 2])
})

test('a batch cannot book overlapping sessions even after recovering a lost successful response', async () => {
  const catalog = [sessions[0], { ...sessions[0], id: 2, startsAt: '2099-10-01T12:00:00Z', endsAt: '2099-10-01T13:00:00Z' }, sessions[2]]
  for (const lostAt of [undefined, 1]) {
    const state = mockApi({ catalog, lostAt })
    const result = await service.bookClassSessions({ classId: 10, sessionIds: [1, 2, 3] })
    assert.deepEqual(state.posts, [1, 3])
    assert.deepEqual(result.registered, ['1', '3'])
    assert.deepEqual(result.skipped.map(item => item.id), ['2'])
    assert.match(result.skipped[0].reason, /Trùng lịch/)
  }
})

test('cancelled registrations free the time slot and adjacent sessions remain bookable', async () => {
  const registrations = [
    { ...sessions[0], id: 100, sessionId: 90, status: 'Cancelled' },
    { ...sessions[1], id: 101, sessionId: 91, status: 'Registered', startsAt: '2099-10-02T10:00:00Z', endsAt: sessions[1].startsAt },
    { ...sessions[2], id: 102, sessionId: 92, status: 'Registered', sessionStatus: 'Cancelled' },
  ]
  const state = mockApi({ registrations })
  await service.bookClassSessions({ classId: 10, sessionIds: [1, 2, 3] })
  assert.deepEqual(state.posts, [1, 2, 3])
})

const completedRegistration = { id: 101, sessionId: 10, classId: 1, status: 'Completed', sessionStatus: 'Completed', attendanceStatus: 'Present', startsAt: '2020-10-19T11:00:00Z', endsAt: '2020-10-19T12:30:00Z', hasReviewed: false }

function mockReview(registrations, { readError = false, failPost = false } = {}) {
  const calls = [], posts = []
  api.defaults.adapter = async config => {
    calls.push(config.url)
    let data
    if (config.method === 'post') {
      posts.push({ url: config.url, payload: JSON.parse(config.data) })
      if (failPost) throw new Error('Điểm danh vừa được cập nhật trên máy chủ.')
      data = { id: 200, registrationId: 101, ...JSON.parse(config.data) }
    } else {
      assert.equal(config.url, '/class-registrations/mine')
      if (readError) throw new Error('Không tải được điểm danh mới nhất.')
      const page = Number(config.params.page)
      data = { items: registrations.slice(page - 1, page), total: registrations.length, page, pageSize: 1 }
    }
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
  return { calls, posts }
}

test('review validates fresh participation on later pages before posting a rating, including Late attendance', async () => {
  for (const attendanceStatus of ['Present', 'Late']) {
    const state = mockReview([{ ...completedRegistration, id: 99, attendanceStatus: 'Absent' }, { ...completedRegistration, attendanceStatus }])
    const saved = await service.reviewRegistration(101, { rating: 5, comment: '  Buổi học tốt  ' })
    assert.equal(saved.registrationId, 101)
    assert.deepEqual(state.calls, ['/class-registrations/mine', '/class-registrations/mine', '/class-registrations/101/review'])
    assert.deepEqual(state.posts[0].payload, { rating: 5, comment: 'Buổi học tốt' })
  }
})

test('review sends no POST for missing participation, timestamp-only attendance, incomplete or already reviewed registrations', async () => {
  for (const changes of [
    { attendanceStatus: 'Absent', checkInTime: '2020-10-19T11:01:00Z' }, { attendanceStatus: 'Excused' },
    { attendanceStatus: null }, { attendanceStatus: undefined }, { attendanceStatus: 'NoShow' },
    { attendanceStatus: 'CheckedIn' }, { attendanceStatus: 'Attended' },
    { status: 'Registered' }, { sessionStatus: 'Scheduled' }, { sessionStatus: 'Cancelled' },
    { endsAt: '2099-10-19T12:30:00Z' }, { endsAt: null }, { hasReviewed: true }, { canReview: false },
  ]) {
    const state = mockReview([{ ...completedRegistration, canReview: true, ...changes }])
    await assert.rejects(service.reviewRegistration(101, { rating: 5 }))
    assert.equal(state.posts.length, 0)
  }
})

test('failed attendance reads, missing registrations and server conflicts do not report a successful review', async () => {
  for (const setup of [() => mockReview([], { readError: true }), () => mockReview([])]) {
    const state = setup()
    await assert.rejects(service.reviewRegistration(101, { rating: 5 }))
    assert.equal(state.posts.length, 0)
  }
  const state = mockReview([completedRegistration], { failPost: true })
  await assert.rejects(service.reviewRegistration(101, { rating: 5 }), /Điểm danh vừa được cập nhật/)
  assert.equal(state.posts.length, 1)
})

test('invalid ratings and oversized comments are rejected before checking participation or posting', async () => {
  const state = mockReview([completedRegistration])
  for (const rating of [0, 6, 1.5, '5', undefined]) await assert.rejects(service.reviewRegistration(101, { rating }))
  await assert.rejects(service.reviewRegistration(101, { rating: 5, comment: 'a'.repeat(2001) }))
  assert.deepEqual(state.calls, [])
})
