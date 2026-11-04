import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { getReceptionistManualCheckInValidationError, getReceptionistMemberValidationError } from '../src/utils/receptionistValidation.js'

let server, api, service
const descriptors = new Map()
const member = { fullName: '  Nguyễn Thế Anh  ', email: 'anh@example.com', password: ' Password123! ', phone: '0912345678' }
const invalidPhones = ['abc', '09123abc78', '091234567', '09123456789', '1912345678', '+84912345678', '0912 345 678', '０９１２３４５６７８', 912345678, {}, []]

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/receptionistEntryService.js')
})

after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mockApi(body) {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, method: config.method, data: JSON.parse(config.data) })
    return { config, status: 200, headers: {}, data: body }
  }
  return calls
}

test('Receptionist rejects empty, whitespace-only, non-text and overlong names', async () => {
  const calls = mockApi({ memberId: 1 })
  for (const fullName of [undefined, null, '', '   ', '\t\n', '\u00a0\u2003', 'a'.repeat(101), 123, {}]) {
    assert.equal(getReceptionistMemberValidationError({ ...member, fullName }).field, 'fullName')
    await assert.rejects(service.createReceptionistMember({ ...member, fullName }), error => error.field === 'fullName')
  }
  assert.equal(calls.length, 0)
})

test('Receptionist accepts Vietnamese names and optional phone numbers', () => {
  for (const fullName of ['Nguyễn Thế Anh', 'Anne Marie Connor', 'a'.repeat(100)]) {
    for (const phone of [undefined, null, '', '   ', '0912345678']) {
      assert.equal(getReceptionistMemberValidationError({ ...member, fullName, phone }), null)
    }
  }
})

test('invalid phone formats never reach the member creation API', async () => {
  const calls = mockApi({ memberId: 1 })
  for (const phone of invalidPhones) {
    assert.equal(getReceptionistMemberValidationError({ ...member, phone }).field, 'phone')
    await assert.rejects(service.createReceptionistMember({ ...member, phone }), error => error.field === 'phone')
  }
  assert.equal(calls.length, 0)
})

test('short, blank, oversized and over-byte-limit passwords never reach counter member creation', async () => {
  const calls = mockApi({ memberId: 1 })
  for (const password of [undefined, null, '', '        ', '123456', '1234567', 'a'.repeat(73), '🏸'.repeat(19)]) {
    await assert.rejects(service.createReceptionistMember({ ...member, password }), error => error.field === 'password')
  }
  assert.equal(calls.length, 0)
})

test('eight-character passwords are accepted and preserved exactly', async () => {
  const calls = mockApi({ memberId: 1 })
  for (const password of ['12345678', ' pass12 ']) {
    await service.createReceptionistMember({ ...member, password })
    assert.equal(calls.at(-1).data.password, password)
  }
})

test('counter member fields enforce their existing input length limits before sending', async () => {
  const calls = mockApi({ memberId: 1 })
  for (const [field, max] of [['email', 256], ['address', 200], ['fitnessGoal', 100]]) {
    await assert.rejects(service.createReceptionistMember({ ...member, [field]: 'a'.repeat(max + 1) }), error => error.field === field)
  }
  assert.equal(calls.length, 0)
})

test('member creation trims the name and phone without changing the password or dropping optional details', async () => {
  const result = { memberId: 1, fullName: 'Nguyễn Thế Anh' }
  const calls = mockApi({ data: result })
  assert.deepEqual(await service.createReceptionistMember({ ...member, phone: ' 0912345678 ', dateOfBirth: '2000-01-01', gender: 'Male', address: ' Hà Nội ', fitnessGoal: ' Tăng sức bền ' }), result)
  assert.deepEqual(calls, [{ method: 'post', url: '/members', data: {
    ...member, fullName: 'Nguyễn Thế Anh', dateOfBirth: '2000-01-01', gender: 'Male', address: 'Hà Nội', fitnessGoal: 'Tăng sức bền',
  } }])
})

test('a member can still be created without a phone or optional profile details', async () => {
  const calls = mockApi({ memberId: 1 })
  await service.createReceptionistMember({ ...member, phone: '   ' })
  assert.deepEqual(calls[0].data, { ...member, fullName: 'Nguyễn Thế Anh', phone: null, dateOfBirth: null, gender: null, address: null, fitnessGoal: null })
})

test('manual check-in requires a member ID or phone before sending a request', async () => {
  const calls = mockApi({ id: 1 })
  for (const form of [{}, { memberId: '', phoneNumber: '' }, { memberId: '  ', phoneNumber: '\t' }, { memberId: null, phoneNumber: null }]) {
    assert.equal(getReceptionistManualCheckInValidationError(form).field, 'memberId')
    await assert.rejects(service.manualReceptionistCheckIn(form), /mã hội viên hoặc số điện thoại/)
  }
  assert.equal(calls.length, 0)
})

test('manual check-in rejects malformed phone numbers even when a valid member ID is supplied', async () => {
  const calls = mockApi({ id: 1 })
  for (const phoneNumber of invalidPhones) {
    for (const memberId of ['', '12']) {
      await assert.rejects(service.manualReceptionistCheckIn({ memberId, phoneNumber }), error => error.field === 'phoneNumber')
    }
  }
  assert.equal(calls.length, 0)
})

test('manual check-in rejects fractional, negative, malformed and out-of-range member IDs', async () => {
  const calls = mockApi({ id: 1 })
  for (const memberId of [0, -1, 1.5, NaN, Infinity, true, {}, [], 'abc', '1.5', '1e2', '0x10', '2147483648', '9007199254740993']) {
    await assert.rejects(service.manualReceptionistCheckIn({ memberId, phoneNumber: '0912345678' }), error => error.field === 'memberId')
  }
  assert.equal(calls.length, 0)
})

test('manual check-in supports ID-only, phone-only and both without losing notes or leading zeroes', async () => {
  const result = { id: 1, memberId: 12 }
  const calls = mockApi({ success: true, data: result })
  for (const [form, expected] of [
    [{ memberId: ' 12 ', notes: 'Tại quầy' }, { memberId: 12, phoneNumber: null, notes: 'Tại quầy' }],
    [{ phoneNumber: ' 0912345678 ' }, { memberId: null, phoneNumber: '0912345678', notes: null }],
    [{ memberId: '12', phoneNumber: '0912345678' }, { memberId: 12, phoneNumber: '0912345678', notes: null }],
    [{ memberId: 2147483647, phoneNumber: '   ' }, { memberId: 2147483647, phoneNumber: null, notes: null }],
  ]) {
    assert.deepEqual(await service.manualReceptionistCheckIn(form), result)
    assert.deepEqual(calls.at(-1), { method: 'post', url: '/GymCheckIns/check-in', data: expected })
  }
  assert.equal(calls.length, 4)
})

test('valid input preserves backend rejections for creation and check-in', async () => {
  mockApi({ success: false, message: 'Email already registered.' })
  await assert.rejects(service.createReceptionistMember(member), /Email already registered/)
  mockApi({ success: false, message: 'Member already checked in.' })
  await assert.rejects(service.manualReceptionistCheckIn({ phoneNumber: '0912345678' }), /already checked in/)
})
