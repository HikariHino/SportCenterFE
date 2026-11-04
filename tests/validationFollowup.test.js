import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { passwordChangeErrors } from '../src/utils/profileValidation.js'
import { getManagerFormValidationError } from '../src/utils/managerFormValidation.js'

let server, api, profile, auth, manager, reception, support, rooms, packages, policies
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  profile = await server.ssrLoadModule('/src/services/profileService.js')
  auth = await server.ssrLoadModule('/src/services/authService.js')
  manager = await server.ssrLoadModule('/src/services/managerFrontDeskService.js')
  reception = await server.ssrLoadModule('/src/services/receptionistClassService.js')
  support = await server.ssrLoadModule('/src/services/receptionistSupportTicketService.js')
  rooms = await server.ssrLoadModule('/src/services/roomService.js')
  packages = await server.ssrLoadModule('/src/services/membershipPackageService.js')
  policies = await server.ssrLoadModule('/src/services/cancellationPolicyService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mockApi({ ticketStatus = 'Open', missingTicket = false, readError, writeError } = {}) {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, method: config.method, data: config.data && JSON.parse(config.data) })
    if (config.method === 'get' && readError) throw new Error('Cannot read current tickets')
    const data = config.method === 'get' ? (missingTicket ? [] : [{ id: 1, status: ticketStatus }])
      : { id: 1, userId: 2, role: 'Member', token: 'test-token', status: 'Resolved' }
    return { config, status: 200, headers: {}, data: config.method !== 'get' && writeError
      ? { success: false, message: 'Server rejected write' } : { success: true, data } }
  }
  return calls
}

test('profile password changes block whitespace and UTF-8 overflow before updating any role', async () => {
  const calls = mockApi()
  for (const password of ['        ', 'é'.repeat(37), '🏸'.repeat(19), 'a'.repeat(73)]) {
    assert.ok(passwordChangeErrors({ currentPassword: 'OldPassword!', newPassword: password, confirmPassword: password }).newPassword)
    await assert.rejects(profile.updateProfile({ currentPassword: 'OldPassword!', password }), error => Boolean(error.fieldErrors.password))
  }
  assert.equal(calls.length, 0)
})

test('valid profile password boundaries and exact characters remain unchanged', async () => {
  const calls = mockApi()
  for (const password of [' Pass12 ', 'a'.repeat(72), 'é'.repeat(36)]) {
    await profile.updateProfile({ currentPassword: ' OldPassword! ', password })
    assert.deepEqual(calls.at(-1).data, { currentPassword: ' OldPassword! ', password })
  }
})

for (const [kind, form, methods, field, invalid, valid] of [
  ['room', { name: 'Gym', capacity: 30 }, [value => rooms.createRoom(value), value => rooms.updateRoom(1, value)], 'capacity',
    [undefined, null, '', ' ', true, [], 0, -1, 1.5, 501, NaN, Infinity, 'abc'], [1, 500, '30']],
  ['policy', { name: 'Tiêu chuẩn', minimumHoursBeforeStart: 2 }, [value => policies.createCancellationPolicy(value), value => policies.updateCancellationPolicy(1, value)], 'minimumHoursBeforeStart',
    [undefined, null, '', ' ', false, {}, 1, 2.5, 721, NaN, Infinity, 'abc'], [2, 720, '24']],
  ['package', { packageName: 'Test', price: 600000, durationInDays: 30 }, [value => packages.createMembershipPackage(value), value => packages.updateMembershipPackage(1, value)], 'durationInDays',
    [undefined, null, '', ' ', true, [], 0, -1, 1.5, 36501, NaN, Infinity, 'abc'], [1, 36500, '30']],
]) {
  test(`${kind} rejects invalid numeric fields before create and edit requests`, async () => {
    const calls = mockApi()
    for (const value of invalid) {
      assert.ok(getManagerFormValidationError(kind, { ...form, [field]: value }))
      for (const method of methods) await assert.rejects(method({ ...form, [field]: value }))
    }
    assert.equal(calls.length, 0)
    for (const value of valid) {
      for (const method of methods) {
        await method({ ...form, [field]: value })
        assert.equal(calls.at(-1).data[field], Number(value))
      }
    }
  })
}

test('package prices accept ordinary VND amounts and two decimals without a 50,000 step restriction', async () => {
  const calls = mockApi()
  for (const price of [600000, 100000, 599999, 0.01, 1234.56, '51000.25']) {
    assert.equal(getManagerFormValidationError('package', { packageName: 'Test', price, durationInDays: 30 }), '')
    await packages.createMembershipPackage({ packageName: 'Test', price, durationInDays: 30 })
    await packages.updateMembershipPackage(1, { packageName: 'Test', price, durationInDays: 30 })
    assert.equal(calls.at(-1).data.price, Number(price))
  }
})

test('package prices reject nonfinite, negative, missing and overly precise amounts before writes', async () => {
  const calls = mockApi()
  for (const price of [undefined, null, '', ' ', true, [], 'abc', 0, -1, Infinity, NaN, 0.001, 1234.567, 1e16, 1e20]) {
    await assert.rejects(packages.createMembershipPackage({ packageName: 'Test', price, durationInDays: 30 }))
    await assert.rejects(packages.updateMembershipPackage(1, { packageName: 'Test', price, durationInDays: 30 }))
  }
  assert.equal(calls.length, 0)
})

for (const [kind, checkIn] of [
  ['manual', notes => manager.manualManagerCheckIn({ memberId: 1, notes })],
  ['QR', notes => manager.scanManagerQrCheckIn({ qrCode: 'member-qr', notes })],
]) {
  test(`Manager ${kind} check-in enforces the 500-character note limit`, async () => {
    const calls = mockApi()
    for (const notes of ['a'.repeat(501), 'a'.repeat(10000), {}]) await assert.rejects(checkIn(notes), /Ghi chú check-in/)
    assert.equal(calls.length, 0)
    await checkIn('a'.repeat(500))
    assert.equal(calls[0].data.notes.length, 500)
  })
}

test('staff cancellation rejects overlong reasons and accepts the 500-character boundary', async () => {
  const calls = mockApi()
  for (const reason of ['a'.repeat(501), 'a'.repeat(10000), '', '   ', {}]) await assert.rejects(reception.cancelReceptionistRegistration(1, reason))
  assert.equal(calls.length, 0)
  await reception.cancelReceptionistRegistration(1, 'a'.repeat(500))
  assert.equal(calls[0].data.reason.length, 500)
})

test('Receptionist rejects invalid or oversized member/session IDs before any request', async () => {
  const calls = mockApi()
  for (const id of [undefined, null, '', true, [], 'abc', 0, -1, 1.5, 2147483648, NaN, Infinity]) {
    for (const run of [() => reception.registerMemberForSession(id, 1), () => reception.registerMemberForSession(1, id),
      () => reception.getReceptionistSessionRoster(id), () => reception.completeReceptionistSession(id), () => reception.getReceptionistMemberRegistrations(id)]) await assert.rejects(run())
  }
  assert.equal(calls.length, 0)
  await reception.registerMemberForSession(2147483647, 1)
  assert.equal(calls[0].url, '/class-sessions/2147483647/registrations/members/1')
})

test('Receptionist rereads tickets and blocks a ticket closed in another session', async () => {
  for (const ticketStatus of ['Closed', 'closed', ' CLOSED ']) {
    const calls = mockApi({ ticketStatus })
    await assert.rejects(support.resolveReceptionistSupportTicket(1, { status: 'InProgress', resolutionNote: 'Phản hồi' }), /đã đóng/)
    assert.deepEqual(calls.map(call => call.method), ['get'])
  }
  for (const options of [{ missingTicket: true }, { readError: true }]) {
    const calls = mockApi(options)
    await assert.rejects(support.resolveReceptionistSupportTicket(1, { status: 'Resolved', resolutionNote: 'Phản hồi' }))
    assert.ok(calls.every(call => call.method === 'get'))
  }
})

test('Receptionist preserves valid support updates after the current-state check', async () => {
  const calls = mockApi()
  await support.resolveReceptionistSupportTicket(1, { status: 'Resolved', resolutionNote: ' Phản hồi ' })
  assert.deepEqual(calls.map(call => call.method), ['get', 'put'])
  assert.deepEqual(calls[1].data, { status: 'Resolved', resolutionNote: 'Phản hồi' })
})

test('login and password-reset requests block malformed or oversized email before calling APIs', async () => {
  const calls = mockApi()
  for (const email of [undefined, null, '', '  ', 'abc', 'a@@example.com', 'a b@example.com', 'a'.repeat(245) + '@example.com', 'a'.repeat(10000) + '@example.com']) {
    await assert.rejects(auth.login({ email, password: 'Existing password' }), /email/i)
    await assert.rejects(auth.requestResetPassword({ email }), /email/i)
  }
  assert.equal(calls.length, 0)
})

test('login and reset preserve valid education emails and login passwords without new-password restrictions', async () => {
  const calls = mockApi()
  await auth.login({ email: ' User@FPT.EDU.VN ', password: ' old ' })
  await auth.requestResetPassword({ email: ' User@FPT.EDU.VN ' })
  assert.deepEqual(calls[0].data, { email: 'User@FPT.EDU.VN', password: ' old ' })
  assert.deepEqual(calls[1].data, { email: 'User@FPT.EDU.VN' })
})
