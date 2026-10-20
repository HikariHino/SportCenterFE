import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registrationAttendance, registrationActions } from '../src/utils/memberClasses.js'

const registration = { id: 1, sessionId: 10, status: 'Registered', startsAt: '2026-10-19T11:00:00Z', endsAt: '2026-10-19T12:30:00Z' }

test('actual attendance statuses map to distinct Vietnamese labels', () => {
  for (const [status, label, tone] of [['Present', 'Có mặt', 'success'], ['Late', 'Đi trễ', 'warning'], ['Absent', 'Vắng mặt', 'danger'], ['Excused', 'Vắng có phép', 'warning'], ['CheckedIn', 'Đã điểm danh', 'success']]) {
    const result = registrationAttendance({ ...registration, attendanceStatus: status })
    assert.equal(result.label, label)
    assert.equal(result.tone, tone)
  }
})

test('coach attendance overrides an existing check-in timestamp', () => {
  const item = { ...registration, checkInTime: '2026-10-19T11:01:00Z', attendanceStatus: 'Absent' }
  assert.equal(registrationAttendance(item).code, 'absent')
  assert.equal(registrationAttendance({ ...item, attendanceStatus: 'Excused' }).code, 'excused')
})

test('confirmed check-in times and registration attendance statuses are respected', () => {
  assert.equal(registrationAttendance({ ...registration, checkInTime: '2026-10-19T11:01:00Z' }).code, 'checkedin')
  assert.equal(registrationAttendance({ ...registration, checkedInAt: '2026-10-19T11:01:00Z' }).code, 'checkedin')
  assert.equal(registrationAttendance({ ...registration, status: 'Attended' }).code, 'present')
  assert.equal(registrationAttendance({ ...registration, status: 'NoShow' }).code, 'absent')
})

test('omitted or unknown attendance is never inferred as absence or attendance from class completion', () => {
  for (const changes of [{}, { status: 'Completed' }, { hasReviewed: true }, { attendanceStatus: 'Unknown' }, { checkInTime: 'invalid' }, { attendanceStatus: undefined }]) {
    assert.equal(registrationAttendance({ ...registration, ...changes }).code, 'unknown')
  }
  assert.equal(registrationAttendance({ ...registration, attendanceStatus: null }).code, 'pending')
  assert.equal(registrationAttendance({ ...registration, checkInTime: null }).code, 'pending')
})

test('cancelled registrations and sessions expose no attendance badge', () => {
  for (const changes of [{ status: 'Cancelled' }, { sessionStatus: 'Canceled' }]) {
    assert.equal(registrationAttendance({ ...registration, attendanceStatus: 'Present', ...changes }), null)
  }
})

test('a successful check-in without a returned timestamp still prevents another check-in', () => {
  const item = { ...registration, attendanceStatus: 'CheckedIn', checkInTime: null }
  const actions = registrationActions(item, Date.parse('2026-10-19T10:45:00Z'))
  assert.equal(actions.checkedIn, true)
  assert.equal(actions.checkIn, false)
  assert.equal(actions.cancel, false)
})
