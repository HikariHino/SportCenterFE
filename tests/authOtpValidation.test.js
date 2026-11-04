import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { getOtpValidationError, normalizeOtp } from '../src/utils/otpValidation.js'

let server, api, auth
const descriptors = new Map()
const invalidCodes = [undefined, null, '', '   ', 'abc', '12A456', '12345', '1234567', '123 456', '12\n3456', '１２３４５６', '١٢٣٤٥٦', 123456, ['123456'], {}]

before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  auth = await server.ssrLoadModule('/src/services/authService.js')
})

after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('OTP validation rejects missing, nonnumeric and incorrectly sized codes', () => {
  for (const otp of invalidCodes) assert.ok(getOtpValidationError(otp))
  assert.match(getOtpValidationError(''), /nhập mã OTP/)
  assert.match(getOtpValidationError('abc'), /đúng 6 chữ số/)
})

test('OTP validation preserves leading zeroes and trims only surrounding whitespace', () => {
  for (const otp of ['000000', '012345', '123456', '999999', ' 012345\n']) {
    assert.equal(getOtpValidationError(otp), '')
    assert.match(normalizeOtp(otp), /^[0-9]{6}$/)
  }
  assert.equal(normalizeOtp(' 012345 '), '012345')
  assert.equal(normalizeOtp(123456), '')
})

for (const [name, verify] of [
  ['registration', otp => auth.verifyRegisterOtp({ email: 'test@example.test', otp })],
  ['password reset', otp => auth.verifyResetPassword({ email: 'test@example.test', otp, newPassword: ' NewPassword! ', confirmPassword: ' NewPassword! ' })],
]) {
  test(`${name} rejects invalid OTPs before sending any HTTP request`, async () => {
    let requests = 0
    api.defaults.adapter = async () => { requests++; throw new Error('Unexpected HTTP request') }
    for (const otp of invalidCodes) await assert.rejects(verify(otp), /OTP/)
    assert.equal(requests, 0)
  })
}

test('registration sends the six-digit OTP unchanged, including a leading zero', async () => {
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/Auth/verify-register-otp')
    assert.equal(config.skipAuth, true)
    assert.deepEqual(JSON.parse(config.data), { email: 'test@example.test', otp: '012345' })
    return { config, status: 200, headers: {}, data: { message: 'Registered.' } }
  }
  assert.equal((await auth.verifyRegisterOtp({ email: 'test@example.test', otp: ' 012345 ' })).success, true)
})

test('password reset trims OTP whitespace without altering the passwords', async () => {
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/Auth/verify-reset-password')
    assert.equal(config.skipAuth, true)
    assert.deepEqual(JSON.parse(config.data), {
      email: 'test@example.test', otp: '012345', newPassword: ' NewPassword! ', confirmPassword: ' NewPassword! ',
    })
    return { config, status: 200, headers: {}, data: { message: 'Password reset.' } }
  }
  assert.equal((await auth.verifyResetPassword({ email: 'test@example.test', otp: ' 012345 ', newPassword: ' NewPassword! ', confirmPassword: ' NewPassword! ' })).success, true)
})

test('validly formatted but expired or incorrect codes still preserve the server rejection', async () => {
  api.defaults.adapter = async config => ({ config, status: 200, headers: {}, data: { success: false, message: 'OTP expired.' } })
  await assert.rejects(auth.verifyRegisterOtp({ email: 'test@example.test', otp: '123456' }), /OTP expired/)
  assert.equal((await auth.verifyResetPassword({ email: 'test@example.test', otp: '123456', newPassword: 'Password123!', confirmPassword: 'Password123!' })).success, false)
})
