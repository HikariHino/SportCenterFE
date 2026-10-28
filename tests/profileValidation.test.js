import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getEmailValidationError, getFullNameValidationError, getVietnamPhoneValidationError } from '../src/utils/profileValidation.js'

test('profile full name is required and cannot exceed 60 characters', () => {
  assert.match(getFullNameValidationError('   '), /không được để trống/)
  assert.equal(getFullNameValidationError('a'.repeat(60)), '')
  assert.match(getFullNameValidationError('a'.repeat(61)), /60 ký tự/)
})

test('Vietnam phone number uses exactly ten digits and starts with zero', () => {
  assert.equal(getVietnamPhoneValidationError('0901234567'), '')
  assert.equal(getVietnamPhoneValidationError(''), '')
  assert.match(getVietnamPhoneValidationError('', { required: true }), /không được để trống/)
  for (const phone of ['901234567', '090123456', '09012345678', '+84901234567', '090 123 4567', '090123456a']) {
    assert.match(getVietnamPhoneValidationError(phone), /10 chữ số/)
  }
})

test('account email contains one domain separator and ends in dot com', () => {
  for (const email of ['member@example.com', 'coach@sub.example.com']) assert.equal(getEmailValidationError(email), '')
  for (const email of ['', 'member.example.com', 'member@example.vn', 'member@example.com.vn', 'member@@example.com']) {
    assert.notEqual(getEmailValidationError(email), '')
  }
})
