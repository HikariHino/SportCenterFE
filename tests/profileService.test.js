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
