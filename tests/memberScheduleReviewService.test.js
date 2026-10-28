import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const descriptors = new Map()
before(async () => {
  for (const name of ['localStorage', 'sessionStorage']) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/memberScheduleReviewService.js')
})
after(async () => {
  await server?.close()
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

const notice = { id: 10, title: 'Cập nhật lịch buổi học', content: 'Buổi #99 - Yoga đã đổi lịch sang 26/10/2099 11:30 (UTC).', sentAt: '2099-10-20T01:00:00Z', isRead: false }
const registration = { id: 1, sessionId: 99, status: 'Registered', sessionStatus: 'Scheduled', className: 'Yoga', startsAt: '2099-10-26T11:30:00Z', endsAt: '2099-10-26T13:00:00Z', coachName: 'HLV An', roomName: 'Phòng 1' }

function mockReview({ notifications = [notice], registrations = [registration], failRead, failPatch, repeatedPages = false } = {}) {
  const state = { notifications: structuredClone(notifications), registrations: structuredClone(registrations), calls: [], patches: [], failRead, failPatch }
  api.defaults.adapter = async config => {
    state.calls.push({ method: config.method, url: config.url, params: config.params })
    let data
    if (config.method === 'patch') {
      const id = Number(config.url.match(/^\/notifications\/(\d+)\/read$/)?.[1])
      assert.ok(id)
      state.patches.push(id)
      if (state.failPatch === id) throw new Error('Không lưu được xác nhận')
      state.notifications.find(item => item.id === id).isRead = true
      data = null
    } else {
      assert.ok(['/notifications', '/class-registrations/mine'].includes(config.url))
      if (state.failRead === config.url) throw new Error('Không tải được lịch mới')
      const items = config.url === '/notifications' ? state.notifications.filter(item => !item.isRead) : state.registrations
      if (config.url === '/notifications') assert.equal(config.params.unreadOnly, true)
      const page = Number(config.params.page), start = repeatedPages ? 0 : (page - 1) * 2
      data = { items: structuredClone(items.slice(start, start + 2)), total: items.length, page, pageSize: 2 }
    }
    return { data: { success: true, data }, status: 200, statusText: 'OK', headers: {}, config }
  }
  return state
}

test('entry checks all unread pages and registration pages without acknowledging anything automatically', async () => {
  const state = mockReview({
    notifications: [{ id: 1, title: 'Thanh toán', isRead: false }, { id: 2, title: 'Buổi học đã hủy', isRead: false }, notice, { ...notice, id: 11 }, { ...notice, id: 12, isRead: true }],
    registrations: [{ ...registration, id: 2, sessionId: 2 }, { ...registration, id: 3, sessionId: 3 }, registration],
  })
  const pending = await service.getPendingSessionReviews()
  assert.equal(pending.length, 1)
  assert.deepEqual(pending[0].notifications.map(item => item.id), [10, 11])
  assert.equal(pending[0].registration.startsAt, registration.startsAt)
  assert.equal(pending[0].registration.coachName, 'HLV An')
  assert.deepEqual(state.calls.filter(item => item.url === '/notifications').map(item => item.params.page), [1, 2])
  assert.deepEqual(state.calls.filter(item => item.url === '/class-registrations/mine').map(item => item.params.page), [1, 2])
  assert.deepEqual(state.patches, [])
})

test('confirmation persists only the reviewed session notices and does not prompt again on another entry', async () => {
  const state = mockReview({ notifications: [notice, { ...notice, id: 11 }, { id: 20, title: 'Thanh toán', isRead: false }] })
  const [review] = await service.getPendingSessionReviews()
  const result = await service.confirmSessionReview(review)
  assert.equal(result.changed, false)
  assert.deepEqual(state.patches, [10, 11])
  assert.equal(result.pending.length, 0)
  assert.equal(state.notifications.find(item => item.id === 20).isRead, false)
  assert.deepEqual(await service.getPendingSessionReviews(), [])
})

test('a new change to an already confirmed session requires another explicit review', async () => {
  const state = mockReview()
  const [review] = await service.getPendingSessionReviews()
  await service.confirmSessionReview(review)
  state.notifications.push({ ...notice, id: 11, content: 'Buổi #99 - Yoga thay HLV.' })
  state.registrations[0].coachName = 'HLV Bình'
  const pending = await service.getPendingSessionReviews()
  assert.equal(pending.length, 1)
  assert.equal(pending[0].registration.coachName, 'HLV Bình')
  assert.deepEqual(pending[0].notifications.map(item => item.id), [11])
  assert.deepEqual(state.patches, [10])
})

test('changed times, rooms, coaches or newer notices cannot be confirmed using an older displayed schedule', async () => {
  for (const change of [
    state => { state.registrations[0].startsAt = '2099-10-26T12:00:00Z' },
    state => { state.registrations[0].roomName = 'Phòng 2' },
    state => { state.registrations[0].coachName = 'HLV Bình' },
    state => { state.registrations[0].status = 'Cancelled' },
    state => { state.notifications.push({ ...notice, id: 11 }) },
  ]) {
    const state = mockReview()
    const [review] = await service.getPendingSessionReviews()
    change(state)
    const result = await service.confirmSessionReview(review)
    assert.equal(result.changed, true)
    assert.equal(result.pending.length, 1)
    assert.deepEqual(state.patches, [])
  }
})

test('each affected session requires its own confirmation, including changes arriving during review', async () => {
  const state = mockReview()
  const [review] = await service.getPendingSessionReviews()
  state.notifications.push({ ...notice, id: 11, content: 'Buổi #100 - Gym thay đổi lịch.' })
  state.registrations.push({ ...registration, id: 2, sessionId: 100, className: 'Gym' })
  const result = await service.confirmSessionReview(review)
  assert.equal(result.pending.length, 1)
  assert.equal(result.pending[0].sessionId, '100')
  assert.deepEqual(state.patches, [10])
  assert.equal(state.notifications[1].isRead, false)
})

test('failed reads, missing times and repeated pages prevent acknowledgement', async () => {
  for (const options of [
    { failRead: '/notifications' }, { failRead: '/class-registrations/mine' },
    { registrations: [{ ...registration, endsAt: null }] },
    { repeatedPages: true, notifications: [notice, { ...notice, id: 11 }, { ...notice, id: 12 }] },
  ]) {
    const state = mockReview(options)
    await assert.rejects(service.getPendingSessionReviews())
    assert.deepEqual(state.patches, [])
  }
  const state = mockReview()
  const [review] = await service.getPendingSessionReviews()
  state.failRead = '/class-registrations/mine'
  await assert.rejects(service.confirmSessionReview(review))
  assert.deepEqual(state.patches, [])
})

test('a failed save keeps the review pending and can be retried without a local dismissal', async () => {
  const state = mockReview({ failPatch: 10 })
  const [review] = await service.getPendingSessionReviews()
  await assert.rejects(service.confirmSessionReview(review), /Không lưu được/)
  assert.equal((await service.getPendingSessionReviews()).length, 1)
  state.failPatch = null
  assert.equal((await service.confirmSessionReview(review)).pending.length, 0)
})

test('ordinary notifications do not lock entry, and missing registrations remain reviewable notices', async () => {
  const state = mockReview({ notifications: [{ id: 1, title: 'Thanh toán', isRead: false }] })
  assert.deepEqual(await service.getPendingSessionReviews(), [])
  assert.ok(state.calls.every(item => item.url === '/notifications'))
  const orphan = mockReview({ registrations: [] })
  const [review] = await service.getPendingSessionReviews()
  assert.equal(review.registration, null)
  assert.equal((await service.confirmSessionReview(review)).pending.length, 0)
  assert.deepEqual(orphan.patches, [10])
})
