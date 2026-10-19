import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionEnrollmentCount, sessionTimeLockReason } from '../src/utils/sessionEnrollment.js'

test('all supported enrolment counters lock time changes when any indicates a registration', () => {
  for (const item of [{ currentEnrollment: 1 }, { enrolledCount: '2' }, { registeredCount: 3 }, { currentEnrollment: 0, registeredCount: 1 }]) {
    assert.ok(sessionEnrollmentCount(item) > 0)
    assert.match(sessionTimeLockReason(item), /không thể thay đổi ngày giờ/)
  }
  assert.equal(sessionTimeLockReason({ currentEnrollment: 0 }), '')
})

test('missing and invalid counters are never interpreted as confirmed zero enrolment', () => {
  for (const item of [undefined, {}, { currentEnrollment: null }, { currentEnrollment: '' }, { currentEnrollment: ' ' }, { currentEnrollment: -1 }, { currentEnrollment: 'invalid' }, { currentEnrollment: false }]) {
    assert.equal(sessionEnrollmentCount(item), null)
    assert.match(sessionTimeLockReason(item), /Chưa xác nhận/)
  }
})
