import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sessionEnrollmentCount } from '../src/utils/sessionEnrollment.js'

test('all supported enrolment counters retain the largest positive registration count', () => {
  for (const item of [{ currentEnrollment: 1 }, { enrolledCount: '2' }, { registeredCount: 3 }, { currentEnrollment: 0, registeredCount: 1 }]) {
    assert.ok(sessionEnrollmentCount(item) > 0)
  }
  assert.equal(sessionEnrollmentCount({ currentEnrollment: 0 }), 0)
  assert.equal(sessionEnrollmentCount({ currentEnrollment: 2, registeredCount: 5 }), 5)
})

test('missing and invalid counters are never interpreted as confirmed zero enrolment', () => {
  for (const item of [undefined, {}, { currentEnrollment: null }, { currentEnrollment: '' }, { currentEnrollment: ' ' }, { currentEnrollment: -1 }, { currentEnrollment: 'invalid' }, { currentEnrollment: false }]) {
    assert.equal(sessionEnrollmentCount(item), null)
  }
})
