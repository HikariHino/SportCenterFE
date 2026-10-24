import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { buildDatedSession } from '../src/utils/sessionScheduling.js'

let server
let api
let createRecurringRoomSessions
let getRoomTimetable
let assignClassToRoom
let rescheduleRoomSession
let cancelRoomSessions
let cancelSessionsForClass
let classService
const storageDescriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    storageDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  const service = await server.ssrLoadModule('/src/services/roomTimetableService.js')
  createRecurringRoomSessions = service.createRecurringRoomSessions
  getRoomTimetable = service.getRoomTimetable
  assignClassToRoom = service.assignClassToRoom
  rescheduleRoomSession = service.rescheduleRoomSession
  cancelRoomSessions = service.cancelRoomSessions
  cancelSessionsForClass = (await server.ssrLoadModule('/src/services/classSessionCancellationService.js')).cancelSessionsForClass
  classService = await server.ssrLoadModule('/src/services/sportClassService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of storageDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const room = { id: 1, name: 'Studio Yoga 01', capacity: 25, isActive: true }
const sportClass = { id: 10, roomId: 1, coachId: 5, className: 'Yoga', sportId: 1, price: 0, maxCapacity: 20, startDate: '2099-10-19', endDate: '2099-11-19', isActive: true }
const sessions = ['2099-10-26', '2099-10-28', '2099-10-30'].map(date => ({ date, startsAt: `${date}T11:00:00.000Z`, endsAt: `${date}T12:30:00.000Z` }))
const options = { room, rooms: [room], sportClass, coachId: 5, cancellationPolicyId: 1, capacity: 20, sessions }

test('class cancellation loads every session page and only cancels selected sessions of the chosen class', async () => {
  const saved = sessions.map((item, index) => ({ ...item, id: index + 100, classId: 10, status: 'Scheduled' }))
  const writes = [], reads = []
  api.defaults.adapter = async config => {
    if (config.method === 'post') {
      writes.push(config.url)
      return { data: '', status: 204, statusText: 'No Content', headers: {}, config }
    }
    assert.equal(config.url, '/classes/10/sessions')
    const page = Number(config.params.page)
    reads.push(page)
    return { data: { items: saved.slice(page - 1, page), total: saved.length, page }, status: 200, statusText: 'OK', headers: {}, config }
  }
  const result = await cancelSessionsForClass({ classId: 10, sessions: [saved[0], saved[2]], reason: 'HLV nghỉ' })
  assert.deepEqual(reads, [1, 2, 3])
  assert.deepEqual(writes, ['/class-sessions/100/cancel', '/class-sessions/102/cancel'])
  assert.deepEqual(result.cancelled.map(item => item.id), [100, 102])
  assert.deepEqual(result.failed, [])
})

test('class cancellation rejects foreign, missing or rescheduled sessions before any mutation', async () => {
  const selected = { ...sessions[0], id: 100, classId: 10, status: 'Scheduled' }
  for (const items of [[], [{ ...selected, classId: 20 }], [{ ...selected, startsAt: '2099-10-27T11:00:00Z' }]]) {
    const writes = []
    api.defaults.adapter = async config => {
      if (config.method === 'post') writes.push(config.url)
      return { data: { items, total: items.length, page: 1 }, status: 200, statusText: 'OK', headers: {}, config }
    }
    await assert.rejects(cancelSessionsForClass({ classId: 10, sessions: [selected], reason: 'HLV nghỉ' }), /thuộc lớp|đã thay đổi/)
    assert.deepEqual(writes, [])
  }
})

test('class cancellation uses the latest status and never cancels a session already completed', async () => {
  const selected = { ...sessions[0], id: 100, classId: 10, status: 'Scheduled' }
  const writes = []
  api.defaults.adapter = async config => {
    if (config.method === 'post') writes.push(config.url)
    return { data: { items: [{ ...selected, status: 'Completed' }], total: 1, page: 1 }, status: 200, statusText: 'OK', headers: {}, config }
  }
  const result = await cancelSessionsForClass({ classId: 10, sessions: [selected], reason: 'HLV nghỉ' })
  assert.deepEqual(result.cancelled, [])
  assert.equal(result.failed[0].session.id, 100)
  assert.deepEqual(writes, [])
})

test('class cancellation aborts when the latest schedule cannot be read', async () => {
  let writes = 0
  api.defaults.adapter = async config => {
    if (config.method === 'post') writes += 1
    throw new Error('Lỗi tải lịch lớp')
  }
  await assert.rejects(cancelSessionsForClass({ classId: 10, sessions: [{ ...sessions[0], id: 100, classId: 10 }], reason: 'HLV nghỉ' }), /Lỗi tải lịch lớp/)
  assert.equal(writes, 0)
})

test('bulk cancellation sends one request per selected ID, continues on failure, and retries only failed sessions', async () => {
  const writes = [], progress = []
  let fail = true, active = 0, maxActive = 0
  api.defaults.adapter = async config => {
    assert.equal(config.method, 'post')
    writes.push({ url: config.url, reason: JSON.parse(config.data).reason })
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise(resolve => setTimeout(resolve, 2))
    active -= 1
    if (fail && config.url === '/class-sessions/102/cancel') throw new Error('Buổi 102 không thể hủy')
    return { data: '', status: 204, statusText: 'No Content', headers: {}, config }
  }
  const selected = [101, 102, 103, 101].map(id => ({ id, ...sessions[0], status: 'Scheduled' }))
  const result = await cancelRoomSessions({ sessions: selected, reason: '  Bảo trì phòng  ' }, value => progress.push(value))
  assert.deepEqual(result.cancelled.map(item => item.id), [101, 103])
  assert.deepEqual(result.failed.map(item => item.session.id), [102])
  assert.match(result.failed[0].message, /102/)
  assert.equal(writes.length, 3)
  assert.ok(writes.every(item => item.reason === 'Bảo trì phòng'))
  assert.equal(maxActive, 1)
  assert.deepEqual(progress, [{ completed: 1, total: 3 }, { completed: 2, total: 3 }, { completed: 3, total: 3 }])
  fail = false
  const retry = await cancelRoomSessions({ sessions: result.failed.map(item => item.session), reason: 'Bảo trì phòng' })
  assert.deepEqual(retry.cancelled.map(item => item.id), [102])
  assert.deepEqual(retry.failed, [])
  assert.deepEqual(writes.slice(3).map(item => item.url), ['/class-sessions/102/cancel'])
})

test('bulk cancellation rejects missing reasons and empty selections before sending any request', async () => {
  let calls = 0
  api.defaults.adapter = async () => { calls += 1; throw new Error('Unexpected API call') }
  for (const reason of ['', '   ', 'a'.repeat(501)]) {
    await assert.rejects(cancelRoomSessions({ sessions: [{ id: 101, ...sessions[0] }], reason }), /lý do/)
  }
  await assert.rejects(cancelRoomSessions({ sessions: [], reason: 'Bảo trì' }), /ít nhất một buổi/)
  assert.equal(calls, 0)
})

test('bulk cancellation excludes completed, cancelled and started sessions while processing valid selections', async () => {
  const writes = []
  api.defaults.adapter = async config => {
    writes.push(config.url)
    return { data: '', status: 204, statusText: 'No Content', headers: {}, config }
  }
  const selected = [
    { id: 101, ...sessions[0], status: 'Completed' },
    { id: 102, ...sessions[0], status: 'Cancelled' },
    { id: 103, startsAt: '2000-01-01T00:00:00Z', status: 'Scheduled' },
    { id: 104, ...sessions[0], status: 'Scheduled' },
  ]
  const result = await cancelRoomSessions({ sessions: selected, reason: 'Bảo trì' })
  assert.deepEqual(writes, ['/class-sessions/104/cancel'])
  assert.deepEqual(result.cancelled.map(item => item.id), [104])
  assert.deepEqual(result.failed.map(item => item.session.id), [101, 102, 103])
})

function mockApi({ conflictAt, unavailableResponse, availabilityError, failAt, loseResponseAt, saved = [], course = sportClass, failAssignment, ignoreAssignment, serverRoom = room, otherClasses = [], otherSaved = {}, roomReadError = false } = {}) {
  const state = { course: { ...course }, serverRoom: { ...serverRoom }, saved: [...saved], posts: [], puts: [], reads: [], availability: [] }
  api.defaults.adapter = async config => {
    let data
    if (config.url === '/Rooms') {
      if (roomReadError) throw new Error('Room API unavailable')
      data = [state.serverRoom, { id: 2, name: 'Gym', capacity: 25, isActive: true }]
    } else if (config.url === '/classes/manage') data = { items: [{ ...state.course }, ...otherClasses], total: 1 + otherClasses.length }
    else if (config.url === '/classes/10' && config.method === 'put') {
      state.puts.push(JSON.parse(config.data))
      if (failAssignment) throw new Error('Class update failed')
      if (!ignoreAssignment) state.course = { ...state.course, ...JSON.parse(config.data) }
      data = { ...state.course }
    } else if (config.url === '/classes/10') data = { ...state.course }
    else if (config.url.endsWith('/check-availability')) {
      state.availability.push(config.params.startsAt)
      if (availabilityError) throw new Error('Availability API unavailable')
      data = unavailableResponse ? {} : { isAvailable: config.params.startsAt !== conflictAt }
    } else if (config.method === 'post') {
      const payload = JSON.parse(config.data)
      state.posts.push(payload)
      if (state.posts.length === failAt) throw new Error('Create request failed')
      // Match the real API: SessionRequest silently ignores roomId.
      const { roomId: ignoredRoomId, ...stored } = payload
      data = { id: state.saved.length + 100, ...stored, status: 'Scheduled' }
      state.saved.push(data)
      if (state.posts.length === loseResponseAt) throw new Error('Response lost after saving')
    } else {
      const page = Number(config.params.page)
      state.reads.push(page)
      // Force multiple pages when reconciling already-created sessions.
      const classId = Number(config.url.match(/classes\/(\d+)/)?.[1])
      const source = classId === 10 ? state.saved : otherSaved[classId] || []
      data = { items: source.slice(page - 1, page), total: source.length, page, pageSize: 1 }
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  return state
}

test('a dated session is saved once and a repeated submission reuses the saved session', async () => {
  const item = buildDatedSession({ date: '2099-10-26', startTime: '18:00', endTime: '19:30' }, { sportClass })
  const state = mockApi()
  const request = { ...options, sessions: [item] }
  const result = await createRecurringRoomSessions(request)
  assert.equal(result.created.length, 1)
  assert.equal(state.posts.length, 1)
  assert.equal(state.posts[0].startsAt, item.startsAt)
  assert.equal(state.posts[0].endsAt, item.endsAt)
  const retry = await createRecurringRoomSessions(request)
  assert.equal(retry.created.length, 0)
  assert.equal(retry.existing.length, 1)
  assert.equal(state.posts.length, 1)
})

test('cancelling one session and reloading the room preserves all twelve other scheduled sessions', async () => {
  const stored = [
    { id: 100, ...sessions[0], coachId: 5, capacity: 20, status: 'Scheduled' },
    ...Array.from({ length: 12 }, (_, index) => ({ id: index + 101, ...sessions[index % 3], coachId: 5, capacity: 20, status: 'Scheduled' })),
  ]
  const writes = []
  api.defaults.adapter = async config => {
    let data
    if (config.method === 'post') {
      writes.push(config.url)
      assert.equal(config.url, '/class-sessions/100/cancel')
      stored[0] = { ...stored[0], status: 'Cancelled', cancellationReason: JSON.parse(config.data).reason }
      return { data: '', status: 204, statusText: 'No Content', headers: {}, config }
    }
    if (config.url === '/classes/manage') data = { items: [sportClass], total: 1 }
    else {
      assert.equal(config.url, '/classes/10/sessions')
      const page = Number(config.params.page)
      data = { items: stored.slice((page - 1) * 5, page * 5), total: stored.length, page, pageSize: 5 }
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  const before = await getRoomTimetable(room, [room])
  await classService.cancelClassSession(100, ' Bảo trì phòng ')
  const after = await getRoomTimetable(room, [room])
  assert.deepEqual(writes, ['/class-sessions/100/cancel'])
  assert.equal(after.items.length, 13)
  assert.equal(after.items[0].status, 'Cancelled')
  assert.equal(after.items[0].cancellationReason, 'Bảo trì phòng')
  assert.deepEqual(after.items.slice(1), before.items.slice(1))
  assert.equal(after.items.filter(item => item.status === 'Scheduled').length, 12)
})

test('a dated session is rejected if the class period changes after the form was filled', async () => {
  const item = buildDatedSession({ date: '2099-10-26', startTime: '18:00', endTime: '19:30' }, { sportClass })
  const state = mockApi({ course: { ...sportClass, endDate: '2099-10-26T12:00:00Z' } })
  const result = await createRecurringRoomSessions({ ...options, sessions: [item] })
  assert.equal(result.conflicts.length, 1)
  assert.match(result.conflicts[0].message, /bắt đầu và kết thúc của lớp/)
  assert.equal(state.posts.length, 0)
  assert.equal(state.puts.length, 0)
})

test('a conflict anywhere blocks every create request for the series', async () => {
  const state = mockApi({ conflictAt: sessions[1].startsAt })
  const result = await createRecurringRoomSessions(options)
  assert.equal(state.posts.length, 0)
  assert.equal(state.availability.length, 3)
  assert.equal(result.conflicts.length, 1)
  assert.equal(result.conflicts[0].date, sessions[1].date)
  assert.equal(result.phase, 'checking')
})

test('unavailable or malformed availability responses never permit writes', async () => {
  for (const failure of [{ availabilityError: true }, { unavailableResponse: true }]) {
    const state = mockApi(failure)
    const result = await createRecurringRoomSessions(options)
    assert.equal(state.posts.length, 0)
    assert.equal(result.conflicts.length, 3)
  }
})

test('creation stops at the first failure and retry processes only the remaining dates', async () => {
  const first = mockApi({ failAt: 2 })
  const result = await createRecurringRoomSessions(options)
  assert.equal(result.created.length, 1)
  assert.equal(first.posts.length, 2)
  assert.deepEqual(result.remaining.map(item => item.date), sessions.slice(1).map(item => item.date))
  const retry = mockApi({ saved: first.saved })
  const completed = await createRecurringRoomSessions({ ...options, sessions: result.remaining })
  assert.equal(completed.remaining.length, 0)
  assert.equal(retry.posts.length, 2)
  assert.equal(retry.saved.length, 3)
  assert.ok(retry.posts.every(item => item.roomId === 1 && item.coachId === 5 && item.capacity === 20 && item.cancellationPolicyId === 1))
})

test('a saved session with a lost response is reconciled before retry', async () => {
  const first = mockApi({ loseResponseAt: 2 })
  const result = await createRecurringRoomSessions(options)
  assert.equal(result.created.length, 1)
  assert.equal(first.saved.length, 2)
  const retry = mockApi({ saved: first.saved })
  const completed = await createRecurringRoomSessions({ ...options, sessions: result.remaining })
  assert.equal(completed.existing.length, 1)
  assert.equal(retry.posts.length, 1)
  assert.equal(retry.saved.length, 3)
  assert.equal(new Set(retry.saved.map(item => item.startsAt)).size, 3)
})

test('existing sessions are read across all pages and are not created twice', async () => {
  const saved = sessions.map((item, index) => ({ id: index + 100, ...item, coachId: 5, roomId: 1, status: 'Scheduled' }))
  const state = mockApi({ saved })
  const result = await createRecurringRoomSessions(options)
  assert.ok(state.reads.includes(3), 'Reconciliation includes the final session page')
  assert.equal(result.existing.length, 3)
  assert.equal(result.remaining.length, 0)
  assert.equal(state.posts.length, 0)
  assert.equal(state.availability.length, 0)
})

test('cancelled sessions do not block creating a replacement', async () => {
  const state = mockApi({ saved: [{ id: 100, ...sessions[0], roomId: 1, coachId: 5, status: 'Cancelled' }] })
  const result = await createRecurringRoomSessions({ ...options, sessions: sessions.slice(0, 1) })
  assert.equal(result.existing.length, 0)
  assert.equal(result.created.length, 1)
  assert.equal(state.posts.length, 1)
})

test('new schedules persist room metadata when the session API ignores roomId', async () => {
  const course = { ...sportClass, roomId: undefined, schedule: 'Lịch cũ' }
  const state = mockApi({ course })
  const result = await createRecurringRoomSessions({ ...options, sportClass: course })
  assert.equal(result.created.length, 3)
  assert.equal(state.puts.length, 1)
  assert.equal(state.course.schedule, '[Phòng: Studio Yoga 01] Lịch cũ')
  for (const key of ['className', 'sportId', 'coachId', 'maxCapacity', 'isActive']) assert.equal(state.puts[0][key], course[key])
  assert.equal(Object.hasOwn(state.puts[0], 'price'), false)
  assert.ok(state.saved.every(item => item.roomId == null))
  const reloaded = await getRoomTimetable(room, [room])
  assert.equal(reloaded.items.length, 3)
  assert.equal(reloaded.unassignedClasses.length, 0)
  assert.ok(reloaded.items.every(item => item.roomId === room.id))
  assert.equal((await getRoomTimetable({ id: 2, name: 'Gym' }, [room])).items.length, 0)
})

test('old sessions without room metadata are reported for explicit assignment, without guessing by sport', async () => {
  const course = { ...sportClass, roomId: undefined, schedule: null, sportName: 'Yoga' }
  const saved = sessions.map((item, index) => ({ id: index + 100, ...item, capacity: 20 }))
  const state = mockApi({ course, saved })
  const before = await getRoomTimetable(room, [room])
  assert.equal(before.items.length, 0)
  assert.equal(before.unassignedClasses[0].unassignedCount, 3)
  await assignClassToRoom({ classId: course.id, room, rooms: [room] })
  const after = await getRoomTimetable(room, [room])
  assert.equal(after.items.length, 3)
  assert.equal(after.unassignedClasses.length, 0)
  assert.equal(state.posts.length, 0, 'Repair does not recreate existing sessions')
})

test('retry reconciles roomless API responses using the room metadata saved during the first attempt', async () => {
  const course = { ...sportClass, roomId: undefined, schedule: null }
  const state = mockApi({ course, loseResponseAt: 2 })
  const first = await createRecurringRoomSessions({ ...options, sportClass: course })
  const completed = await createRecurringRoomSessions({ ...options, sportClass: course, sessions: first.remaining })
  assert.equal(completed.existing.length, 1)
  assert.equal(state.saved.length, 3)
  assert.equal(state.puts.length, 1)
})

test('room linking failures stop creation instead of saving sessions that disappear from the room', async () => {
  const course = { ...sportClass, roomId: undefined, schedule: null }
  for (const failure of [{ failAssignment: true }, { ignoreAssignment: true }]) {
    const state = mockApi({ course, ...failure })
    await assert.rejects(createRecurringRoomSessions({ ...options, sportClass: course }))
    assert.equal(state.posts.length, 0)
  }
})

test('creating in another room cannot silently move all existing class sessions', async () => {
  const state = mockApi()
  await assert.rejects(createRecurringRoomSessions({ ...options, room: { id: 2, name: 'Gym' } }), /đã được gán/)
  assert.equal(state.posts.length, 0)
  assert.equal(state.puts.length, 0)
})

test('repair refuses room assignment when existing sessions exceed the room capacity', async () => {
  const state = mockApi({ course: { ...sportClass, roomId: undefined }, saved: [{ id: 100, ...sessions[0], capacity: 20 }], serverRoom: { ...room, capacity: 10 } })
  await assert.rejects(assignClassToRoom({ classId: 10, room: { ...room, capacity: 10 }, rooms: [room] }), /Sức chứa/)
  assert.equal(state.puts.length, 0)
})

test('repair refuses to place unassigned sessions over another class in the target room', async () => {
  let writes = 0
  const course = { ...sportClass, roomId: undefined }
  api.defaults.adapter = async config => {
    let data
    if (config.method === 'put') { writes += 1; throw new Error('Unexpected room assignment') }
    if (config.url === '/classes/10') data = course
    else if (config.url === '/Rooms') data = [room]
    else if (config.url === '/classes/manage') data = { items: [course, { ...sportClass, id: 20 }], total: 2 }
    else data = { items: [{ id: config.url.includes('/20/') ? 200 : 100, ...sessions[0], capacity: 20, status: 'Scheduled' }], total: 1 }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  await assert.rejects(assignClassToRoom({ classId: 10, room, rooms: [room] }), /trùng/)
  assert.equal(writes, 0)
})

const movable = { id: 100, classId: 10, startsAt: '2099-10-26T11:00:00Z', endsAt: '2099-10-26T12:30:00Z', coachId: 5, cancellationPolicyId: 7, capacity: 18, status: 'Scheduled', currentEnrollment: 0 }
const changedTime = { date: '2099-10-26', startTime: '18:30', endTime: '20:00' }
function mockRescheduleApi({ current = movable, otherClasses = [], otherSessions = {}, failUpdate = false } = {}) {
  const state = { puts: [], classes: [sportClass, ...otherClasses], sessions: { 10: current ? [{ ...current }] : [], ...otherSessions } }
  api.defaults.adapter = async config => {
    let data
    if (config.url === '/Rooms') data = [room, { id: 2, name: 'Gym', capacity: 25, isActive: true }]
    else if (config.url === '/classes/10') data = state.classes[0]
    else if (config.url === '/classes/manage') data = { items: state.classes, total: state.classes.length }
    else {
      const match = config.url.match(/^\/classes\/(\d+)\/sessions(?:\/(\d+))?$/)
      assert.ok(match, `Unexpected request: ${config.url}`)
      if (config.method === 'put') {
        state.puts.push({ url: config.url, payload: JSON.parse(config.data) })
        if (failUpdate) throw new Error('Backend refused update')
        const item = state.sessions[match[1]].find(item => String(item.id) === match[2])
        const { roomId: ignoredRoomId, ...stored } = JSON.parse(config.data)
        Object.assign(item, stored)
        data = item
      } else data = { items: state.sessions[match[1]] || [], total: (state.sessions[match[1]] || []).length }
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  return state
}
const moveOptions = { room, rooms: [room, { id: 2, name: 'Gym' }], session: movable, draft: changedTime }

test('drag rescheduling updates only the selected session and permits overlap with its own old interval', async () => {
  const state = mockRescheduleApi()
  const result = await rescheduleRoomSession(moveOptions)
  assert.equal(state.puts.length, 1)
  assert.equal(state.puts[0].url, '/classes/10/sessions/100')
  assert.equal(result.startsAt, '2099-10-26T11:30:00.000Z')
  assert.equal(result.endsAt, '2099-10-26T13:00:00.000Z')
  for (const key of ['coachId', 'cancellationPolicyId', 'capacity']) assert.equal(state.puts[0].payload[key], movable[key])
  assert.equal(state.classes[0].endDate, sportClass.endDate)
})

test('a conflicting room session prevents PUT, while cancelled sessions and adjacent times do not', async () => {
  const otherClass = { ...sportClass, id: 20, className: 'Other class', coachId: 8 }
  const other = { ...movable, id: 200, classId: 20, coachId: 8, startsAt: '2099-10-26T12:00:00Z', endsAt: '2099-10-26T14:00:00Z' }
  const blocked = mockRescheduleApi({ otherClasses: [otherClass], otherSessions: { 20: [other] } })
  await assert.rejects(rescheduleRoomSession(moveOptions), /Phòng đã có/)
  assert.equal(blocked.puts.length, 0)
  for (const overrides of [{ status: 'Cancelled' }, { startsAt: '2099-10-26T13:00:00Z' }]) {
    const allowed = mockRescheduleApi({ otherClasses: [otherClass], otherSessions: { 20: [{ ...other, ...overrides }] } })
    await rescheduleRoomSession(moveOptions)
    assert.equal(allowed.puts.length, 1)
  }
})

test('coach conflicts in another room are checked even when the coach overrides the class default', async () => {
  const state = mockRescheduleApi({ otherClasses: [{ ...sportClass, id: 20, roomId: 2, coachId: 8 }], otherSessions: { 20: [{ ...movable, id: 200, classId: 20 }] } })
  await assert.rejects(rescheduleRoomSession(moveOptions), /Huấn luyện viên/)
  assert.equal(state.puts.length, 0)
})

test('stale, cancelled and missing sessions, unchanged times and out-of-course dates cannot be saved', async () => {
  for (const current of [null, { ...movable, startsAt: '2099-10-26T10:00:00Z' }, { ...movable, status: 'Cancelled' }, { ...movable, roomId: 2 }]) {
    const state = mockRescheduleApi({ current })
    await assert.rejects(rescheduleRoomSession(moveOptions))
    assert.equal(state.puts.length, 0)
  }
  for (const draft of [{ ...changedTime, startTime: '18:00', endTime: '19:30' }, { ...changedTime, date: '2099-12-01' }]) {
    const state = mockRescheduleApi()
    await assert.rejects(rescheduleRoomSession({ ...moveOptions, draft }))
    assert.equal(state.puts.length, 0)
  }
})

test('backend update failure is propagated and never changes the displayed session optimistically', async () => {
  const state = mockRescheduleApi({ failUpdate: true })
  await assert.rejects(rescheduleRoomSession(moveOptions), /Backend refused/)
  assert.equal(state.sessions[10][0].startsAt, movable.startsAt)
})

test('batch creation catches room overlap from another class even if the availability API always returns true', async () => {
  const state = mockApi({ otherClasses: [{ ...sportClass, id: 20, coachId: 9 }], otherSaved: { 20: [
    { id: 200, ...sessions[1], coachId: 9, capacity: 20 },
    { id: 201, ...sessions[0], startsAt: '2099-10-26T12:00:00Z', coachId: 9, capacity: 20 },
  ] } })
  const result = await createRecurringRoomSessions(options)
  assert.equal(result.phase, 'checking')
  assert.equal(result.conflicts.length, 2)
  assert.equal(state.posts.length, 0)
  assert.equal(state.puts.length, 0)
})

test('raw single-session creation cannot bypass room and class capacity limits or missing room data', async () => {
  for (const config of [{ serverRoom: { ...room, capacity: 10 } }, { course: { ...sportClass, maxCapacity: 10 } }, { serverRoom: { ...room, capacity: undefined } }, { serverRoom: { ...room, isActive: false } }, { roomReadError: true }]) {
    const state = mockApi(config)
    await assert.rejects(classService.createClassSession(10, { ...sessions[0], coachId: 5, cancellationPolicyId: 1, capacity: 20, roomId: 1 }))
    assert.equal(state.posts.length, 0)
  }
})

test('batch capacity uses the latest server room and class rather than stale form objects', async () => {
  for (const config of [{ serverRoom: { ...room, capacity: 10 } }, { course: { ...sportClass, maxCapacity: 10 } }]) {
    const state = mockApi(config)
    await assert.rejects(createRecurringRoomSessions(options), /1 đến 10/)
    assert.equal(state.posts.length, 0)
    assert.equal(state.puts.length, 0)
  }
})

test('single creation blocks overlaps and coach conflicts using all class session pages', async () => {
  for (const otherClass of [{ ...sportClass, id: 20, coachId: 9 }, { ...sportClass, id: 20, roomId: 2, coachId: 5 }]) {
    const state = mockApi({ otherClasses: [otherClass], otherSaved: { 20: [{ id: 200, ...sessions[0], coachId: otherClass.coachId, capacity: 20 }] } })
    await assert.rejects(classService.createClassSession(10, { ...sessions[0], coachId: 5, cancellationPolicyId: 1, capacity: 20, roomId: 1 }))
    assert.equal(state.posts.length, 0)
  }
})

test('a changed coach cannot bypass an existing session at the same room and time', async () => {
  const state = mockApi({ saved: [{ id: 100, ...sessions[0], coachId: 6, capacity: 20, status: 'Scheduled' }] })
  const result = await createRecurringRoomSessions({ ...options, sessions: [sessions[0]] })
  assert.equal(result.conflicts.length, 1)
  assert.equal(state.posts.length, 0)
})

test('overlapping planned intervals block the entire batch and repeated identical input is deduplicated', async () => {
  const blocked = mockApi()
  const result = await createRecurringRoomSessions({ ...options, sessions: [sessions[0], { ...sessions[0], startsAt: '2099-10-26T11:30:00Z' }] })
  assert.equal(result.conflicts.length, 1)
  assert.equal(blocked.posts.length, 0)
  const repeated = mockApi()
  const valid = await createRecurringRoomSessions({ ...options, sessions: [sessions[0], { ...sessions[0] }] })
  assert.equal(valid.created.length, 1)
  assert.equal(repeated.posts.length, 1)
})

test('each batch write rechecks capacity and stops when the room shrinks during creation', async () => {
  const state = mockApi()
  const result = await createRecurringRoomSessions(options, progress => {
    if (progress.phase === 'creating' && progress.completed === 1) state.serverRoom.capacity = 10
  })
  assert.equal(result.created.length, 1)
  assert.equal(result.remaining.length, 2)
  assert.equal(state.posts.length, 1)
  assert.match(result.conflicts[0].message, /1 đến 10/)
})

test('concurrent submits in one client are serialized and cannot create duplicate active sessions', async () => {
  const state = mockApi()
  const payload = { ...sessions[0], coachId: 5, cancellationPolicyId: 1, capacity: 20, roomId: 1 }
  const result = await Promise.allSettled([classService.createClassSession(10, payload), classService.createClassSession(10, payload)])
  assert.equal(result.filter(item => item.status === 'fulfilled').length, 1)
  assert.equal(result.filter(item => item.status === 'rejected').length, 1)
  assert.equal(state.posts.length, 1)
})

test('updates cannot reduce capacity below enrolled members or exceed the room limit', async () => {
  for (const capacity of [26, 21, 2]) {
    const state = mockRescheduleApi({ current: { ...movable, currentEnrollment: 3 } })
    await assert.rejects(classService.updateClassSession(10, 100, { ...movable, capacity, roomId: 1 }))
    assert.equal(state.puts.length, 0)
  }
})

test('assigning a room cannot introduce overlapping orphan sessions from the same class', async () => {
  const state = mockApi({ course: { ...sportClass, roomId: undefined, schedule: null }, saved: [
    { id: 100, ...sessions[0], capacity: 20, status: 'Scheduled' },
    { id: 101, ...sessions[0], startsAt: '2099-10-26T11:30:00Z', capacity: 20, status: 'Scheduled' },
  ] })
  await assert.rejects(assignClassToRoom({ classId: 10, room, rooms: [room] }), /trùng giờ/)
  assert.equal(state.puts.length, 0)
})

test('a new registration after opening drag confirmation stays enrolled when the session moves', async () => {
  const state = mockRescheduleApi({ current: { ...movable, currentEnrollment: 1 } })
  await rescheduleRoomSession(moveOptions)
  assert.equal(state.puts.length, 1)
  assert.equal(state.sessions[10][0].startsAt, '2099-10-26T11:30:00.000Z')
  assert.equal(state.sessions[10][0].currentEnrollment, 1)
  assert.equal(state.sessions[10][0].status, 'Scheduled')
  assert.equal(state.sessions[10].length, 1)
})

test('PUT edits an enrolled session in place without cancellation or new registrations', async () => {
  const state = mockRescheduleApi({ current: { ...movable, currentEnrollment: 3 } })
  await classService.updateClassSession(10, 100, { ...movable, startsAt: '2099-10-26T11:30:00Z', endsAt: '2099-10-26T13:00:00Z', capacity: 19, coachId: 9 })
  assert.equal(state.puts.length, 1)
  assert.equal(state.sessions[10][0].currentEnrollment, 3)
  assert.equal(state.sessions[10][0].status, 'Scheduled')
  assert.equal(state.sessions[10][0].coachId, 9)
})

test('unknown latest enrolment does not block the backend update that manages registrations', async () => {
  const state = mockRescheduleApi({ current: { ...movable, currentEnrollment: undefined } })
  await classService.updateClassSession(10, 100, { ...movable, startsAt: '2099-10-26T11:30:00Z' })
  assert.equal(state.puts.length, 1)
})

test('room details allow replacing the coach without moving an enrolled session', async () => {
  const state = mockRescheduleApi({ current: { ...movable, currentEnrollment: 3 } })
  await rescheduleRoomSession({ ...moveOptions, draft: { ...changedTime, startTime: '18:00', endTime: '19:30', coachId: '9' } })
  assert.equal(state.puts.length, 1)
  assert.equal(state.sessions[10][0].coachId, 9)
  assert.equal(Date.parse(state.sessions[10][0].startsAt), Date.parse(movable.startsAt))
  assert.equal(state.sessions[10][0].currentEnrollment, 3)
})

test('a stale coach and conflicts for a substitute coach block the update', async () => {
  const stale = mockRescheduleApi({ current: { ...movable, coachId: 9 } })
  await assert.rejects(rescheduleRoomSession(moveOptions), /đã được thay đổi/)
  assert.equal(stale.puts.length, 0)
  const conflict = mockRescheduleApi({ otherClasses: [{ ...sportClass, id: 20, roomId: 2, coachId: 9 }], otherSessions: { 20: [{ ...movable, id: 200, coachId: 9 }] } })
  await assert.rejects(rescheduleRoomSession({ ...moveOptions, draft: { ...changedTime, coachId: 9 } }), /Huấn luyện viên/)
  assert.equal(conflict.puts.length, 0)
})

test('class creation sends course dates and omits the retired fee field', async () => {
  let payload
  api.defaults.adapter = async config => {
    payload = JSON.parse(config.data)
    return { data: { id: 10, ...payload }, status: 200, statusText: 'OK', headers: {}, config }
  }
  await classService.createSportClass({ className: ' Yoga ', sportId: 1, coachId: 5, maxCapacity: 20, isActive: true, price: '500000.25', startDate: '2099-10-19', endDate: '2099-11-19' })
  assert.equal(payload.className, 'Yoga')
  assert.equal(Object.hasOwn(payload, 'price'), false)
  assert.equal(payload.startDate, '2099-10-19T00:00:00+07:00')
  assert.equal(payload.endDate, '2099-11-19T23:59:59.999+07:00')
})

test('class updates preserve dates and legacy scheduling data while omitting price', async () => {
  let payload
  api.defaults.adapter = async config => {
    payload = JSON.parse(config.data)
    return { data: { id: 10, ...payload }, status: 200, statusText: 'OK', headers: {}, config }
  }
  const original = { className: 'Yoga', sportId: 1, coachId: 5, maxCapacity: 20, isActive: true, price: 0, startDate: '2099-10-19T00:00:00Z', endDate: '2099-11-19T00:00:00Z', schedule: '[Phòng: Studio Yoga 01] Thứ 2, 4, 6' }
  await classService.updateSportClass(10, { ...original, className: 'Updated Yoga' })
  for (const key of ['startDate', 'endDate', 'schedule']) assert.equal(payload[key], original[key])
  assert.equal(Object.hasOwn(payload, 'price'), false)
})

test('missing or invalid class dates are rejected before POST or PUT', async () => {
  let requests = 0
  api.defaults.adapter = async () => { requests += 1; throw new Error('Unexpected API call') }
  const valid = { className: 'Yoga', sportId: 1, coachId: 5, maxCapacity: 20, price: 0, startDate: '2099-10-19', endDate: '2099-11-19' }
  for (const overrides of [{ startDate: '' }, { endDate: '' }, { startDate: '2099-12-01' }, { endDate: '2001-01-01' }]) {
    await assert.rejects(classService.createSportClass({ ...valid, ...overrides }))
    await assert.rejects(classService.updateSportClass(10, { ...valid, ...overrides }))
  }
  assert.equal(requests, 0)
})

test('class table dates use all session pages and ignore stored course dates', async () => {
  const pages = []
  const saved = [
    { id: 1, startsAt: '2026-11-20T11:00:00Z', endsAt: '2026-11-20T12:30:00Z' },
    { id: 2, startsAt: '2026-10-26T11:00:00Z', endsAt: '2026-10-26T12:30:00Z' },
    { id: 3, startsAt: '2026-12-01T11:00:00Z', endsAt: '2026-12-01T12:30:00Z', status: 'Cancelled' },
  ]
  api.defaults.adapter = async config => {
    let data
    if (config.url === '/classes/manage') data = { items: [{ id: 10, startDate: '2000-01-01', endDate: '2000-12-31' }], total: 1 }
    else {
      const page = Number(config.params.page)
      pages.push(page)
      data = { items: saved.slice(page - 1, page), totalCount: saved.length, page, pageSize: 1 }
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  const result = await classService.getManagedClassesWithSessionDates()
  assert.deepEqual(pages, [1, 2, 3])
  assert.deepEqual(result.items[0].sessionDateRange, { startDate: '2026-10-26T11:00:00.000Z', endDate: '2026-11-20T12:30:00.000Z' })
  assert.equal(result.items[0].startDate, '2000-01-01')
})

test('one failed session API is reported per class and does not hide other class rows', async () => {
  api.defaults.adapter = async config => {
    if (config.url === '/classes/10/sessions') throw new Error('Session API unavailable')
    const data = config.url === '/classes/manage' ? { items: [{ id: 10 }, { id: 20 }], total: 2 } : { items: [], total: 0 }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  const result = await classService.getManagedClassesWithSessionDates()
  assert.equal(result.items.length, 2)
  assert.equal(result.items[0].sessionDatesError, 'Session API unavailable')
  assert.deepEqual(result.items[1].sessionDateRange, { startDate: null, endDate: null })
  assert.equal(result.items[1].sessionDatesError, '')
})
