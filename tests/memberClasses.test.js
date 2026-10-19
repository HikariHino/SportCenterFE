import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bookingUnavailableReason, cancellationDeadline, checkInUnavailableReason, hasActiveMembership, registeredSessionIds, registrationActions } from '../src/utils/memberClasses.js'

const now = Date.parse('2026-10-19T10:00:00+07:00')
const upcoming = { id: 1, status: 'Confirmed', startsAt: '2026-10-19T14:00:00+07:00', endsAt: '2026-10-19T15:00:00+07:00' }

test('early check-in is blocked with a Vietnamese opening-time notice', () => {
  const allowed = registrationActions(upcoming, now)
  assert.equal(allowed.checkIn, false)
  assert.match(allowed.checkInReason, /Chưa đến giờ điểm danh/)
  assert.match(allowed.checkInReason, /30 phút/)
  assert.match(allowed.checkInReason, /13:30/)
  assert.match(allowed.checkInReason, /giờ Việt Nam/)
})

test('check-in opens exactly 30 minutes before class and closes at the ending instant', () => {
  const opensAt = Date.parse(upcoming.startsAt) - 30 * 60000
  assert.equal(registrationActions(upcoming, opensAt - 1).checkIn, false)
  for (const time of [opensAt, Date.parse(upcoming.startsAt), Date.parse(upcoming.endsAt) - 1]) {
    assert.equal(registrationActions(upcoming, time).checkIn, true)
    assert.equal(checkInUnavailableReason(upcoming, time), '')
  }
  assert.equal(registrationActions(upcoming, Date.parse(upcoming.endsAt)).checkIn, false)
  assert.match(checkInUnavailableReason(upcoming, Date.parse(upcoming.endsAt)), /đã kết thúc/)
})

test('check-in handles midnight and UTC offsets without opening on the wrong date', () => {
  const item = { ...upcoming, startsAt: '2026-10-19T17:10:00Z', endsAt: '2026-10-19T18:10:00Z' }
  const opensAt = Date.parse('2026-10-19T23:40:00+07:00')
  assert.equal(registrationActions(item, opensAt).checkIn, true)
  assert.equal(registrationActions(item, opensAt - 1).checkIn, false)
  assert.match(checkInUnavailableReason(item, opensAt - 1), /23:40/)
})

test('unknown or invalid session times never offer check-in', () => {
  for (const changes of [{ startsAt: null }, { endsAt: undefined }, { startsAt: 'invalid' }, { endsAt: upcoming.startsAt }]) {
    const item = { ...upcoming, ...changes }
    assert.equal(registrationActions(item, now).checkIn, false)
    assert.match(checkInUnavailableReason(item, now), /Chưa xác định/)
  }
})

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

test('actual session DTO capacity fields and invalid start times cannot offer registration', () => {
  const session = { ...upcoming, status: 'Scheduled', capacity: 20 }
  assert.equal(bookingUnavailableReason({ ...session, currentEnrollment: 20 }, false, now), 'Đã hết chỗ')
  assert.equal(bookingUnavailableReason({ ...session, availableSeats: 0 }, false, now), 'Đã hết chỗ')
  assert.equal(bookingUnavailableReason({ ...session, startsAt: 'invalid' }, false, now), 'Đã đóng đăng ký')
  assert.deepEqual([...registeredSessionIds([{ sessionId: 1, status: 'Registered' }, { sessionId: 2, status: 'Cancelled' }, { status: 'Confirmed' }])], ['1'])
})

test('membership must be active now rather than pending, not started or expired', () => {
  const sub = { status: 'Active', startDate: new Date(now - 1).toISOString(), endDate: new Date(now + 1).toISOString() }
  assert.equal(hasActiveMembership([sub], now), true)
  for (const item of [{ ...sub, status: 'Pending' }, { ...sub, startDate: new Date(now + 1).toISOString() }, { ...sub, endDate: new Date(now - 1).toISOString() }]) assert.equal(hasActiveMembership([item], now), false)
  assert.equal(hasActiveMembership([], now), false)
})
