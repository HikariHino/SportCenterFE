import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getCoachAttendanceAvailability } from '../src/utils/coachAttendance.js'

const session = { id: 30, status: 'Scheduled', startsAt: '2026-11-04T15:00:00+07:00', endsAt: '2026-11-04T16:30:00+07:00' }
const start = Date.parse(session.startsAt), end = Date.parse(session.endsAt)

test('Coach attendance opens exactly 30 minutes before start and closes at the session end', () => {
  assert.equal(getCoachAttendanceAvailability(session, start - 30 * 60_000 - 1).open, false)
  for (const now of [start - 30 * 60_000, start, start + 1, end - 1]) {
    assert.equal(getCoachAttendanceAvailability(session, now).open, true)
  }
  for (const now of [end, end + 1]) assert.equal(getCoachAttendanceAvailability(session, now).open, false)
})

test('Coach cannot mark a future or past session on another Vietnam calendar date', () => {
  for (const date of ['2026-11-02', '2026-11-06']) {
    const result = getCoachAttendanceAvailability({ ...session, startsAt: `${date}T15:00:00+07:00`, endsAt: `${date}T16:30:00+07:00` }, start)
    assert.equal(result.open, false)
    assert.match(result.message, /trong ngày/)
  }
})

test('Vietnam date is used when the UTC date is still the previous day', () => {
  const early = { ...session, startsAt: '2026-11-03T18:00:00Z', endsAt: '2026-11-03T19:00:00Z' }
  assert.equal(getCoachAttendanceAvailability(early, Date.parse('2026-11-04T00:30:00+07:00')).open, true)
})

test('midnight sessions cannot be marked on the previous date even inside the 30-minute window', () => {
  const midnight = { ...session, startsAt: '2026-11-04T00:15:00+07:00', endsAt: '2026-11-04T01:00:00+07:00' }
  assert.equal(getCoachAttendanceAvailability(midnight, Date.parse('2026-11-03T23:55:00+07:00')).open, false)
  assert.equal(getCoachAttendanceAvailability(midnight, Date.parse('2026-11-04T00:00:00+07:00')).open, true)
})

test('overnight sessions stop accepting attendance when the start date has passed', () => {
  const overnight = { ...session, startsAt: '2026-11-04T23:00:00+07:00', endsAt: '2026-11-05T01:00:00+07:00' }
  assert.equal(getCoachAttendanceAvailability(overnight, Date.parse('2026-11-04T23:30:00+07:00')).open, true)
  assert.equal(getCoachAttendanceAvailability(overnight, Date.parse('2026-11-05T00:00:00+07:00')).open, false)
})

test('cancelled, completed, missing and invalid sessions always keep attendance closed', () => {
  for (const changes of [
    { status: 'Cancelled' }, { status: 'Canceled' }, { status: 'Completed' }, { status: '' }, { status: 'Unknown' },
    { startsAt: null }, { startsAt: 'invalid' }, { endsAt: 'invalid' }, { endsAt: session.startsAt }, { endsAt: '2026-11-04T14:00:00+07:00' },
  ]) assert.equal(getCoachAttendanceAvailability({ ...session, ...changes }, start).open, false)
  assert.equal(getCoachAttendanceAvailability(null, start).open, false)
  assert.equal(getCoachAttendanceAvailability(session, NaN).open, false)
})

test('mapped schedule details use raw server status rather than the translated display label', () => {
  assert.equal(getCoachAttendanceAvailability({ ...session, rawStatus: 'scheduled', status: 'Đang diễn ra' }, start).open, true)
  assert.equal(getCoachAttendanceAvailability({ ...session, rawStatus: 'cancelled' }, start).open, false)
  assert.equal(getCoachAttendanceAvailability({ ...session, status: ' SCHEDULED ' }, start).open, true)
})
