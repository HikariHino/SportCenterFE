import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getNewPasswordValidationError } from '../src/utils/passwordValidation.js'

test('new passwords require at least eight characters without trimming the secret', () => {
  for (const password of [undefined, null, '', '        ', '123456', '1234567', 12345678, {}]) {
    assert.ok(getNewPasswordValidationError(password))
  }
  for (const password of ['12345678', ' pass12 ', 'a'.repeat(72)]) assert.equal(getNewPasswordValidationError(password), '')
  assert.match(getNewPasswordValidationError('a'.repeat(73)), /8 đến 72 ký tự/)
})

test('password length respects the backend UTF-8 limit for accented text and emoji', () => {
  for (const password of ['é'.repeat(36), '🏸'.repeat(18), 'a'.repeat(68) + 'éé']) assert.equal(getNewPasswordValidationError(password), '')
  for (const password of ['é'.repeat(37), '🏸'.repeat(19), 'a'.repeat(69) + 'éé']) assert.match(getNewPasswordValidationError(password), /rút ngắn/)
})
