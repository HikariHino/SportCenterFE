import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { getManagerMemberValidationError, getManagerStaffValidationError, managerBirthDateLimit } from '../src/utils/managerAccountValidation.js'

let server, api, service
const descriptors = new Map()
const now = Date.parse('2026-11-04T10:00:00+07:00')
const member = { fullName: 'Nguyễn Thế Anh', email: 'anh@fpt.edu.vn', password: 'Password123!', phone: '0912345678', dateOfBirth: '2000-01-01', gender: 'Male', address: 'Hà Nội', fitnessGoal: 'Tăng sức bền' }
const staff = { fullName: 'Nguyễn An', email: 'coach@example.com', password: 'Password123!', phone: '0912345678', role: 'Coach' }

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/managerAccountService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

function mockApi(t, body = { success: true, data: { memberId: 1, userId: 2 } }) {
  t.mock.method(Date, 'now', () => now)
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, method: config.method, data: JSON.parse(config.data) })
    return { config, status: 200, headers: {}, data: body }
  }
  return calls
}

for (const [name, form, validation, create] of [
  ['member', member, getManagerMemberValidationError, input => service.createManagerMember(input)],
  ['staff', staff, getManagerStaffValidationError, input => service.createManagerStaff(input)],
]) {
  test(`Manager ${name} rejects blank, non-text and overlong names before any request`, async t => {
    const calls = mockApi(t)
    for (const fullName of [undefined, null, '', '   ', '\t\n', '\u00a0\u2003', 'a'.repeat(101), 123, {}]) {
      assert.equal(validation({ ...form, fullName }).field, 'fullName')
      await assert.rejects(create({ ...form, fullName }), error => error.field === 'fullName')
    }
    assert.equal(calls.length, 0)
    for (const fullName of ['Nguyễn Thế Anh', 'Anne Marie Connor', 'a'.repeat(100)]) assert.equal(validation({ ...form, fullName }), null)
  })

  test(`Manager ${name} rejects malformed and overlong emails but accepts education domains`, async t => {
    const calls = mockApi(t)
    for (const email of [undefined, null, '', '  ', 'abc', 'a@@b.com', 'a b@example.com', 'a@fpt..edu.vn', 'a@-example.com', 'a@example.com.', 'a'.repeat(245) + '@example.com']) {
      await assert.rejects(create({ ...form, email }), error => error.field === 'email')
    }
    assert.equal(calls.length, 0)
    for (const email of ['anh@fpt.edu.vn', 'new+account@example.org', 'a'.repeat(244) + '@example.com']) assert.equal(validation({ ...form, email }), null)
  })

  test(`Manager ${name} blocks six/seven-character, blank and oversized passwords before any request`, async t => {
    const calls = mockApi(t)
    for (const password of [undefined, null, '', '        ', '123456', '1234567', 'a'.repeat(73), 'é'.repeat(37), '🏸'.repeat(19), 12345678]) {
      await assert.rejects(create({ ...form, password }), error => error.field === 'password')
    }
    assert.equal(calls.length, 0)
    for (const password of ['12345678', ' pass12 ', 'a'.repeat(72), 'é'.repeat(36)]) assert.equal(validation({ ...form, password }), null)
  })

  test(`Manager ${name} blocks nonnumeric and incorrectly sized phone numbers before any request`, async t => {
    const calls = mockApi(t)
    for (const phone of ['abc', '091234567', '09123456789', '1912345678', '+84912345678', '0912 345 678', '091234567a', '０９１２３４５６７８', 912345678, {}, []]) {
      await assert.rejects(create({ ...form, phone }), error => error.field === 'phone')
    }
    assert.equal(calls.length, 0)
    assert.equal(validation({ ...form, phone: ' 0912345678 ' }), null)
  })
}

test('Manager member creation requires a phone while staff creation keeps it optional', async t => {
  const calls = mockApi(t)
  for (const phone of [undefined, null, '', '   ']) {
    await assert.rejects(service.createManagerMember({ ...member, phone }), error => error.field === 'phone')
    await service.createManagerStaff({ ...staff, phone })
    assert.equal(calls.at(-1).url, '/users/staff')
    assert.equal(calls.at(-1).data.phone, null)
  }
  assert.equal(calls.length, 4)
})

test('member birth dates reject future and impossible dates before any request', async t => {
  const calls = mockApi(t)
  for (const dateOfBirth of ['2026-11-05', '2099-01-01', '2025-02-29', '2000-02-30', '2000-13-01', '0000-01-01', '2026-11-04T00:00:00Z', 'invalid', 20000101, {}]) {
    await assert.rejects(service.createManagerMember({ ...member, dateOfBirth }), error => error.field === 'dateOfBirth')
  }
  assert.equal(calls.length, 0)
  for (const dateOfBirth of ['', null, undefined, '2000-02-29', '2026-11-04']) assert.equal(getManagerMemberValidationError({ ...member, dateOfBirth }, now), null)
})

test('birth date limits follow the Vietnam calendar at midnight without inventing an age limit', () => {
  const midnight = Date.parse('2026-11-03T17:05:00Z')
  assert.equal(managerBirthDateLimit(midnight), '2026-11-04')
  assert.equal(getManagerMemberValidationError({ ...member, dateOfBirth: '2026-11-04' }, midnight), null)
  assert.equal(getManagerMemberValidationError({ ...member, dateOfBirth: '2026-11-05' }, midnight).field, 'dateOfBirth')
})

test('optional member text is bounded and staff roles must be selected from the existing list', async t => {
  const calls = mockApi(t)
  for (const [field, max] of [['address', 200], ['fitnessGoal', 100]]) {
    await assert.rejects(service.createManagerMember({ ...member, [field]: 'a'.repeat(max + 1) }), error => error.field === field)
    assert.equal(getManagerMemberValidationError({ ...member, [field]: 'a'.repeat(max) }, now), null)
  }
  for (const role of ['', undefined, 'Member', 'Admin', 'coach']) await assert.rejects(service.createManagerStaff({ ...staff, role }), error => error.field === 'role')
  assert.equal(calls.length, 0)
  for (const role of ['Manager', 'Coach', 'Receptionist']) assert.equal(getManagerStaffValidationError({ ...staff, role }), null)
})

test('valid member payloads trim profile text, preserve the password and convert the selected date only', async t => {
  const calls = mockApi(t)
  await service.createManagerMember({ ...member, fullName: ' Nguyễn Thế Anh ', email: ' Anh@FPT.EDU.VN ', phone: ' 0912345678 ', password: ' pass12 ', address: ' Hà Nội ', fitnessGoal: ' Tăng sức bền ' })
  assert.deepEqual(calls, [{ url: '/members', method: 'post', data: { ...member, email: 'Anh@FPT.EDU.VN', password: ' pass12 ', dateOfBirth: '2000-01-01T00:00:00.000Z' } }])
})

test('missing optional birth dates remain unset instead of assigning a fabricated date', async t => {
  const calls = mockApi(t)
  await service.createManagerMember({ ...member, dateOfBirth: '', address: '', fitnessGoal: '' })
  assert.equal(calls[0].data.dateOfBirth, null)
  assert.equal(calls[0].data.address, null)
  assert.equal(calls[0].data.fitnessGoal, null)
})

test('valid staff payloads preserve the password, selected role and normalized account details', async t => {
  const calls = mockApi(t)
  await service.createManagerStaff({ ...staff, fullName: ' Nguyễn An ', email: ' Coach@FPT.EDU.VN ', phone: ' 0912345678 ', password: ' pass12 ', role: 'Receptionist' })
  assert.deepEqual(calls, [{ url: '/users/staff', method: 'post', data: { ...staff, email: 'Coach@FPT.EDU.VN', password: ' pass12 ', role: 'Receptionist' } }])
})

test('valid forms still preserve duplicate-email and other backend failures', async t => {
  mockApi(t, { success: false, message: 'Email already registered.' })
  await assert.rejects(service.createManagerMember(member), /Email already registered/)
  await assert.rejects(service.createManagerStaff(staff), /Email already registered/)
})
