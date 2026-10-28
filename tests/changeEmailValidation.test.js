import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changeEmailError, isChangeEmailConflict, normalizeChangeEmail } from '../src/utils/changeEmailValidation.js'

test('current email is blocked regardless of case and surrounding spaces', () => {
  assert.equal(normalizeChangeEmail(' User@Example.COM '), 'user@example.com')
  assert.match(changeEmailError(' USER@example.com ', 'user@EXAMPLE.COM'), /khác email hiện tại/)
  assert.equal(changeEmailError('other@example.com', 'user@example.com'), '')
})

test('empty, malformed and oversized email cannot enable sending', () => {
  for (const email of ['', '  ', 'no-at-sign', 'a@@b.com', 'a b@example.com', 'a'.repeat(250) + '@example.com']) assert.ok(changeEmailError(email, 'current@example.com'))
  assert.equal(changeEmailError('member+new@example.com', 'current@example.com'), '')
})

test('known duplicates stay blocked after changing case, whitespace or selecting another email', () => {
  const duplicates = new Map([['used@example.com', 'Email đã được sử dụng.'], ['taken@example.com', 'Email đã được đăng ký.']])
  for (const email of ['used@example.com', ' USED@EXAMPLE.COM ']) assert.equal(changeEmailError(email, 'me@example.com', duplicates), 'Email đã được sử dụng.')
  assert.equal(changeEmailError('fresh@example.com', 'me@example.com', duplicates), '')
  assert.equal(changeEmailError('taken@example.com', 'me@example.com', duplicates), 'Email đã được đăng ký.')
})

test('duplicate errors are distinguished from OTP expiry, rate limits and network failures', () => {
  for (const error of [
    { response: { status: 409, data: { message: 'Email này đã được sử dụng bởi một tài khoản khác.' } } },
    { response: { status: 200, data: { statusCode: 409, message: 'Conflict' } } },
    new Error('Email đã được đăng ký.'), new Error('Email already in use.'),
  ]) assert.equal(isChangeEmailConflict(error), true)
  for (const error of [
    new Error('Network Error'), new Error('Mã xác nhận đã hết hạn.'),
    { response: { status: 429, data: { message: 'Too many requests' } } },
    new Error('Email service is temporarily unavailable.'),
  ]) assert.equal(isChangeEmailConflict(error), false)
})
