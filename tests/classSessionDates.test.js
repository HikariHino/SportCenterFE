import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getClassSessionDateRange } from '../src/utils/classSessionDates.js'

test('class dates come from earliest start and latest end regardless of session order', () => {
  const sessions = [
    { startsAt: '2026-11-20T18:00:00+07:00', endsAt: '2026-11-20T19:30:00+07:00' },
    { startsAt: '2026-10-26T18:00:00+07:00', endsAt: '2026-10-26T19:30:00+07:00', status: 'Completed' },
    { startsAt: '2026-11-02T18:00:00+07:00', endsAt: '2026-11-02T19:30:00+07:00' },
  ]
  assert.deepEqual(getClassSessionDateRange(sessions), { startDate: '2026-10-26T11:00:00.000Z', endDate: '2026-11-20T12:30:00.000Z' })
})

test('cancelled sessions do not extend the range and cancelling the only session clears it', () => {
  const session = { startsAt: '2026-10-26T18:00:00+07:00', endsAt: '2026-10-26T19:30:00+07:00' }
  const cancelled = { startsAt: '2026-12-01T18:00:00+07:00', endsAt: '2026-12-01T19:30:00+07:00', Status: 'Cancelled' }
  assert.equal(getClassSessionDateRange([session, cancelled]).endDate, '2026-10-26T12:30:00.000Z')
  assert.deepEqual(getClassSessionDateRange([{ ...session, status: 'Canceled' }]), { startDate: null, endDate: null })
})

test('the end date includes overnight sessions and moving a session changes the range', () => {
  const session = { startsAt: '2026-10-26T23:00:00+07:00', endsAt: '2026-10-27T01:00:00+07:00' }
  assert.deepEqual(getClassSessionDateRange([session]), { startDate: '2026-10-26T16:00:00.000Z', endDate: '2026-10-26T18:00:00.000Z' })
  const moved = { startsAt: '2026-11-02T18:00:00+07:00', endsAt: '2026-11-02T19:30:00+07:00' }
  assert.equal(getClassSessionDateRange([moved]).startDate, '2026-11-02T11:00:00.000Z')
})

test('empty, invalid, unset and reversed dates cannot produce fabricated class dates', () => {
  const sessions = [
    { startsAt: null, endsAt: null }, { startsAt: 'invalid', endsAt: 'invalid' },
    { startsAt: '0001-01-01T00:00:00', endsAt: '0001-01-01T01:00:00' },
    { startsAt: '2026-10-26T19:30:00Z', endsAt: '2026-10-26T18:00:00Z' },
  ]
  assert.deepEqual(getClassSessionDateRange(sessions), { startDate: null, endDate: null })
  assert.deepEqual(getClassSessionDateRange([]), { startDate: null, endDate: null })
})
