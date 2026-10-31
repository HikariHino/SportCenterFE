import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, checkIn
const descriptors = new Map()
const now = Date.parse('2026-10-31T14:30:00+07:00')
const registration = { id: 10, memberId: 20, sessionId: 30, status: 'Registered', sessionStatus: 'Scheduled', startsAt: '2026-10-31T15:00:00+07:00', endsAt: '2026-10-31T16:30:00+07:00' }

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    cacheDir: 'node_modules/.vite-receptionist-checkin-tests', server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  checkIn = (await server.ssrLoadModule('/src/services/receptionistCheckInService.js')).checkInReceptionistMemberRegistration
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mockApi(t, items, { readError, postError } = {}) {
  t.mock.method(Date, 'now', () => now)
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ method: config.method, url: config.url, page: config.params?.page })
    if (config.method === 'get') {
      if (readError) throw new Error('Cannot load current registrations')
      const page = config.params.page
      return { config, status: 200, headers: {}, data: { success: true, data: { items: items.slice(page - 1, page), total: items.length, page, pageSize: 1 } } }
    }
    if (postError) return { config, status: 200, headers: {}, data: { success: false, message: 'Check-in rejected by server' } }
    return { config, status: 200, headers: {}, data: { success: true, data: { id: 50, memberId: 20, sessionId: 30, status: 'Present' } } }
  }
  return calls
}

test('check-in rereads all needed registration pages and posts only the chosen registration', async t => {
  const calls = mockApi(t, [{ ...registration, id: 9 }, registration])
  assert.equal((await checkIn(20, 10)).status, 'Present')
  assert.deepEqual(calls.map(call => [call.method, call.url, call.page]), [
    ['get', '/class-registrations/members/20', 1], ['get', '/class-registrations/members/20', 2],
    ['post', '/class-registrations/10/check-in', undefined],
  ])
})

test('a stale dialog cannot post a session rescheduled to November 2', async t => {
  const calls = mockApi(t, [{ ...registration, startsAt: '2026-11-02T15:00:00+07:00', endsAt: '2026-11-02T16:30:00+07:00' }])
  await assert.rejects(checkIn(20, 10), /trong ngày/)
  assert.ok(calls.every(call => call.method === 'get'))
})

test('too-early, finished, cancelled and already recorded registrations never send a write', async t => {
  for (const changes of [
    { startsAt: '2026-10-31T15:01:00+07:00' }, { endsAt: '2026-10-31T14:30:00+07:00', startsAt: '2026-10-31T13:00:00+07:00' },
    { status: 'Cancelled' }, { sessionStatus: 'Cancelled' }, { attendanceStatus: 'Present' },
  ]) {
    const calls = mockApi(t, [{ ...registration, ...changes }])
    await assert.rejects(checkIn(20, 10))
    assert.ok(calls.every(call => call.method === 'get'))
  }
})

test('missing or foreign registrations and failed reads do not write attendance', async t => {
  for (const [items, options] of [[[], {}], [[{ ...registration, memberId: 99 }], {}], [[registration], { readError: true }]]) {
    const calls = mockApi(t, items, options)
    await assert.rejects(checkIn(20, 10))
    assert.ok(calls.every(call => call.method === 'get'))
  }
})

test('server check-in failures are propagated without reporting success', async t => {
  mockApi(t, [registration], { postError: true })
  await assert.rejects(checkIn(20, 10), /rejected by server/)
})
