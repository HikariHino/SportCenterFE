import assert from 'node:assert/strict'
import { test } from 'node:test'
import { receptionistCheckInReason } from '../src/utils/receptionistCheckIn.js'

const registration = {
  id: 10, memberId: 20, sessionId: 30, status: 'Registered', sessionStatus: 'Scheduled',
  startsAt: '2026-10-31T15:00:00+07:00', endsAt: '2026-10-31T16:30:00+07:00',
}
const start = Date.parse(registration.startsAt)
const end = Date.parse(registration.endsAt)

test('October 31 cannot check in a registration for November 2 or an earlier date', () => {
  for (const date of ['2026-11-02', '2026-10-30']) {
    assert.match(receptionistCheckInReason({ ...registration, startsAt: `${date}T15:00:00+07:00`, endsAt: `${date}T16:30:00+07:00` }, start), /trong ngày/)
  }
})

test('same-day check-in opens exactly 30 minutes before the start and closes at the end', () => {
  assert.match(receptionistCheckInReason(registration, start - 30 * 60_000 - 1), /30 phút/)
  for (const now of [start - 30 * 60_000, start, start + 1, end - 1]) {
    assert.equal(receptionistCheckInReason(registration, now), '')
  }
  assert.match(receptionistCheckInReason(registration, end), /kết thúc/)
  assert.match(receptionistCheckInReason(registration, end + 1), /kết thúc/)
})

test('the session day follows Vietnam time even when UTC is still the previous day', () => {
  const early = { ...registration, startsAt: '2026-10-30T18:00:00Z', endsAt: '2026-10-30T19:00:00Z' }
  assert.equal(receptionistCheckInReason(early, Date.parse('2026-10-31T00:30:00+07:00')), '')
})

test('an early-morning session cannot be checked in on the previous Vietnam calendar day', () => {
  const midnight = { ...registration, startsAt: '2026-11-01T00:15:00+07:00', endsAt: '2026-11-01T01:00:00+07:00' }
  assert.match(receptionistCheckInReason(midnight, Date.parse('2026-10-31T23:55:00+07:00')), /trong ngày/)
  assert.equal(receptionistCheckInReason(midnight, Date.parse('2026-11-01T00:00:00+07:00')), '')
})

test('an overnight session stops accepting check-in after its scheduled start date', () => {
  const overnight = { ...registration, startsAt: '2026-10-31T23:00:00+07:00', endsAt: '2026-11-01T01:00:00+07:00' }
  assert.equal(receptionistCheckInReason(overnight, Date.parse('2026-10-31T23:30:00+07:00')), '')
  assert.match(receptionistCheckInReason(overnight, Date.parse('2026-11-01T00:00:00+07:00')), /trong ngày/)
})

test('cancelled, completed, missing and invalid session data cannot enable check-in', () => {
  for (const changes of [
    { sessionId: null }, { status: 'Cancelled' }, { status: 'Completed' },
    { sessionStatus: 'Cancelled' }, { sessionStatus: 'Completed' }, { sessionStatus: undefined },
    { startsAt: null }, { endsAt: 'invalid' }, { endsAt: registration.startsAt },
    { endsAt: '2026-10-31T14:00:00+07:00' },
  ]) assert.ok(receptionistCheckInReason({ ...registration, ...changes }, start))
  assert.ok(receptionistCheckInReason(registration, NaN))
})

test('an existing attendance never exposes another check-in action', () => {
  for (const attendanceStatus of ['Present', 'Late', 'Absent', 'Excused']) {
    assert.ok(receptionistCheckInReason({ ...registration, attendanceStatus }, start))
  }
  assert.ok(receptionistCheckInReason({ ...registration, checkInTime: registration.startsAt }, start))
  assert.equal(receptionistCheckInReason({ ...registration, status: ' REGISTERED ', sessionStatus: ' scheduled ' }, start), '')
})
