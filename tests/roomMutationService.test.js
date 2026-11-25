import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const descriptors = new Map()
const room = { id: 1, name: 'Yoga A', capacity: 30, isActive: true }
const course = { id: 10, className: 'Yoga', roomId: 1 }
const session = { id: 20, capacity: 20, currentEnrollment: 18, status: 'Scheduled', startsAt: '2099-01-01T10:00:00Z', endsAt: '2099-01-01T11:00:00Z' }

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/roomService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mock({ classes = [course], items = [session], failRead, writeFailure } = {}) {
  const calls = [], writes = []
  api.defaults.adapter = async config => {
    calls.push(config)
    let data
    if (config.method !== 'get') {
      writes.push(config)
      data = writeFailure || { success: true, data: { ...room, ...JSON.parse(config.data || '{}') } }
    } else {
      if (config.url === failRead) throw new Error('Lỗi tải lịch')
      if (config.url === '/Rooms') data = [room, { id: 2, name: 'Yoga B', capacity: 30 }]
      else {
        const list = config.url === '/classes/manage' ? classes : items
        const page = Number(config.params.page)
        data = { items: list.slice(page - 1, page), total: list.length, page }
      }
    }
    return { config, status: 200, headers: {}, data }
  }
  return { calls, writes }
}

test('capacity reduction checks every class/session page and blocks both session capacity and enrollment', async () => {
  for (const changes of [{ capacity: 20, currentEnrollment: 18 }, { capacity: 4, currentEnrollment: 18 }, { capacity: 4, enrolledCount: 19, currentEnrollment: 0 }]) {
    const { calls, writes } = mock({ classes: [{ ...course, id: 9, roomId: 2 }, course],
      items: [{ ...session, id: 19, roomId: 2 }, { ...session, ...changes }] })
    await assert.rejects(service.updateRoom(1, { ...room, capacity: 5 }), /Không thể giảm.*buổi #20/)
    assert.ok(calls.some(call => call.url === '/classes/manage' && call.params.page === 2))
    assert.ok(calls.some(call => call.url === '/classes/10/sessions' && call.params.page === 2))
    assert.equal(writes.length, 0)
  }
})

test('deactivation is blocked through both update and soft-delete, including ongoing sessions', async () => {
  for (const startsAt of [session.startsAt, new Date(Date.now() - 60_000).toISOString()]) {
    for (const action of [() => service.updateRoom(1, { ...room, isActive: false }), () => service.deleteRoom(1)]) {
      const { writes } = mock({ items: [{ ...session, startsAt }] })
      await assert.rejects(action(), /dời hoặc hủy/)
      assert.equal(writes.length, 0)
    }
  }
})

test('ended, cancelled, completed and explicitly reassigned sessions do not block a room change', async () => {
  const items = [
    { ...session, id: 1, status: 'Cancelled' }, { ...session, id: 2, status: 'Completed' },
    { ...session, id: 3, endsAt: '2000-01-01T11:00:00Z' }, { ...session, id: 4, roomId: 2 },
  ]
  const { writes } = mock({ items })
  await service.updateRoom(1, { ...room, capacity: 5 })
  await service.deleteRoom(1)
  assert.deepEqual(writes.map(call => call.method), ['put', 'delete'])
})

test('capacity equal to the existing session limit is allowed', async () => {
  const { writes } = mock()
  await service.updateRoom(1, { ...room, capacity: 20 })
  assert.equal(writes.length, 1)
})

test('failed reads and unknown schedule data never fall through to a mutation', async () => {
  for (const options of [{ failRead: '/Rooms' }, { failRead: '/classes/manage' }, { failRead: '/classes/10/sessions' },
    { items: [{ ...session, endsAt: 'invalid' }] }, { items: [{ ...session, capacity: null }] }]) {
    const { writes } = mock(options)
    await assert.rejects(service.updateRoom(1, { ...room, capacity: 5 }))
    assert.equal(writes.length, 0)
  }
})

test('HTTP 200 rejection is not reported as a successful update or soft-delete', async () => {
  for (const writeFailure of [{ success: false, message: 'Phòng đã có lịch mới' }, { statusCode: 409, message: 'Phòng đã có lịch mới' }]) {
    mock({ items: [], writeFailure })
    await assert.rejects(service.updateRoom(1, { ...room, capacity: 5 }), /Phòng đã có lịch mới/)
    await assert.rejects(service.deleteRoom(1), /Phòng đã có lịch mới/)
  }
})
