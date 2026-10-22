import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRegistrationError, getRegistrationResult } from '../src/utils/registration.js'

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

test('duplicate email responses identify the email field and show a Vietnamese message', () => {
  for (const data of [
    { statusCode: 409, message: 'Email is already registered.' },
    { detail: 'Email is already registered.' },
    { errors: { email: ['Email is already registered.'] } },
    'Email is already registered.',
  ]) {
    const result = getRegistrationError({ isAxiosError: true, response: { status: 409, data } }, fallback)
    assert.equal(result.field, 'email')
    assert.match(result.message, /Email này đã được đăng ký/)
  }
})

test('duplicate email exception responses hide the backend stack trace', () => {
  const trace = 'SportsCenterAPI.Helpers.BusinessException: Email is already registered.\r\n   at SportsCenterAPI.Services.Implement.AuthService.SendRegisterOtpAsync(RegisterRequestDTO request)'
  for (const data of [trace, { message: trace }, { detail: trace }]) {
    const result = getRegistrationError({ response: { status: 500, data } }, fallback)
    assert.equal(result.field, 'email')
    assert.match(result.message, /Email này đã được đăng ký/)
    assert.doesNotMatch(result.message, /Exception|AuthService/)
  }
  assert.equal(getRegistrationError(new Error(trace), fallback).field, 'email')
})

test('duplicate email failures in HTTP success bodies preserve the field through normalization', () => {
  for (const body of [
    { success: false, message: 'Email is already registered.' },
    { statusCode: 409, message: 'Email is already registered.' },
  ]) {
    assert.throws(() => getRegistrationResult(body, fallback), error => {
      const result = getRegistrationError(error, fallback)
      assert.equal(result.field, 'email')
      assert.match(result.message, /Email này đã được đăng ký/)
      return true
    })
  }
})

test('OTP, validation, connection and other conflict errors are not treated as duplicate emails', () => {
  for (const [status, data, expected] of [
    [400, { message: 'OTP expired' }, 'OTP expired'],
    [400, { errors: { dateOfBirth: ['Date of birth cannot be in the future.'] } }, 'Date of birth cannot be in the future.'],
    [409, { message: 'Registration has changed.' }, 'Registration has changed.'],
  ]) {
    assert.deepEqual(getRegistrationError({ response: { status, data } }, fallback), { field: null, message: expected })
  }
  assert.match(getRegistrationError({ isAxiosError: true, code: 'ERR_NETWORK' }, fallback).message, /Không thể kết nối/)
  assert.match(getRegistrationError({ response: { status: 500, data: { message: 'Database exception' } } }, fallback).message, /Máy chủ gặp sự cố/)
})
