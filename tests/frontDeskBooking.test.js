import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterFrontDeskMembers, frontDeskSessionEligibility, memberBookingReason, selectableFrontDeskSessions } from '../src/utils/frontDeskBooking.js'

const now = Date.parse('2099-10-01T00:00:00Z')
const session = { id: 1, classId: 10, startsAt: '2099-10-21T11:00:00Z', endsAt: '2099-10-21T12:30:00Z', status: 'Scheduled', capacity: 20, currentEnrollment: 5, availableSeats: 15 }
const registration = { id: 100, sessionId: 2, classId: 20, className: 'Boxing', startsAt: '2099-10-21T11:30:00Z', endsAt: '2099-10-21T13:00:00Z', status: 'Registered', sessionStatus: 'Scheduled' }
const check = (sessions = session, registrations = []) => frontDeskSessionEligibility(sessions, registrations, now)
const context = { member: { memberId: 1, isActive: true }, subscriptions: [{ status: 'Active', startDate: '2099-09-01T00:00:00Z', endDate: '2099-12-01T00:00:00Z' }], registrations: [] }

test('member search matches Vietnamese names without accents and formatted phone numbers', () => {
  const members = [{ memberId: 1, fullName: 'Nguyễn Đăng An', phone: '090 123 4567' }, { memberId: 2, fullName: 'Trần Minh Linh', phone: '0912.345.678' }, { memberId: 3, fullName: 'Nguyễn An', phone: null }]
  const ids = query => filterFrontDeskMembers(members, query).map(member => member.memberId)
  assert.deepEqual(ids('  NGUYEN dang '), [1])
  assert.deepEqual(ids('Nguyễn An'), [1, 3])
  assert.deepEqual(ids('090-123'), [1])
  assert.deepEqual(ids('0912345'), [2])
  assert.deepEqual(ids('unknown'), [])
  assert.deepEqual(ids(' '), [1, 2, 3])
})

test('existing sessions are disabled while unregistered sessions in the same class stay available', () => {
  const mine = [{ ...registration, sessionId: 1, classId: 10, ...session, status: 'Registered' }]
  assert.equal(check(session, mine).code, 'registered')
  assert.equal(check({ ...session, id: 3, startsAt: session.endsAt, endsAt: '2099-10-21T14:00:00Z' }, mine).code, 'available')
  assert.equal(check(session, [{ ...mine[0], status: 'Cancelled' }]).code, 'available')
})

test('identical, partial, enclosing and enclosed overlaps with another class are blocked with its name', () => {
  for (const changes of [{}, { startsAt: session.startsAt, endsAt: session.endsAt }, { startsAt: '2099-10-21T10:00:00Z', endsAt: '2099-10-21T14:00:00Z' }, { startsAt: '2099-10-21T11:30:00Z', endsAt: '2099-10-21T12:00:00Z' }]) {
    const result = check(session, [{ ...registration, ...changes }])
    assert.equal(result.code, 'conflict')
    assert.match(result.reason, /Boxing/)
  }
})

test('adjacent times, different dates and cancelled registrations or sessions do not occupy the timetable', () => {
  for (const changes of [{ startsAt: session.endsAt }, { startsAt: '2099-10-21T10:00:00Z', endsAt: session.startsAt }, { startsAt: '2099-10-22T11:00:00Z', endsAt: '2099-10-22T13:00:00Z' }, { status: 'Cancelled' }, { sessionStatus: 'Canceled' }, { sessionStatus: 'Completed' }]) {
    assert.equal(check(session, [{ ...registration, ...changes }]).code, 'available')
  }
})

test('overlaps across midnight and equivalent timezone offsets are detected by instant', () => {
  const overnight = { ...session, startsAt: '2099-10-21T23:00:00+07:00', endsAt: '2099-10-22T01:00:00+07:00' }
  assert.equal(check(overnight, [{ ...registration, startsAt: '2099-10-21T17:30:00Z', endsAt: '2099-10-21T19:00:00Z' }]).code, 'conflict')
})

test('cancelled, completed, full, past and malformed sessions cannot be selected', () => {
  for (const changes of [{ status: 'Cancelled' }, { status: 'Completed' }, { availableSeats: 0 }, { currentEnrollment: 20 }, { startsAt: '2000-01-01T11:00:00Z' }, { endsAt: 'invalid' }, { endsAt: session.startsAt }, { status: 'InProgress' }]) {
    assert.equal(check({ ...session, ...changes }).code, 'unavailable')
  }
})

test('select all chooses only valid sessions, excluding duplicate bookings, conflicts and internal overlaps', () => {
  const adjacent = { ...session, id: 3, startsAt: session.endsAt, endsAt: '2099-10-21T14:00:00Z' }
  const nextDay = { ...session, id: 4, startsAt: '2099-10-22T11:00:00Z', endsAt: '2099-10-22T12:00:00Z' }
  const items = [nextDay, adjacent, session, { ...session, id: 5, startsAt: '2099-10-21T11:30:00Z' }, { ...session, id: 6, status: 'Cancelled' }]
  assert.deepEqual(selectableFrontDeskSessions(items, [], now).map(item => item.id), [1, 3, 4])
  assert.deepEqual(selectableFrontDeskSessions(items, [registration], now).map(item => item.id), [4])
  assert.deepEqual(selectableFrontDeskSessions(items, [{ ...registration, sessionId: 1, ...session, status: 'Registered' }], now).map(item => item.id), [3, 4])
})

test('membership must be active now and missing registered session times block verification', () => {
  assert.equal(memberBookingReason(context, now), '')
  for (const changes of [{ member: { ...context.member, isActive: false } }, { subscriptions: [] }, { subscriptions: [{ ...context.subscriptions[0], status: 'Pending' }] }, { subscriptions: [{ ...context.subscriptions[0], endDate: new Date(now).toISOString() }] }, { registrations: [{ ...registration, endsAt: null }] }]) {
    assert.ok(memberBookingReason({ ...context, ...changes }, now))
  }
  assert.equal(memberBookingReason({ ...context, registrations: [{ ...registration, status: 'Cancelled', startsAt: null }] }, now), '')
})
