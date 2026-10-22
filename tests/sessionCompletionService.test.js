import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, sync, complete
const storageDescriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    storageDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  sync = (await server.ssrLoadModule('/src/services/sessionCompletionService.js')).completeExpiredClassSessions
  complete = (await server.ssrLoadModule('/src/services/sportClassService.js')).completeClassSession
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of storageDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const ended = (id, extra = {}) => ({ id, classId: 10, startsAt: '2000-01-01T11:00:00Z', endsAt: '2000-01-01T12:30:00Z', status: 'Scheduled', ...extra })
function mockSessions(items, { failures = new Set(), onWrite, readFailure, rejectedBody = false } = {}) {
  const state = { items: items.map(item => ({ ...item })), writes: [], reads: [], failures }
  api.defaults.adapter = async config => {
    let data
    if (config.method === 'post') {
      const match = config.url.match(/^\/class-sessions\/(\d+)\/complete$/)
      assert.ok(match, 'uses the existing completion endpoint')
      const id = Number(match[1])
      state.writes.push(id)
      await onWrite?.(id)
      if (failures.has(id)) throw new Error(`Không thể lưu buổi ${id}`)
      if (rejectedBody) return { data: { success: false, message: 'Chưa được hoàn thành' }, status: 200, headers: {}, config }
      const session = state.items.find(item => item.id === id)
      if (session) session.status = 'Completed'
      return { data: '', status: 204, statusText: 'No Content', headers: {}, config }
    }
    const page = Number(config.params.page)
    state.reads.push(`${config.url}:${page}`)
    if (config.url === readFailure) throw new Error('Không tải đủ lịch')
    const source = config.url === '/classes/manage'
      ? [...new Set(state.items.map(item => item.classId))].map(id => ({ id }))
      : state.items.filter(item => item.classId === Number(config.url.match(/classes\/(\d+)/)?.[1]))
    data = { items: source.slice(page - 1, page).map(item => ({ ...item })), total: source.length, page }
    return { data: { success: true, data }, status: 200, headers: {}, config }
  }
  return state
}

test('persists only ended scheduled sessions across every class and page, and publishes confirmed statuses', async () => {
  const items = [ended(1), ended(2, { classId: 20 }), ended(3, { status: undefined, Status: ' SCHEDULED ' }),
    ended(4, { status: 'Cancelled' }), ended(5, { status: undefined, Status: ' CANCELED ' }),
    ended(6, { status: 'Completed' }), ended(7, { endsAt: '2099-01-01T00:00:00Z' }),
    ended(8, { startsAt: '2099-01-01T00:00:00Z', endsAt: '2099-01-01T01:00:00Z' }),
    ended(9, { endsAt: 'invalid' }), ended(10, { startsAt: 'invalid' }),
    ended(11, { startsAt: '2000-01-02T00:00:00Z' }), ended(12, { status: 'Draft' })]
  const state = mockSessions(items)
  const published = []
  const result = await sync({ onCompleted: sessions => published.push(sessions) })
  assert.deepEqual(state.writes.sort((a, b) => a - b), [1, 2, 3])
  assert.equal(result.failed.length, 0)
  assert.ok(result.completed.every(item => item.status === 'Completed'))
  assert.equal(published.length, 1)
  assert.deepEqual(published[0], result.completed)
  assert.ok(state.reads.includes('/classes/manage:2'))
  assert.ok(state.reads.includes('/classes/10/sessions:11'))
  assert.equal(items[0].status, 'Scheduled', 'does not mutate input snapshots')
  state.writes.length = 0
  const reloaded = await sync()
  assert.deepEqual(reloaded.completed, [])
  assert.deepEqual(state.writes, [], 'saved completion is not posted again on reload')
  assert.equal(state.items.find(item => item.id === 4).status, 'Cancelled')
})

test('uses the end instant including the boundary and Vietnam overnight sessions', async () => {
  const originalNow = Date.now
  Date.now = () => Date.parse('2026-10-20T01:00:00+07:00')
  try {
    const state = mockSessions([
      ended(1, { startsAt: '2026-10-19T23:00:00+07:00', endsAt: '2026-10-20T01:00:00+07:00' }),
      ended(2, { startsAt: '2026-10-19T23:00:00+07:00', endsAt: '2026-10-20T01:00:00.001+07:00' }),
    ])
    await sync()
    assert.deepEqual(state.writes, [1])
  } finally { Date.now = originalNow }
})

test('retains failed sessions, completes other sessions, and retries only unsaved completion', async () => {
  const state = mockSessions([ended(1), ended(2), ended(3)], { failures: new Set([2]) })
  const first = await sync()
  assert.deepEqual(first.completed.map(item => item.id), [1, 3])
  assert.equal(first.failed[0].session.id, 2)
  assert.match(first.failed[0].message, /buổi 2/)
  assert.equal(state.items[1].status, 'Scheduled')
  state.failures.clear()
  state.writes.length = 0
  const second = await sync()
  assert.deepEqual(state.writes, [2])
  assert.deepEqual(second.completed.map(item => item.id), [2])
})

test('deduplicates overlapping automatic scans and manual completion requests', async () => {
  let release, started
  const gate = new Promise(resolve => { release = resolve })
  const writing = new Promise(resolve => { started = resolve })
  const state = mockSessions([ended(1)], { onWrite: async () => { started(); await gate } })
  const first = sync()
  await writing
  const manual = complete('1')
  const second = sync()
  // Wait until the second scan has read the same still-scheduled snapshot.
  await new Promise(resolve => setTimeout(resolve, 10))
  release()
  await Promise.all([first, manual, second])
  assert.deepEqual(state.writes, [1])
})

test('aborting stops subsequent writes while publishing the completion already saved', async () => {
  const controller = new AbortController()
  const state = mockSessions([ended(1), ended(2)], { onWrite: () => controller.abort() })
  const published = []
  await assert.rejects(sync({ signal: controller.signal, onCompleted: items => published.push(...items) }), { name: 'AbortError' })
  assert.deepEqual(state.writes, [1])
  assert.deepEqual(published.map(item => item.id), [1])
})

test('an incomplete catalog causes no writes', async () => {
  const state = mockSessions([ended(1), ended(2, { classId: 20 })], { readFailure: '/classes/20/sessions' })
  await assert.rejects(sync(), /Không tải đủ lịch/)
  assert.deepEqual(state.writes, [])
})

test('a rejected response body is never reported or published as completed', async () => {
  const state = mockSessions([ended(1)], { rejectedBody: true })
  const published = []
  const result = await sync({ onCompleted: items => published.push(...items) })
  assert.deepEqual(result.completed, [])
  assert.equal(result.failed.length, 1)
  assert.deepEqual(published, [])
  assert.equal(state.items[0].status, 'Scheduled')
})
