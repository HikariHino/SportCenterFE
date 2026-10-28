import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bookingUnavailableReason, cancellationDeadline, checkInUnavailableReason, hasActiveMembership, registeredSessionIds, registrationActions, reviewUnavailableReason, selectableMemberSessions } from '../src/utils/memberClasses.js'

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

test('member booking blocks identical, partial and enclosing overlaps across classes and time zones', () => {
  const session = { ...upcoming, id: 2, classId: 20, status: 'Scheduled' }
  const registration = { ...upcoming, sessionId: 1, classId: 10, status: 'Registered', sessionStatus: 'Scheduled' }
  for (const times of [
    {},
    { startsAt: '2026-10-19T13:30:00+07:00', endsAt: '2026-10-19T14:30:00+07:00' },
    { startsAt: '2026-10-19T14:30:00+07:00', endsAt: '2026-10-19T15:30:00+07:00' },
    { startsAt: '2026-10-19T13:00:00+07:00', endsAt: '2026-10-19T16:00:00+07:00' },
    { startsAt: '2026-10-19T14:15:00+07:00', endsAt: '2026-10-19T14:45:00+07:00' },
    { startsAt: '2026-10-19T07:00:00Z', endsAt: '2026-10-19T08:00:00Z' },
  ]) assert.match(bookingUnavailableReason(session, false, now, [{ ...registration, ...times }]), /Trùng lịch/)
})

test('member booking allows adjacent sessions, other dates and cancelled or completed registrations', () => {
  const session = { ...upcoming, id: 2, status: 'Scheduled' }
  const registration = { ...upcoming, sessionId: 1, status: 'Registered', sessionStatus: 'Scheduled' }
  for (const changes of [
    { startsAt: '2026-10-19T13:00:00+07:00', endsAt: session.startsAt },
    { startsAt: session.endsAt, endsAt: '2026-10-19T16:00:00+07:00' },
    { startsAt: '2026-10-20T14:00:00+07:00', endsAt: '2026-10-20T15:00:00+07:00' },
    { status: ' Cancelled ' }, { status: 'CANCELED' }, { sessionStatus: 'Cancelled' },
    { status: 'Completed' }, { sessionStatus: 'Completed' },
  ]) assert.equal(bookingUnavailableReason(session, false, now, [{ ...registration, ...changes }]), '')
})

test('member booking detects overlaps through Vietnam midnight', () => {
  const registration = { sessionId: 1, status: 'Confirmed', startsAt: '2026-10-19T23:30:00+07:00', endsAt: '2026-10-20T01:00:00+07:00' }
  const session = { id: 2, status: 'Scheduled', startsAt: '2026-10-19T17:30:00Z', endsAt: '2026-10-19T19:00:00Z' }
  assert.match(bookingUnavailableReason(session, false, now, [registration]), /Trùng lịch/)
  assert.equal(bookingUnavailableReason({ ...session, startsAt: registration.endsAt }, false, now, [registration]), '')
})

test('select all and manual selection retain only nonoverlapping sessions in selection order', () => {
  const first = { ...upcoming, status: 'Scheduled' }
  const overlap = { ...first, id: 2, startsAt: '2026-10-19T14:30:00+07:00', endsAt: '2026-10-19T15:30:00+07:00' }
  const adjacent = { ...first, id: 3, startsAt: first.endsAt, endsAt: '2026-10-19T16:00:00+07:00' }
  assert.deepEqual(selectableMemberSessions([first, overlap, adjacent], [], now).map(item => item.id), [1, 3])
  assert.deepEqual(selectableMemberSessions([overlap, first, adjacent], [], now).map(item => item.id), [2])
  assert.deepEqual(selectableMemberSessions([first, overlap, adjacent], [{ ...first, sessionId: first.id, status: 'Registered' }], now).map(item => item.id), [3])
  // The generic availability check still works without a member timetable.
  assert.equal(bookingUnavailableReason(overlap, false, now), '')
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

test('review requires a completed registration and session with confirmed participation and no previous review', () => {
  const ended = { ...upcoming, sessionId: 10, status: 'Completed', sessionStatus: 'Completed', startsAt: '2026-10-19T08:00:00+07:00', endsAt: '2026-10-19T09:00:00+07:00', attendanceStatus: 'Present' }
  assert.equal(registrationActions(upcoming, now).review, false)
  assert.equal(registrationActions(ended, now).review, true)
  assert.equal(registrationActions({ ...ended, attendanceStatus: 'Late' }, now).review, true)
  assert.equal(registrationActions({ ...ended, status: ' completed ', sessionStatus: ' COMPLETED ', attendanceStatus: ' late ' }, now).review, true)
  for (const overrides of [{ hasReviewed: true }, { review: { rating: 4 } }, { rating: 3 }, { attendanceStatus: 'Absent' }, { status: 'Cancelled' }, { canReview: false }]) {
    assert.equal(registrationActions({ ...ended, ...overrides }, now).review, false)
  }
  assert.equal(registrationActions(ended, now).checkIn, false)
  assert.equal(registrationActions(ended, now).cancel, false)
})

test('missing or invalid end time does not permit an early review', () => {
  assert.equal(registrationActions({ ...upcoming, endsAt: undefined }, now).review, false)
  assert.equal(registrationActions({ ...upcoming, endsAt: 'invalid' }, now).review, false)
  assert.equal(registrationActions({ ...upcoming, sessionStatus: 'Completed' }, now).review, false)
})

test('elapsed time, completed status, a check-in timestamp or canReview cannot replace Present or Late attendance', () => {
  const ended = { ...upcoming, sessionId: 10, status: 'Completed', sessionStatus: 'Completed', endsAt: '2026-10-19T09:00:00+07:00', canReview: true, checkInTime: '2026-10-19T08:00:00+07:00' }
  for (const attendanceStatus of [undefined, null, '', 'Unknown', 'Absent', 'Excused', 'NoShow', 'CheckedIn', 'Attended']) {
    const actions = registrationActions({ ...ended, attendanceStatus }, now)
    assert.equal(actions.review, false)
    assert.ok(actions.reviewReason)
  }
  assert.match(reviewUnavailableReason({ ...ended, attendanceStatus: 'Absent' }, now), /không tham gia/)
  assert.match(reviewUnavailableReason(ended, now), /Chưa có điểm danh/)
})

test('recorded participation alone cannot bypass incomplete statuses or an invalid or future ending time', () => {
  const ended = { id: 1, sessionId: 10, status: 'Completed', sessionStatus: 'Completed', attendanceStatus: 'Present', endsAt: new Date(now).toISOString() }
  assert.equal(registrationActions(ended, now).review, true)
  for (const changes of [{ status: 'Registered' }, { sessionStatus: 'Scheduled' }, { sessionStatus: null }, { sessionId: null }, { endsAt: null }, { endsAt: 'invalid' }, { endsAt: new Date(now + 1).toISOString() }]) {
    assert.equal(registrationActions({ ...ended, ...changes }, now).review, false)
  }
  assert.equal(registrationActions({ ...upcoming, attendanceStatus: 'Present' }, now).reviewReason, '')
  assert.equal(registrationActions({ ...ended, hasReviewed: true }, now).reviewReason, '')
  assert.equal(registrationActions({ ...ended, sessionStatus: 'Cancelled' }, now).reviewReason, '')
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
