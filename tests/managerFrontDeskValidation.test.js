import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, manager, tickets, rooms, packages, sports, policies
const descriptors = new Map()
const now = Date.parse('2026-11-04T14:30:00+07:00')
const session = { id: 30, status: 'Scheduled', startsAt: '2026-11-04T15:00:00+07:00', endsAt: '2026-11-04T16:30:00+07:00' }
const student = { memberId: 20, registrationId: 10, registrationStatus: 'Registered' }
const attendanceInput = { classId: 5, sessionId: 30, memberId: 20, registrationId: 10 }

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  manager = await server.ssrLoadModule('/src/services/managerFrontDeskService.js')
  tickets = await server.ssrLoadModule('/src/services/supportTicketService.js')
  rooms = await server.ssrLoadModule('/src/services/roomService.js')
  packages = await server.ssrLoadModule('/src/services/membershipPackageService.js')
  sports = await server.ssrLoadModule('/src/services/classCatalogService.js')
  policies = await server.ssrLoadModule('/src/services/cancellationPolicyService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mockApi(t, { sessions = [session], roster = [student], ticketList = [{ id: 1, status: 'Open' }], readError, writeError, afterRead } = {}) {
  t.mock.method(Date, 'now', () => now)
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ method: config.method, url: config.url, data: config.data && JSON.parse(config.data) })
    let data
    if (config.method === 'get') {
      if (readError) throw new Error('Current data unavailable')
      if (config.url.endsWith('/sessions')) data = { items: sessions.slice(config.params.page - 1, config.params.page), total: sessions.length, page: config.params.page }
      else if (config.url.endsWith('/roster')) data = roster
      else if (config.url === '/SupportTickets') data = ticketList
      else throw new Error('Unexpected read: ' + config.url)
      afterRead?.(config)
    } else if (config.url.startsWith('/sports')) {
      data = { id: 1, ...JSON.parse(config.data), imageUrl: null }
    } else data = { id: 1, memberId: 20, sessionId: 30, status: 'Present' }
    return { config, status: 200, headers: {}, data: writeError && config.method !== 'get'
      ? { success: false, message: 'Server rejected write' } : { success: true, data } }
  }
  return calls
}

test('Manager manual check-in blocks missing identification, abc phones and negative or fractional IDs before requests', async t => {
  const calls = mockApi(t)
  for (const form of [{}, { phoneNumber: 'abc' }, { memberId: -1 }, { memberId: 1.5 }, { memberId: '2147483648' },
    { memberId: '1e2' }, { memberId: 20, phoneNumber: 'abc' }, { phoneNumber: '091234567' }]) {
    await assert.rejects(manager.manualManagerCheckIn(form))
  }
  assert.equal(calls.length, 0)
})

test('Manager manual check-in preserves ID-only, phone-only and combined requests', async t => {
  const calls = mockApi(t)
  for (const [form, expected] of [
    [{ memberId: ' 20 ', notes: 'Tại quầy' }, { memberId: 20, phoneNumber: null, notes: 'Tại quầy' }],
    [{ phoneNumber: ' 0912345678 ' }, { memberId: null, phoneNumber: '0912345678', notes: null }],
    [{ memberId: '20', phoneNumber: '0912345678' }, { memberId: 20, phoneNumber: '0912345678', notes: null }],
  ]) {
    await manager.manualManagerCheckIn(form)
    assert.deepEqual(calls.at(-1), { method: 'post', url: '/GymCheckIns/check-in', data: expected })
  }
})

test('Manager attendance rereads all session pages and the current roster before writing', async t => {
  const calls = mockApi(t, { sessions: [{ ...session, id: 29 }, session] })
  await manager.markManagerAttendance(attendanceInput)
  assert.equal(calls.filter(call => call.url === '/classes/5/sessions').length, 2)
  assert.ok(calls.some(call => call.url === '/class-sessions/30/roster'))
  assert.deepEqual(calls.at(-1), { method: 'post', url: '/Attendances/mark', data: { memberId: 20, sessionId: 30, status: 'Present' } })
})

test('stale, rescheduled, cancelled, completed and ended sessions cannot write Manager attendance', async t => {
  for (const changes of [
    { startsAt: '2026-11-06T15:00:00+07:00', endsAt: '2026-11-06T16:30:00+07:00' },
    { startsAt: '2026-11-04T15:01:00+07:00' }, { startsAt: '2026-11-04T13:00:00+07:00', endsAt: '2026-11-04T14:30:00+07:00' },
    { status: 'Cancelled' }, { status: 'Completed' }, { endsAt: 'invalid' },
  ]) {
    const calls = mockApi(t, { sessions: [{ ...session, ...changes }] })
    await assert.rejects(manager.markManagerAttendance(attendanceInput))
    assert.ok(calls.every(call => call.method === 'get'))
  }
})

test('missing or foreign registrations, existing attendance and failed reads cannot write attendance', async t => {
  for (const options of [{ sessions: [] }, { roster: [] }, { roster: [{ ...student, memberId: 999 }] },
    { roster: [{ ...student, registrationId: 999 }] }, { roster: [{ ...student, attendanceStatus: 'Present' }] },
    { roster: [{ ...student, registrationStatus: 'Cancelled' }] }, { readError: true }]) {
    const calls = mockApi(t, options)
    await assert.rejects(manager.markManagerAttendance(attendanceInput))
    assert.ok(calls.every(call => call.method === 'get'))
  }
})

test('attendance checks the clock after the last read finishes', async t => {
  const calls = mockApi(t, { afterRead: () => t.mock.method(Date, 'now', () => Date.parse(session.endsAt)) })
  await assert.rejects(manager.markManagerAttendance(attendanceInput), /kết thúc/)
  assert.ok(calls.every(call => call.method === 'get'))
})

test('a support ticket closed after its dialog opened cannot be updated or reopened', async t => {
  for (const status of ['Closed', 'closed', ' CLOSED ']) {
    const calls = mockApi(t, { ticketList: [{ id: 1, status }] })
    await assert.rejects(manager.resolveManagerSupportTicket(1, { status: 'InProgress', resolutionNote: 'Phản hồi' }), /đã đóng/)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'get')
  }
})

test('Manager support replies allow 2,000 characters and block 2,001 or 10,000 before requests', async t => {
  let calls = mockApi(t)
  for (const size of [2001, 10000]) await assert.rejects(manager.resolveManagerSupportTicket(1, { status: 'Resolved', resolutionNote: 'a'.repeat(size) }), /2000 ký tự/)
  assert.equal(calls.length, 0)
  calls = mockApi(t)
  await manager.resolveManagerSupportTicket(1, { status: 'Resolved', resolutionNote: 'a'.repeat(2000) })
  assert.equal(calls.at(-1).data.resolutionNote.length, 2000)
})

test('missing tickets and failed ticket reads do not send updates, while open tickets preserve status and normalized notes', async t => {
  for (const options of [{ ticketList: [] }, { readError: true }]) {
    const calls = mockApi(t, options)
    await assert.rejects(manager.resolveManagerSupportTicket(1, { status: 'Resolved', resolutionNote: 'Phản hồi' }))
    assert.ok(calls.every(call => call.method === 'get'))
  }
  const calls = mockApi(t)
  await manager.resolveManagerSupportTicket(1, { status: 'InProgress', resolutionNote: ' Đang xử lý ' })
  assert.deepEqual(calls.at(-1), { method: 'put', url: '/SupportTickets/1/resolve', data: { status: 'InProgress', resolutionNote: 'Đang xử lý' } })
})

test('Member support descriptions allow 2,000 characters and reject oversized content before writes', async t => {
  const calls = mockApi(t)
  for (const size of [2001, 10000]) await assert.rejects(tickets.createSupportTicket({ title: 'Hỗ trợ', description: 'a'.repeat(size) }), /2000 ký tự/)
  assert.equal(calls.length, 0)
  await tickets.createSupportTicket({ title: ' Hỗ trợ ', description: 'a'.repeat(2000), priority: 'High' })
  assert.deepEqual(calls[0], { method: 'post', url: '/SupportTickets', data: { title: 'Hỗ trợ', description: 'a'.repeat(2000), priority: 'High' } })
})

for (const [kind, form, actions, limits] of [
  ['room', { name: 'Phòng Gym', roomType: 'General', location: 'Tầng 1', capacity: 30 },
    [input => rooms.createRoom(input), input => rooms.updateRoom(1, input)], { name: 100, roomType: 50, location: 100 }],
  ['package', { packageName: 'Standard', description: 'Gói tập', price: 1000, durationInDays: 30, packageType: 'Standard' },
    [input => packages.createMembershipPackage(input), input => packages.updateMembershipPackage(1, input)], { packageName: 200, description: 2000 }],
  ['sport', { name: 'Gym', description: 'Tập luyện', isActive: true },
    [input => sports.createSport(input), input => sports.updateSport(1, input)], { name: 120, description: 2000 }],
  ['policy', { name: 'Tiêu chuẩn', minimumHoursBeforeStart: 2, isActive: true },
    [input => policies.createCancellationPolicy(input), input => policies.updateCancellationPolicy(1, input)], { name: 120 }],
]) {
  test(`Manager ${kind} creation and editing enforce each backend text limit before any request`, async t => {
    const calls = mockApi(t)
    for (const [field, max] of Object.entries(limits)) {
      for (const action of actions) await assert.rejects(action({ ...form, [field]: 'a'.repeat(max + 1) }), /ký tự/)
    }
    assert.equal(calls.length, 0)
    for (const [field, max] of Object.entries(limits)) {
      for (const action of actions) {
        await action({ ...form, [field]: 'a'.repeat(max) })
        assert.equal(calls.at(-1).data[field].length, max)
      }
    }
  })
}

test('sport updates use PUT for details and return the image URL and active status from the server', async () => {
  const imageUrl = 'https://assets.example.test/sports/yoga.jpg'
  const details = { name: 'Yoga', description: 'Tập luyện', isActive: false }
  api.defaults.adapter = async config => {
    assert.equal(config.method, 'put')
    assert.equal(config.url, '/sports/7')
    assert.deepEqual(JSON.parse(config.data), details)
    return { config, status: 200, headers: {}, data: { success: true, data: { id: 7, ...details, imageUrl } } }
  }
  assert.deepEqual(await sports.updateSport(7, { ...details, imageUrl }), { id: 7, ...details, imageUrl })

  api.defaults.adapter = async config => ({ config, status: 200, headers: {}, data: { success: true, data: { id: 8, ...details, imageUrl } } })
  await assert.rejects(sports.updateSport(7, details), /Không xác nhận được thay đổi/)
})

test('backend failures remain failures after valid Manager checks', async t => {
  mockApi(t, { writeError: true })
  await assert.rejects(manager.manualManagerCheckIn({ phoneNumber: '0912345678' }), /Server rejected write/)
  await assert.rejects(manager.markManagerAttendance(attendanceInput), /Server rejected write/)
  await assert.rejects(manager.resolveManagerSupportTicket(1, { status: 'Resolved', resolutionNote: 'Phản hồi' }), /Server rejected write/)
})
