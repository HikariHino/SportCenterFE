import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const descriptors = new Map()
const session = { id: 30, status: 'Scheduled', startsAt: '2026-11-04T15:00:00+07:00', endsAt: '2026-11-04T16:30:00+07:00' }
const now = Date.parse('2026-11-04T14:30:00+07:00')
const student = { registrationId: 10, memberId: 20, registrationStatus: 'Registered' }
const payload = { memberId: 20, sessionId: 30, status: 'Present' }

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/coachService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mockApi(t, { sessions = [session], roster = [student], readError, writeError, afterRoster } = {}) {
  t.mock.method(Date, 'now', () => now)
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, method: config.method, data: config.data && JSON.parse(config.data) })
    if (config.method === 'get') {
      if (readError) throw new Error('Cannot read current schedule')
      if (config.url.endsWith('/roster')) {
        afterRoster?.()
        return { config, status: 200, headers: {}, data: { data: roster } }
      }
      const page = config.params.page
      return { config, status: 200, headers: {}, data: { data: { items: sessions.slice(page - 1, page), total: sessions.length, page, pageSize: 1 } } }
    }
    return { config, status: 200, headers: {}, data: writeError
      ? { success: false, message: 'Server rejected attendance' }
      : { data: { ...payload, id: 50 } } }
  }
  return calls
}

test('Coach attendance rereads saved session pages before marking or updating any status', async t => {
  const calls = mockApi(t, { sessions: [{ ...session, id: 29 }, session] })
  for (const status of ['Present', 'Absent', 'Excused']) {
    const start = calls.length
    assert.equal((await service.markCoachAttendance({ ...payload, status })).id, 50)
    assert.deepEqual(calls.slice(start), [
      { url: '/class-sessions/mine', method: 'get', data: undefined },
      { url: '/class-sessions/mine', method: 'get', data: undefined },
      { url: '/Attendances/mark', method: 'post', data: { ...payload, status } },
    ])
  }
})

test('rescheduled, cancelled, completed, early and finished sessions cannot send either Coach attendance write', async t => {
  for (const changes of [
    { startsAt: '2026-11-06T15:00:00+07:00', endsAt: '2026-11-06T16:30:00+07:00' },
    { startsAt: '2026-11-02T15:00:00+07:00', endsAt: '2026-11-02T16:30:00+07:00' },
    { startsAt: '2026-11-04T15:01:00+07:00' }, { endsAt: '2026-11-04T14:30:00+07:00', startsAt: '2026-11-04T13:00:00+07:00' },
    { status: 'Cancelled' }, { status: 'Completed' }, { endsAt: 'invalid' },
  ]) {
    const calls = mockApi(t, { sessions: [{ ...session, ...changes }] })
    await assert.rejects(service.markCoachAttendance(payload))
    await assert.rejects(service.checkInCoachRegistration(10, { sessionId: 30 }))
    assert.ok(calls.every(call => call.method === 'get'))
  }
})

test('a missing session, failed read, malformed response or backend rejection cannot fall through to a write', async t => {
  for (const options of [{ sessions: [] }, { sessions: [{ ...session, id: 99 }] }, { readError: true }]) {
    const calls = mockApi(t, options)
    await assert.rejects(service.markCoachAttendance(payload))
    assert.ok(calls.every(call => call.method === 'get'))
  }
  for (const body of [null, {}, { success: false, message: 'Denied' }, { statusCode: 403, message: 'Denied' }]) {
    let writes = 0
    api.defaults.adapter = async config => {
      if (config.method === 'post') writes++
      return { config, status: 200, headers: {}, data: body }
    }
    await assert.rejects(service.markCoachAttendance(payload))
    assert.equal(writes, 0)
  }
})

test('registration check-in verifies the chosen session roster and posts only the chosen registration', async t => {
  const calls = mockApi(t)
  assert.equal((await service.checkInCoachRegistration(10, { sessionId: 30 })).id, 50)
  assert.deepEqual(calls.map(call => call.url), ['/class-sessions/mine', '/class-sessions/30/roster', '/class-registrations/10/check-in'])
})

test('foreign, cancelled and already recorded registrations cannot use another session window', async t => {
  for (const roster of [[], [{ ...student, registrationId: 99 }], [{ ...student, registrationStatus: 'Cancelled' }],
    [{ ...student, attendanceStatus: 'Present' }], [{ ...student, attendanceStatus: 'Absent' }], [{ ...student, checkInTime: session.startsAt }]]) {
    const calls = mockApi(t, { roster })
    await assert.rejects(service.checkInCoachRegistration(10, { sessionId: 30 }))
    assert.ok(calls.every(call => call.method === 'get'))
  }
})

test('a roster request finishing after the window closes does not post check-in', async t => {
  const calls = mockApi(t, { afterRoster: () => t.mock.method(Date, 'now', () => Date.parse(session.endsAt)) })
  await assert.rejects(service.checkInCoachRegistration(10, { sessionId: 30 }), /kết thúc/)
  assert.ok(calls.every(call => call.method === 'get'))
})

test('invalid session IDs are rejected before reading or writing', async t => {
  const calls = mockApi(t)
  for (const sessionId of [undefined, null, '', 0, -1, 1.5, 'abc', Infinity]) {
    await assert.rejects(service.markCoachAttendance({ ...payload, sessionId }))
    await assert.rejects(service.checkInCoachRegistration(10, { sessionId }))
  }
  assert.equal(calls.length, 0)
})

test('server errors after valid schedule checks still reject both attendance actions', async t => {
  mockApi(t, { writeError: true })
  await assert.rejects(service.markCoachAttendance(payload), /Server rejected attendance/)
  await assert.rejects(service.checkInCoachRegistration(10, { sessionId: 30 }), /Server rejected attendance/)
})
