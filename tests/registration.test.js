import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRegistrationResult } from '../src/utils/registration.js'

const fallback = 'Registration failed'

test('sending OTP succeeds when the HTTP success body has no success flag', () => {
  const result = getRegistrationResult({ message: 'OTP sent successfully', statusCode: 200 }, fallback)
  assert.equal(result.success, true)
  assert.equal(result.message, 'OTP sent successfully')
})

test('OTP verification exposes session data from direct and wrapped responses', () => {
  const session = { userId: 12, email: 'member@example.test', role: 'Member', token: 'access-token' }
  for (const body of [session, { data: session }, { success: true, data: session }]) {
    const result = getRegistrationResult(body, fallback)
    assert.equal(result.success, true)
    assert.deepEqual(result.data, session)
  }
  const result = getRegistrationResult({ accessToken: 'access-token' }, fallback)
  assert.equal(result.data.accessToken, 'access-token')
})

test('successful verification without a session allows the login redirect', () => {
  for (const body of [{ message: 'Registration successful' }, { success: true, data: null }]) {
    const result = getRegistrationResult(body, fallback)
    assert.equal(result.success, true)
    assert.equal(result.data.token, undefined)
    assert.equal(result.data.accessToken, undefined)
  }
})

test('explicit failures and expired OTP errors are preserved even on HTTP success', () => {
  for (const body of [
    { success: false, message: 'OTP expired' },
    { statusCode: 400, message: 'OTP expired' },
    { success: true, statusCode: '400', errors: { otp: ['OTP expired'] } },
  ]) {
    assert.throws(() => getRegistrationResult(body, fallback), /OTP expired/)
  }
})

test('empty and malformed responses cannot mark an OTP request successful', () => {
  for (const body of [null, undefined, '', '<html>Proxy error</html>', false, []]) {
    assert.throws(() => getRegistrationResult(body, fallback), /Registration failed/)
  }
})
