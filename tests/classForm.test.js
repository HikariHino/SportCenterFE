import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildClassPayload, classDateInput } from '../src/utils/classForm.js'

const now = Date.parse('2026-10-19T10:00:00+07:00')
const valid = { className: ' Yoga ', sportId: '1', coachId: '5', maxCapacity: '20', price: '500000.25', startDate: '2026-10-19', endDate: '2026-11-19', isActive: true }

test('class payload includes course dates with the full final day in Vietnam time', () => {
  const result = buildClassPayload(valid, now)
  assert.equal(result.className, 'Yoga')
  assert.equal(result.price, 500000.25)
  assert.equal(result.startDate, '2026-10-19T00:00:00+07:00')
  assert.equal(result.endDate, '2026-11-19T23:59:59.999+07:00')
  assert.equal(result.coachId, 5)
})

test('missing dates, invalid calendars, reversed intervals and years before 2000 are rejected', () => {
  for (const overrides of [{ startDate: '' }, { endDate: '' }, { startDate: '2026-02-30' }, { endDate: '2026-02-30' }, { startDate: '1999-12-31' }, { startDate: '2026-12-01' }, { startDate: 'invalid' }]) {
    assert.throws(() => buildClassPayload({ ...valid, ...overrides }, now))
  }
  const minimum = buildClassPayload({ ...valid, startDate: '2000-01-01' }, now)
  assert.equal(minimum.startDate, '2000-01-01T00:00:00+07:00')
})

test('the exact backend end cutoff and identical timestamps are rejected', () => {
  const endDate = '2026-10-19T10:00:00+07:00'
  assert.throws(() => buildClassPayload({ ...valid, startDate: '2026-10-18', endDate }, now), /hiện tại/)
  assert.doesNotThrow(() => buildClassPayload({ ...valid, startDate: '2026-10-18', endDate }, now - 1))
  assert.throws(() => buildClassPayload({ ...valid, startDate: endDate, endDate }, now - 1), /sau ngày bắt đầu/)
  assert.doesNotThrow(() => buildClassPayload({ ...valid, startDate: '2026-10-19', endDate: '2026-10-19' }, now))
})

test('fees allow zero and two decimals while invalid amounts are rejected', () => {
  for (const price of [0, '0', '0.29', '500000', '500000.25', '1.2300']) assert.doesNotThrow(() => buildClassPayload({ ...valid, price }, now))
  for (const price of ['', ' ', null, undefined, -1, Infinity, NaN, 'invalid', '100.123', '0.001', 1e17]) assert.throws(() => buildClassPayload({ ...valid, price }, now))
})

test('editing displays the Vietnam calendar date and requires correcting unset dates', () => {
  assert.equal(classDateInput('2026-10-18T18:00:00Z'), '2026-10-19')
  for (const value of [undefined, null, '', 'invalid', '0001-01-01T00:00:00Z', '1999-12-31T00:00:00Z']) assert.equal(classDateInput(value), '')
})
