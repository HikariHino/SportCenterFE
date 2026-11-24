import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { getFullNameValidationError, getProfilePhoneValidationError, profileValidationErrors } from '../src/utils/profileValidation.js'
import { getAuthRegistrationValidationError } from '../src/utils/authRegistrationValidation.js'
import { getReceptionistMemberValidationError } from '../src/utils/receptionistValidation.js'
import { getManagerFormValidationError } from '../src/utils/managerFormValidation.js'

let server, api, auth, reception, training, packages
const descriptors = new Map()
const account = { fullName: 'Nguyễn Văn An', email: 'an@fpt.edu.vn', password: 'Password123!', phone: '0912345678', dateOfBirth: '2000-02-29', gender: 'Male' }
const plan = { planName: 'Giáo án', goal: 'GeneralFitness', memberId: 2, startDate: '2026-11-01', endDate: '2026-11-30', exercises: [] }
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  auth = await server.ssrLoadModule('/src/services/authService.js')
  reception = await server.ssrLoadModule('/src/services/receptionistEntryService.js')
  training = await server.ssrLoadModule('/src/services/trainingPlanService.js')
  packages = await server.ssrLoadModule('/src/services/membershipPackageService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
function mockApi() {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push({ url: config.url, body: JSON.parse(config.data) })
    return { data: { success: true, data: { id: 1 } }, status: 200, headers: {}, config }
  }
  return calls
}

test('names accepted at registration remain editable in the profile through 100 characters', () => {
  for (const length of [1, 61, 100]) {
    const fullName = 'A'.repeat(length)
    assert.equal(getAuthRegistrationValidationError({ ...account, fullName }), null)
    assert.equal(getReceptionistMemberValidationError({ ...account, fullName }), null)
    assert.equal(getFullNameValidationError(fullName), '')
    assert.deepEqual(profileValidationErrors({ fullName }, { partial: true }), {})
  }
  assert.ok(getFullNameValidationError('A'.repeat(101)))
})

test('profile forms and profile service share local, +84 and separator phone formats', () => {
  for (const phoneNumber of ['0912345678', '+84912345678', '+84 912 345 678', '(0912) 345-678']) {
    assert.equal(getProfilePhoneValidationError(phoneNumber), '')
    assert.deepEqual(profileValidationErrors({ phoneNumber }, { partial: true }), {})
  }
  for (const phoneNumber of ['abc', '+840912345678', '09123456789', 912345678, {}, '0'.repeat(31)]) assert.ok(getProfilePhoneValidationError(phoneNumber))
})

for (const [label, send] of [['registration', form => auth.register(form)], ['registration OTP', form => auth.sendRegisterOtp(form)], ['counter member', form => reception.createReceptionistMember(form)]]) {
  test(`${label} rejects malformed emails and impossible or future birth dates before the API`, async () => {
    const calls = mockApi()
    for (const email of ['', 'abc', 'an@@example.com', 'an@-domain.com']) await assert.rejects(send({ ...account, email }), error => error.field === 'email')
    for (const dateOfBirth of ['1900-01-01', '1949-12-31', '2015-01-01', '2030-01-01', '2001-02-29', '2026-02-30', 'bad-date', true]) await assert.rejects(send({ ...account, dateOfBirth }), error => error.field === 'dateOfBirth')
    await assert.rejects(send({ ...account, gender: 'invalid' }), error => error.field === 'gender')
    assert.equal(calls.length, 0)
    await send(account)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].body.email, account.email)
  })
}

test('registration and OTP services block under-sixteen or missing birth dates before the API', async () => {
  const calls = mockApi()
  for (const send of [form => auth.register(form), form => auth.sendRegisterOtp(form)]) {
    for (const dateOfBirth of ['2020-01-01', '2020-01-01T00:00:00.000Z', '', null, undefined]) {
      await assert.rejects(send({ ...account, dateOfBirth }), error => error.field === 'dateOfBirth')
    }
  }
  assert.equal(calls.length, 0)
})

test('registration service rejects invalid phone numbers and preserves supported international numbers', async () => {
  const calls = mockApi()
  for (const phone of ['abc', '09123', '+840912345678', '0'.repeat(31), true]) await assert.rejects(auth.sendRegisterOtp({ ...account, phone }), error => error.field === 'phone')
  assert.equal(calls.length, 0)
  await auth.sendRegisterOtp({ ...account, phone: '+84912345678' })
  assert.equal(calls[0].body.phone, '+84912345678')
})

test('package prices cannot change value through Number conversion or JSON serialization', async () => {
  const calls = mockApi()
  for (const price of ['9007199254740993', '9007199254740992', '90071992547409.90', '90071992547409.91', '90071992547409.92', '9999999999999999.99', '0.001']) {
    assert.ok(getManagerFormValidationError('package', { packageName: 'Test', price, durationInDays: 30 }))
    await assert.rejects(packages.createMembershipPackage({ packageName: 'Test', price, durationInDays: 30 }))
    await assert.rejects(packages.updateMembershipPackage(1, { packageName: 'Test', price, durationInDays: 30 }))
  }
  assert.equal(calls.length, 0)
  for (const price of ['0.01', '51000.25', '1000000', '90071992547400.00']) {
    await packages.createMembershipPackage({ packageName: 'Test', price, durationInDays: 30 })
    const [whole, fraction = ''] = price.split('.')
    const expectedCents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
    assert.equal(BigInt(Math.round(calls.at(-1).body.price * 100)), expectedCents)
  }
})

test('training plan service rejects blank names, invalid identities/goals and reversed or impossible dates before writes', async () => {
  const calls = mockApi()
  for (const changes of [{ planName: '   ' }, { goal: 'invalid' }, { memberId: -1 }, { memberId: 2147483648 }, { startDate: null }, { startDate: '2026-02-30' }, { startDate: '2026-11-01T99:00:00' }, { endDate: '2026-10-31' }]) await assert.rejects(training.createTrainingPlan({ ...plan, ...changes }))
  assert.equal(calls.length, 0)
  await training.createTrainingPlan({ ...plan, memberId: '2', planName: ' Giáo án ' })
  assert.equal(calls[0].body.memberId, 2)
  assert.equal(calls[0].body.planName, 'Giáo án')
  await training.createTrainingPlan({ ...plan, endDate: plan.startDate })
})
