import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const storageDescriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    storageDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/profileService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of storageDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('profile updates send all supported member fields and never send the retired email field', async () => {
  const dto = { fullName: 'Nguyễn An', phoneNumber: '0901234567', dateOfBirth: '2000-01-01T00:00:00.000Z',
    gender: 'Female', address: 'Hà Nội', fitnessGoal: 'Tăng sức bền', emergencyContact: 'Người thân 0912345678' }
  api.defaults.adapter = async config => {
    assert.equal(config.method, 'put')
    assert.equal(config.url, '/profile')
    assert.deepEqual(JSON.parse(config.data), dto)
    return { data: { success: true, data: { userId: 1, ...dto } }, status: 200, headers: {}, config }
  }
  assert.equal((await service.updateProfile({ ...dto, email: 'ignored@example.test', userId: 999, role: 'Manager' })).userId, 1)
})

test('password-only updates keep the exact password and current password without sending member fields', async () => {
  const dto = { password: ' NewPassword! ', currentPassword: ' CurrentPassword! ' }
  api.defaults.adapter = async config => {
    assert.deepEqual(JSON.parse(config.data), dto)
    return { data: { userId: 1 }, status: 200, headers: {}, config }
  }
  await service.updateProfile({ ...dto, dateOfBirth: undefined })
})

test('email changes use the two OTP endpoints with normalized newEmail and the six digit code', async () => {
  const reads = []
  api.defaults.adapter = async config => {
    reads.push({ url: config.url, method: config.method, payload: JSON.parse(config.data) })
    return { data: { success: true, data: { userId: 1, email: 'new@example.test' } }, status: 200, headers: {}, config }
  }
  await service.requestChangeEmailOtp(' New@Example.Test ')
  const result = await service.verifyChangeEmailOtp(' New@Example.Test ', ' 123456 ')
  assert.equal(result.email, 'new@example.test')
  assert.deepEqual(reads, [
    { url: '/profile/change-email/request-otp', method: 'post', payload: { newEmail: 'new@example.test' } },
    { url: '/profile/change-email/verify-otp', method: 'post', payload: { newEmail: 'new@example.test', otp: '123456' } },
  ])
})

test('malformed OTPs never reach the API', async () => {
  let calls = 0
  api.defaults.adapter = async () => { calls++; throw new Error('Unexpected request') }
  for (const otp of ['', '12345', '1234567', '12A456', '123 56']) {
    await assert.rejects(service.verifyChangeEmailOtp('new@example.test', otp), /6 chữ số/)
  }
  assert.equal(calls, 0)
})

test('OTP expiry, attempt limits, duplicate email and profile errors propagate without reporting success', async () => {
  for (const message of ['Email này đã được sử dụng.', 'Mã xác nhận đã hết hạn.', 'Bạn đã nhập sai mã quá 5 lần.']) {
    api.defaults.adapter = async config => ({ data: { success: false, message }, status: 200, headers: {}, config })
    await assert.rejects(service.requestChangeEmailOtp('new@example.test'), { message })
    await assert.rejects(service.verifyChangeEmailOtp('new@example.test', '123456'), { message })
    await assert.rejects(service.updateProfile({ fullName: 'An' }), { message })
  }
})

test('invalid profile fields are rejected before PUT, including bypassed HTML length constraints', async () => {
  let calls = 0
  api.defaults.adapter = async () => { calls += 1; throw new Error('Unexpected write') }
  for (const dto of [
    { fullName: '   ' }, { fullName: 'a'.repeat(201) }, { phoneNumber: 'abc123' }, { phoneNumber: '091234567' },
    { dateOfBirth: '2025-02-29' }, { dateOfBirth: '2099-10-25' }, { gender: 'Invalid' },
    { address: 'a'.repeat(501) }, { fitnessGoal: 'a'.repeat(101) }, { emergencyContact: 'a'.repeat(101) },
    { password: 'a'.repeat(73), currentPassword: 'old' },
    { password: 'SamePassword!', currentPassword: 'SamePassword!' },
  ]) {
    await assert.rejects(service.updateProfile(dto), error => Boolean(error.fieldErrors && Object.keys(error.fieldErrors).length))
  }
  assert.equal(calls, 0)
})

test('profile payloads normalize whitespace and phone separators, while keeping names and emergency contact text', async () => {
  let payload
  api.defaults.adapter = async config => {
    payload = JSON.parse(config.data)
    return { data: { ...payload, userId: 1 }, status: 200, headers: {}, config }
  }
  await service.updateProfile({ fullName: '  Nguyễn-Văn An  ', phoneNumber: '+84 912 345 678', emergencyContact: '  Mẹ: 0912 345 678  ' })
  assert.deepEqual(payload, { fullName: 'Nguyễn-Văn An', phoneNumber: '+84912345678', emergencyContact: 'Mẹ: 0912 345 678' })
})

test('profile validation errors returned in a success HTTP envelope retain their field details', async () => {
  api.defaults.adapter = async config => ({ data: { success: false, message: 'Dữ liệu không hợp lệ.', errors: { PhoneNumber: ['Số điện thoại đã được sử dụng.'] } }, status: 200, headers: {}, config })
  await assert.rejects(service.updateProfile({ fullName: 'An' }), error => error.response.data.errors.PhoneNumber[0] === 'Số điện thoại đã được sử dụng.')
})

test('duplicate phone HTTP 409 rejects the entire update and preserves the backend error for inline feedback', async () => {
  const body = { statusCode: 409, message: 'Số điện thoại đã được sử dụng.' }
  let writes = 0
  api.defaults.adapter = async config => {
    writes++
    throw Object.assign(new Error('Request failed with status code 409'), { config, response: { status: 409, data: body } })
  }
  await assert.rejects(service.updateProfile({ fullName: 'Changed name', phoneNumber: '0912345678' }), error => error.response.status === 409 && error.response.data.message === body.message)
  assert.equal(writes, 1)
})

test('a duplicate statusCode in an HTTP 200 body cannot be mistaken for a saved profile', async () => {
  api.defaults.adapter = async config => ({ data: { statusCode: 409, message: 'Số điện thoại đã được sử dụng.' }, status: 200, headers: {}, config })
  await assert.rejects(service.updateProfile({ phoneNumber: '0912345678' }), error => error.response.data.statusCode === 409 && error.message === 'Số điện thoại đã được sử dụng.')
})

test('OTP request and verification preserve duplicate-email metadata in failure envelopes', async () => {
  for (const body of [
    { success: false, statusCode: 409, message: 'Email này đã được sử dụng.' },
    { statusCode: 409, message: 'Email này đã được sử dụng.' },
  ]) {
    api.defaults.adapter = async config => ({ data: body, status: 200, headers: {}, config })
    for (const action of [() => service.requestChangeEmailOtp('used@example.com'), () => service.verifyChangeEmailOtp('used@example.com', '123456')]) {
      await assert.rejects(action(), error => error.response.data.statusCode === 409 && error.message === body.message)
    }
  }
})

test('wrong OTP HTTP 400 exposes the backend message without resolving verification', async () => {
  const message = 'Mã xác nhận OTP không chính xác.'
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/profile/change-email/verify-otp')
    assert.deepEqual(JSON.parse(config.data), { newEmail: 'new@example.com', otp: '111111' })
    throw Object.assign(new Error('Request failed with status code 400'), { config, response: { status: 400, data: { statusCode: 400, message } } })
  }
  await assert.rejects(service.verifyChangeEmailOtp('new@example.com', '111111'), error => service.getProfileErrorMessage(error) === message)
})
