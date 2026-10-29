import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, markAllNotificationsRead
const descriptors = new Map()
before(async () => {
  for (const name of ['localStorage', 'sessionStorage']) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  ;({ markAllNotificationsRead } = await server.ssrLoadModule('/src/services/notificationService.js'))
})
after(async () => {
  await server?.close()
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

function mockNotifications({ count = 207, array = false, failId, failPage, invalidPage, scheduleIds = [] } = {}) {
  const items = Array.from({ length: count }, (_, index) => ({ id: index + 1, isRead: false, title: scheduleIds.includes(index + 1) ? 'Cập nhật lịch buổi học' : 'Thông báo' }))
  items.push({ id: count + 1, isRead: true })
  const state = { items, pages: [], patches: [], active: 0, maxActive: 0 }
  api.defaults.adapter = async config => {
    let data
    if (config.method === 'get') {
      assert.equal(config.url, '/notifications')
      assert.equal(config.params.unreadOnly, true)
      assert.equal(state.patches.length, 0, 'Unread pages must be collected before any mutation')
      const { page, pageSize } = config.params
      state.pages.push(page)
      if (page === failPage) throw new Error('Cannot load notifications')
      const unread = items.filter(item => !item.isRead)
      data = invalidPage === page ? { items: [], total: count, page }
        : array ? items.map(item => ({ ...item }))
          : { items: unread.slice((page - 1) * pageSize, page * pageSize).map(item => ({ ...item })), total: unread.length, page, pageSize }
    } else {
      assert.equal(config.method, 'patch')
      const id = Number(config.url.match(/^\/notifications\/(\d+)\/read$/)?.[1])
      assert.ok(id)
      state.patches.push(id)
      state.active += 1
      state.maxActive = Math.max(state.maxActive, state.active)
      try {
        await new Promise(resolve => setTimeout(resolve, 1))
        if (id === failId) throw new Error('Cannot mark notification')
        items.find(item => item.id === id).isRead = true
      } finally { state.active -= 1 }
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  return state
}

test('read all spans every unread page and only patches unread notifications with bounded concurrency', async () => {
  const state = mockNotifications()
  const result = await markAllNotificationsRead()
  assert.deepEqual(state.pages, [1, 2, 3])
  assert.equal(result.read, 207)
  assert.equal(result.total, 207)
  assert.equal(result.failed.length, 0)
  assert.equal(new Set(state.patches).size, 207)
  assert.ok(state.maxActive <= 4)
  assert.ok(state.items.every(item => item.isRead))
  assert.ok(!state.patches.includes(208))
})

test('array responses are paginated locally without touching already read notifications', async () => {
  const state = mockNotifications({ count: 105, array: true })
  assert.equal((await markAllNotificationsRead()).read, 105)
  assert.deepEqual(state.pages, [1, 2])
  assert.ok(!state.patches.includes(106))
})

test('an empty unread list produces no PATCH', async () => {
  const state = mockNotifications({ count: 0 })
  const result = await markAllNotificationsRead()
  assert.equal(result.read, 0)
  assert.equal(result.total, 0)
  assert.equal(state.patches.length, 0)
})

test('read all cannot acknowledge a schedule change in place of the mandatory review', async () => {
  const state = mockNotifications({ count: 105, scheduleIds: [1, 102] })
  const result = await markAllNotificationsRead()
  assert.equal(result.read, 103)
  assert.equal(result.requiresReview, 2)
  assert.deepEqual(state.items.filter(item => !item.isRead).map(item => item.id), [1, 102])
  assert.ok(!state.patches.includes(1) && !state.patches.includes(102))
})

test('partial failures retain successful reads and retry only what remains unread', async () => {
  const state = mockNotifications({ count: 9, failId: 4 })
  const result = await markAllNotificationsRead()
  assert.equal(result.read, 8)
  assert.equal(result.failed.length, 1)
  assert.equal(result.failed[0].id, '4')
  const remaining = state.items.filter(item => !item.isRead)
  assert.deepEqual(remaining.map(item => item.id), [4])
  state.patches.length = 0
  assert.equal((await markAllNotificationsRead()).total, 1)
  assert.deepEqual(state.patches, [4])
})

test('failed or incomplete page reads stop before any writes', async () => {
  for (const options of [{ failPage: 2 }, { invalidPage: 2 }]) {
    const state = mockNotifications(options)
    await assert.rejects(markAllNotificationsRead())
    assert.equal(state.patches.length, 0)
  }
})
