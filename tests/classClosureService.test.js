import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const storageDescriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    storageDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/sportClassService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of storageDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const course = { className: 'Yoga', sportId: 1, coachId: 5, maxCapacity: 20, price: 0,
  startDate: '2099-10-19', endDate: '2099-11-19', isActive: false }
const session = (id, status) => ({ id, classId: 10, status, startsAt: '2000-01-01T00:00:00Z', endsAt: '2000-01-01T01:00:00Z' })
function mockSessions(items, { readError = false, response, writeError = false } = {}) {
  const state = { items, reads: [], writes: [] }
  api.defaults.adapter = async config => {
    let data
    if (config.method === 'get') {
      assert.equal(config.url, '/classes/10/sessions')
      if (readError) throw new Error('Không tải được lịch')
      const page = Number(config.params.page)
      state.reads.push(page)
      data = response ?? { items: state.items.slice(page - 1, page), total: state.items.length, page }
    } else {
      state.writes.push({ method: config.method, url: config.url, data: config.data && JSON.parse(config.data) })
      if (writeError) throw new Error('Lớp vừa có thêm buổi học. Vui lòng kiểm tra lại.')
      data = { id: 10, isActive: false }
    }
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
  return state
}

test('closing is blocked by a scheduled session on a later page, including elapsed sessions not saved as completed', async () => {
  const state = mockSessions([session(1, 'Completed'), session(2, 'Cancelled'), session(3, 'Scheduled')])
  assert.equal((await service.getClassClosureStatus(10)).unfinishedCount, 1)
  await assert.rejects(service.deactivateSportClass(10), error => error.unfinishedCount === 1 && /chưa hoàn thành/.test(error.message))
  assert.deepEqual(state.reads, [1, 2, 3, 1, 2, 3])
  assert.deepEqual(state.writes, [])
})

test('only saved completion and cancellation statuses allow closing, including legacy casing', async () => {
  const state = mockSessions([session(1, 'Completed'), session(2, 'Cancelled'),
    { ...session(3), Status: ' CANCELED ' }, session(4, ' COMPLETED ')])
  assert.equal((await service.getClassClosureStatus(10)).unfinishedCount, 0)
  await service.deactivateSportClass(10)
  assert.deepEqual(state.writes.map(({ method, url }) => [method, url]), [['delete', '/classes/10']])
})

test('classes with no sessions can close', async () => {
  const state = mockSessions([])
  await service.deactivateSportClass(10)
  assert.equal(state.writes.length, 1)
})

test('unknown and missing statuses fail closed instead of treating the class as completed', async () => {
  const state = mockSessions([session(1, 'Draft'), session(2)])
  await assert.rejects(service.deactivateSportClass(10), error => error.unfinishedCount === 2)
  assert.deepEqual(state.writes, [])
})

test('unavailable, incomplete, duplicate, wrong-class and malformed session data prevents any close request', async () => {
  const cases = [
    { readError: true },
    { response: { items: [], total: 2, page: 1 } },
    { response: { items: [session(1, 'Completed')], total: 2, page: 1 } },
    { response: { items: [session(1, 'Completed'), session(1, 'Completed')], total: 2, page: 1 } },
    { response: { items: [{ ...session(1, 'Completed'), classId: 20 }], total: 1, page: 1 } },
    { response: { items: [{ ...session(1, 'Completed'), id: undefined }], total: 1, page: 1 } },
    { response: { message: 'Malformed response' } },
  ]
  for (const options of cases) {
    const state = mockSessions([], options)
    await assert.rejects(service.deactivateSportClass(10))
    assert.deepEqual(state.writes, [])
  }
})

test('confirmation rechecks newly added sessions instead of trusting an earlier successful preview', async () => {
  const state = mockSessions([session(1, 'Completed')])
  assert.equal((await service.getClassClosureStatus(10)).unfinishedCount, 0)
  state.items.push(session(2, 'Scheduled'))
  await assert.rejects(service.deactivateSportClass(10), /1 buổi/)
  assert.deepEqual(state.writes, [])
})

test('deactivating through the edit form has the same guard while active edits remain available', async () => {
  const state = mockSessions([session(1, 'Scheduled')])
  await assert.rejects(service.updateSportClass(10, course), /1 buổi/)
  assert.deepEqual(state.writes, [])
  const readsBeforeEdit = state.reads.length
  await service.updateSportClass(10, { ...course, isActive: true })
  assert.equal(state.reads.length, readsBeforeEdit)
  assert.equal(state.writes[0].method, 'put')
  assert.equal(state.writes[0].data.isActive, true)
  state.items[0].status = 'Completed'
  await service.updateSportClass(10, course)
  assert.equal(state.writes[1].data.isActive, false)
})

test('server rejection after preflight propagates to the dialog for handling', async () => {
  mockSessions([session(1, 'Completed')], { writeError: true })
  await assert.rejects(service.deactivateSportClass(10), /vừa có thêm buổi học/)
})
