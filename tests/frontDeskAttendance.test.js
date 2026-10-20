import assert from 'node:assert/strict'
import { test } from 'node:test'
import { frontDeskCheckInReason, frontDeskSessionStatus, isFrontDeskPresent } from '../src/utils/frontDeskAttendance.js'

const session = { status: 'Scheduled', startsAt: '2026-10-20T18:00:00+07:00', endsAt: '2026-10-20T19:30:00+07:00' }
const student = { registrationStatus: 'Registered' }
const start = Date.parse(session.startsAt), end = Date.parse(session.endsAt)

test('check-in follows the server window: inclusive 30 minutes before start, exclusive end', () => {
  assert.ok(frontDeskCheckInReason(session, student, start - 30 * 60_000 - 1))
  assert.equal(frontDeskCheckInReason(session, student, start - 30 * 60_000), '')
  assert.equal(frontDeskCheckInReason(session, student, start), '')
  assert.equal(frontDeskCheckInReason(session, student, end - 1), '')
  assert.ok(frontDeskCheckInReason(session, student, end))
})

test('cancelled/completed sessions and cancelled registrations cannot be checked in', () => {
  for (const status of ['Cancelled', 'Canceled', 'Completed']) assert.ok(frontDeskCheckInReason({ ...session, status }, student, start))
  assert.ok(frontDeskCheckInReason(session, { ...student, registrationStatus: 'Cancelled' }, start))
  assert.ok(frontDeskCheckInReason({ ...session, endsAt: 'invalid' }, student, start))
  assert.ok(frontDeskCheckInReason({ ...session, endsAt: session.startsAt }, student, start))
})

test('an explicit absent status is not treated as present just because the record has a timestamp', () => {
  assert.equal(isFrontDeskPresent({ attendanceStatus: 'Present' }), true)
  assert.equal(isFrontDeskPresent({ checkInTime: session.startsAt }), true)
  assert.equal(isFrontDeskPresent({ attendanceStatus: 'Absent', checkInTime: session.startsAt }), false)
  assert.ok(frontDeskCheckInReason(session, { ...student, attendanceStatus: 'Absent', checkInTime: session.startsAt }, start))
  assert.equal(isFrontDeskPresent(student), false)
  assert.ok(frontDeskCheckInReason(session, { ...student, attendanceStatus: 'Present' }, start))
})

test('session badges distinguish scheduled, ongoing, past, completed and cancelled sessions', () => {
  assert.equal(frontDeskSessionStatus(session, start - 1), 'Đã lên lịch')
  assert.equal(frontDeskSessionStatus(session, start), 'Đang diễn ra')
  assert.equal(frontDeskSessionStatus(session, end), 'Đã diễn ra')
  assert.equal(frontDeskSessionStatus({ ...session, status: 'Cancelled' }, start), 'Đã hủy')
  assert.equal(frontDeskSessionStatus({ ...session, status: 'Completed' }, start), 'Đã hoàn thành')
})
