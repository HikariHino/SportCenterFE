import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeProfilePhone, normalizeProfileUpdate, passwordChangeErrors, profileDateLimit, profileFieldErrors, profileValidationErrors } from '../src/utils/profileValidation.js'

const now = Date.parse('2026-10-24T06:00:00Z')
const valid = { fullName: 'Phạm Thị Hồng Vy', phoneNumber: '0326541256', gender: 'Female', dateOfBirth: '2004-05-29', address: 'Hà Nội', fitnessGoal: 'Tăng 5 kg', emergencyContact: 'Nguyễn An - 0912 345 678' }
const errors = (changes = {}, options = {}) => profileValidationErrors({ ...valid, ...changes }, { now, ...options })

test('names preserve Unicode, punctuation and single-character names, while blank and oversized names are blocked', () => {
  for (const fullName of ['  Nguyễn-Văn An  ', "Anne O’Connor", '李', 'A', 'a'.repeat(200)]) assert.deepEqual(errors({ fullName }), {})
  for (const fullName of ['', '   ', '\t\n', null, 'a'.repeat(201), 123]) assert.ok(errors({ fullName }).fullName)
})

test('profile phone format matches registration and normalizes separators without removing the country code', () => {
  for (const phoneNumber of ['0912345678', '0912 345 678', '0912.345.678', '0912-345-678', '(0912) 345 678', '+84 912 345 678']) assert.deepEqual(errors({ phoneNumber }), {})
  assert.equal(normalizeProfilePhone(' (0912) 345-678 '), '0912345678')
  assert.equal(normalizeProfilePhone('+84 912.345.678'), '+84912345678')
  for (const phoneNumber of ['091234567', '09123456789', '9123456789', '+840912345678', '0912abc678', '++84912345678', '0'.repeat(31)]) assert.ok(errors({ phoneNumber }).phoneNumber)
})

test('optional missing values remain allowed, while persisted phone and date cannot be silently removed', () => {
  assert.deepEqual(errors({ phoneNumber: '', dateOfBirth: '', gender: '', address: '', fitnessGoal: '', emergencyContact: '' }), {})
  assert.ok(errors({ phoneNumber: '  ' }, { requirePhone: true }).phoneNumber)
  assert.ok(errors({ dateOfBirth: '' }, { requireDateOfBirth: true }).dateOfBirth)
})

test('birth dates reject impossible dates, invalid years and future days without inventing a minimum age', () => {
  for (const dateOfBirth of ['2000-02-29', '2026-10-24', '1900-01-01', '2004-05-29T00:00:00.000Z']) assert.deepEqual(errors({ dateOfBirth }), {})
  for (const dateOfBirth of ['2001-02-29', '2026-02-30', '2026-13-01', '2026-10-25', '29/05/2004', '0000-01-01', '2004-05-29junk', '2004-05-29T99:00:00Z']) assert.ok(errors({ dateOfBirth }).dateOfBirth)
  const beforeUtcMidnight = Date.parse('2026-10-24T18:00:00Z')
  assert.equal(profileDateLimit(beforeUtcMidnight), '2026-10-24')
  assert.ok(errors({ dateOfBirth: '2026-10-25' }, { now: beforeUtcMidnight }).dateOfBirth)
})

test('only supported gender values are accepted, and optional text is checked against backend lengths after trimming', () => {
  for (const gender of ['', 'Male', 'Female', 'Other']) assert.deepEqual(errors({ gender }), {})
  assert.ok(errors({ gender: 'unknown' }).gender)
  for (const [field, limit] of [['address', 500], ['fitnessGoal', 100], ['emergencyContact', 100]]) {
    assert.deepEqual(errors({ [field]: `  ${'x'.repeat(limit)}  ` }), {})
    assert.ok(errors({ [field]: 'x'.repeat(limit + 1) })[field])
  }
  for (const emergencyContact of ['Nguyễn Văn An - 0912345678', '0912345678', 'Mẹ: +84 912 345 678']) assert.deepEqual(errors({ emergencyContact }), {})
})

test('partial profile writes omit unrelated fields and preserve exact passwords', () => {
  assert.deepEqual(profileValidationErrors({ fullName: 'An' }, { partial: true }), {})
  assert.deepEqual(profileValidationErrors({ password: ' NewPassword! ', currentPassword: ' CurrentPassword! ' }, { partial: true }), {})
  assert.ok(profileValidationErrors({ password: '1234567', currentPassword: 'old' }, { partial: true }).password)
  assert.ok(profileValidationErrors({ password: 'x'.repeat(73), currentPassword: 'old' }, { partial: true }).password)
  assert.ok(profileValidationErrors({ password: '12345678' }, { partial: true }).currentPassword)
  assert.ok(profileValidationErrors({ dateOfBirth: '' }, { partial: true }).dateOfBirth)
  const payload = normalizeProfileUpdate({ fullName: ' An ', phoneNumber: ' 0912 345 678 ', address: ' Hà Nội ', emergencyContact: ' Mẹ: 0912345678 ', password: ' NewPassword! ', currentPassword: ' old ', dateOfBirth: undefined, email: 'ignored@example.test', role: 'Manager' })
  assert.deepEqual(payload, { fullName: 'An', phoneNumber: '0912345678', address: 'Hà Nội', emergencyContact: 'Mẹ: 0912345678', password: ' NewPassword! ', currentPassword: ' old ' })
  assert.deepEqual(normalizeProfileUpdate({ phoneNumber: '' }), { phoneNumber: null })
})

test('API validation fields and phone uniqueness errors map to inline feedback', () => {
  assert.deepEqual(profileFieldErrors({ response: { data: { errors: { FullName: ['Tên không hợp lệ'], 'dto.DateOfBirth': ['Ngày sinh sai'], '$.Address': ['Địa chỉ quá dài'] } } } }), { fullName: 'Tên không hợp lệ', dateOfBirth: 'Ngày sinh sai', address: 'Địa chỉ quá dài' })
  assert.deepEqual(profileFieldErrors({ response: { status: 409, data: { message: 'Số điện thoại đã được sử dụng.' } } }), { phoneNumber: 'Số điện thoại đã được sử dụng.' })
  assert.deepEqual(profileFieldErrors(new Error('Không thể kết nối máy chủ.')), {})
})

test('a rejected duplicate phone remains invalid across formatting changes but does not block another number', () => {
  const phoneConflict = { phoneNumber: '0912345678', message: 'Số điện thoại đã được sử dụng.' }
  for (const phoneNumber of ['0912345678', '0912 345 678', '(0912) 345-678', '+84 912 345 678']) {
    assert.equal(errors({ phoneNumber }, { phoneConflict }).phoneNumber, phoneConflict.message)
  }
  assert.deepEqual(errors({ phoneNumber: '0987654321' }, { phoneConflict }), {})
  assert.deepEqual(errors({ phoneNumber: '0912345678' }), {})
  assert.equal(errors({ phoneNumber: '0912345678', address: 'New address' }, { phoneConflict }).phoneNumber, phoneConflict.message)
  assert.equal(errors({ phoneNumber: '0912345678' }, { phoneConflict: { ...phoneConflict, phoneNumber: '+84912345678' } }).phoneNumber, phoneConflict.message)
})

test('password changes require a different new password and matching confirmation', () => {
  assert.deepEqual(passwordChangeErrors({ currentPassword: 'OldPassword!', newPassword: 'NewPassword!', confirmPassword: 'NewPassword!' }), {})
  const same = passwordChangeErrors({ currentPassword: 'OldPassword!', newPassword: 'OldPassword!', confirmPassword: 'OldPassword!' })
  assert.match(same.newPassword, /khác mật khẩu hiện tại/)
  assert.match(passwordChangeErrors({ currentPassword: 'OldPassword!', newPassword: 'NewPassword!', confirmPassword: 'WrongPassword!' }).confirmPassword, /không khớp/)
  assert.ok(passwordChangeErrors({ currentPassword: 'OldPassword!', newPassword: 'NewPassword!', confirmPassword: '' }).confirmPassword)
  assert.ok(passwordChangeErrors({ currentPassword: '', newPassword: '', confirmPassword: '' }).currentPassword)
})

test('password validation rechecks comparisons after any field changes and compares exact characters', () => {
  const values = { currentPassword: 'OldPassword!', newPassword: 'NewPassword!', confirmPassword: 'NewPassword!' }
  assert.ok(passwordChangeErrors({ ...values, currentPassword: 'NewPassword!' }).newPassword)
  assert.ok(passwordChangeErrors({ ...values, newPassword: 'AnotherPassword!' }).confirmPassword)
  assert.deepEqual(passwordChangeErrors({ currentPassword: 'newPassword!', newPassword: 'NewPassword!', confirmPassword: 'NewPassword!' }), {})
  assert.deepEqual(passwordChangeErrors({ currentPassword: 'NewPassword!', newPassword: ' NewPassword! ', confirmPassword: ' NewPassword! ' }), {})
  assert.ok(passwordChangeErrors({ ...values, confirmPassword: ' NewPassword! ' }).confirmPassword)
  for (const newPassword of ['1234567', 'x'.repeat(73)]) assert.ok(passwordChangeErrors({ ...values, newPassword, confirmPassword: newPassword }).newPassword)
})
