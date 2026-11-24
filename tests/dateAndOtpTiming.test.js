import assert from 'node:assert/strict'
import { test } from 'node:test'
import { profileDateLimit, profileValidationErrors } from '../src/utils/profileValidation.js'
import { managerBirthDateLimit } from '../src/utils/managerAccountValidation.js'
import { getAuthRegistrationValidationError } from '../src/utils/authRegistrationValidation.js'
import { getReceptionistMemberValidationError } from '../src/utils/receptionistValidation.js'
import { formatOtpRemaining, otpTimeRemaining, OTP_LIFETIME_MS, OTP_RESEND_WAIT_MS } from '../src/utils/otpTiming.js'

test('all account date limits follow midnight in Vietnam before UTC changes day', () => {
  for (const [now, expected] of [['2026-11-16T16:59:59Z', '2026-11-16'], ['2026-11-16T17:00:00Z', '2026-11-17'], ['2026-11-17T00:00:00Z', '2026-11-17']]) {
    assert.equal(profileDateLimit(Date.parse(now)), expected)
    assert.equal(managerBirthDateLimit(Date.parse(now)), expected)
  }
  const now = Date.parse('2026-11-17T01:00:00+07:00')
  const account = { fullName: 'Nguyễn Văn An', email: 'an@example.com', password: 'Password123!', phone: '0912345678' }
  for (const dateOfBirth of ['2010-11-17', '2010-11-17T00:00:00.000Z']) {
    assert.deepEqual(profileValidationErrors({ dateOfBirth }, { partial: true, now }), {})
    assert.equal(getAuthRegistrationValidationError({ ...account, dateOfBirth }, now), null)
    assert.equal(getReceptionistMemberValidationError({ ...account, dateOfBirth }, now), null)
  }
  assert.ok(profileValidationErrors({ dateOfBirth: '2026-11-18' }, { partial: true, now }).dateOfBirth)
})

test('OTP boundaries use absolute deadlines and keep cooldown independent of expiry', () => {
  const sentAt = 1000000
  const deadlines = { expiresAt: sentAt + OTP_LIFETIME_MS, resendAt: sentAt + OTP_RESEND_WAIT_MS }
  assert.deepEqual(otpTimeRemaining(deadlines, sentAt), { remaining: 300, resendRemaining: 30 })
  assert.deepEqual(otpTimeRemaining(deadlines, sentAt + 29999), { remaining: 271, resendRemaining: 1 })
  assert.deepEqual(otpTimeRemaining(deadlines, sentAt + 30000), { remaining: 270, resendRemaining: 0 })
  assert.deepEqual(otpTimeRemaining(deadlines, sentAt + 300000), { remaining: 0, resendRemaining: 0 })
  assert.deepEqual(otpTimeRemaining(deadlines, sentAt + 3600000), { remaining: 0, resendRemaining: 0 })
  assert.equal(formatOtpRemaining(300), '5:00')
  assert.equal(formatOtpRemaining(9), '0:09')
})
