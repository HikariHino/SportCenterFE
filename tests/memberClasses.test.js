import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bookingUnavailableReason, cancellationDeadline, registrationActions } from '../src/utils/memberClasses.js'

const now = Date.parse('2026-10-19T10:00:00+07:00')
const upcoming = { id: 1, status: 'Confirmed', startsAt: '2026-10-19T14:00:00+07:00', endsAt: '2026-10-19T15:00:00+07:00' }

test('booking rejects full, cancelled, started and already registered sessions', () => {
  const session = { ...upcoming, status: 'Scheduled', capacity: 10, enrolledCount: 9 }
  assert.equal(bookingUnavailableReason(session, false, now), '')
  assert.ok(bookingUnavailableReason({ ...session, enrolledCount: 10 }, false, now))
  assert.ok(bookingUnavailableReason({ ...session, status: 'Cancelled' }, false, now))
  assert.ok(bookingUnavailableReason(session, true, now))
  assert.ok(bookingUnavailableReason(session, false, Date.parse(session.startsAt)))
  assert.ok(bookingUnavailableReason({ ...session, canRegister: false }, false, now))
})

test('cancellation uses the supplied policy including the exact cutoff and zero-hour policy', () => {
  const policy = { ...upcoming, cancellationPolicy: { minimumHoursBeforeStart: 4 } }
  assert.equal(Date.parse(cancellationDeadline(policy)), now)
  assert.equal(registrationActions(policy, now - 1).cancel, true)
  assert.equal(registrationActions(policy, now).cancel, false)
  assert.equal(Date.parse(cancellationDeadline({ ...upcoming, minimumHoursBeforeStart: 0 })), Date.parse(upcoming.startsAt))
  assert.equal(cancellationDeadline(upcoming), null)
  assert.equal(registrationActions({ ...upcoming, canCancel: false }, now).cancel, false)
})

test('cancelled sessions and attended registrations cannot be cancelled or checked in again', () => {
  for (const overrides of [{ status: 'Cancelled' }, { sessionStatus: 'Cancelled' }, { status: 'Attended' }, { attendanceStatus: 'Present' }, { checkInTime: '2026-10-19T09:59:00+07:00' }]) {
    const actions = registrationActions({ ...upcoming, ...overrides }, now)
    assert.equal(actions.cancel, false)
    assert.equal(actions.checkIn, false)
  }
})

test('review is available after the end and is blocked for duplicates and absent members', () => {
  const ended = { ...upcoming, startsAt: '2026-10-19T08:00:00+07:00', endsAt: '2026-10-19T09:00:00+07:00', attendanceStatus: 'Present' }
  assert.equal(registrationActions(upcoming, now).review, false)
  assert.equal(registrationActions(ended, now).review, true)
  for (const overrides of [{ hasReviewed: true }, { review: { rating: 4 } }, { rating: 3 }, { attendanceStatus: 'Absent' }, { status: 'Cancelled' }, { canReview: false }]) {
    assert.equal(registrationActions({ ...ended, ...overrides }, now).review, false)
  }
  assert.equal(registrationActions(ended, now).checkIn, false)
  assert.equal(registrationActions(ended, now).cancel, false)
})

test('missing or invalid end time does not permit an early review', () => {
  assert.equal(registrationActions({ ...upcoming, endsAt: undefined }, now).review, false)
  assert.equal(registrationActions({ ...upcoming, endsAt: 'invalid' }, now).review, false)
  assert.equal(registrationActions({ ...upcoming, sessionStatus: 'Completed' }, now).review, true)
})
