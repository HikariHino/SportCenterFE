import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRecurringSessions, formatRecurringWeekdays, getClassDateRange, parseRecurringWeekdays } from '../src/utils/recurringSessions.js'

const now = Date.parse('2026-10-17T10:00:00+07:00')
const form = { weekdays: '246', startTime: '18:00', endTime: '19:30' }
const sportClass = { startDate: '2026-10-18', endDate: '2026-11-14' }
const plan = (fields = {}, course = sportClass, clock = now) => buildRecurringSessions({ ...form, ...fields }, { sportClass: course, now: clock })
const dates = result => result.items.map(item => item.date)

test('compact weekday input, separated values and Vietnamese labels resolve consistently', () => {
  for (const value of ['246', '2, 4, 6', '2 4 6', 'Thứ 2, Thứ 4, Thứ 6', 'T2;T4;T6', '664422']) assert.deepEqual(parseRecurringWeekdays(value), [0, 2, 4])
  assert.deepEqual(parseRecurringWeekdays('357'), [1, 3, 5])
  assert.deepEqual(parseRecurringWeekdays('234567CN'), [0, 1, 2, 3, 4, 5, 6])
  assert.deepEqual(parseRecurringWeekdays('Chủ nhật'), [6])
  assert.equal(formatRecurringWeekdays([0, 2, 6]), '2, 4, CN')
  for (const value of ['', '1', '8', '246abc', '2-6', '2.4', 'monday']) assert.throws(() => parseRecurringWeekdays(value))
})

test('246 creates twelve chronological sessions across the saved four-week class period', () => {
  const result = plan()
  assert.equal(result.items.length, 12)
  assert.deepEqual(dates(result).slice(0, 3), ['2026-10-19', '2026-10-21', '2026-10-23'])
  assert.deepEqual(dates(result).slice(-3), ['2026-11-09', '2026-11-11', '2026-11-13'])
  assert.equal(result.items[0].startsAt, '2026-10-19T11:00:00.000Z')
  assert.equal(result.items[0].endsAt, '2026-10-19T12:30:00.000Z')
  assert.equal(new Set(result.items.map(item => item.startsAt)).size, 12)
  assert.equal(result.skippedPast, 0)
  assert.equal(result.skippedOutsideRange, 0)
})

test('357 includes the final class date when it is one of the selected weekdays', () => {
  const result = plan({ weekdays: '357' })
  assert.equal(result.items.length, 12)
  assert.deepEqual(dates(result).slice(0, 3), ['2026-10-20', '2026-10-22', '2026-10-24'])
  assert.equal(result.items.at(-1).date, '2026-11-14')
})

test('partial first and last weeks use only dates inside the class period', () => {
  assert.deepEqual(dates(plan({}, { startDate: '2026-10-21', endDate: '2026-10-30' })), ['2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30'])
  assert.deepEqual(dates(plan({ weekdays: 'CN' }, { startDate: '2026-10-18', endDate: '2026-10-18' })), ['2026-10-18'])
  assert.deepEqual(dates(plan({ weekdays: '2' }, { startDate: '2026-10-18', endDate: '2026-10-18' })), [])
})

test('saved date ranges cross year and leap-month boundaries correctly', () => {
  assert.deepEqual(dates(plan({ weekdays: '2CN' }, { startDate: '2026-12-28', endDate: '2027-01-10' })), ['2026-12-28', '2027-01-03', '2027-01-04', '2027-01-10'])
  assert.equal(plan({ weekdays: '357' }, { startDate: '2028-02-28', endDate: '2028-03-05' }).items[0].date, '2028-02-29')
})

test('missing, unset and impossible class dates require updating the class', () => {
  for (const course of [{}, { startDate: null, endDate: null }, { startDate: '0001-01-01T00:00:00', endDate: '0001-01-01T00:00:00' }, { ...sportClass, startDate: '2026-02-30' }, { ...sportClass, endDate: '2026-13-01' }]) {
    assert.throws(() => plan({}, course), /cập nhật thời gian/)
  }
  assert.throws(() => buildRecurringSessions(form, { now }), /cập nhật thời gian/)
  assert.throws(() => plan({}, { startDate: '2026-11-14', endDate: '2026-10-18' }), /kết thúc/)
  for (const fields of [{ startTime: '' }, { startTime: '24:00' }, { endTime: '17:00' }, { endTime: '18:00' }]) assert.throws(() => plan(fields))
})

test('past sessions are counted and omitted while future dates remain available', () => {
  const firstStart = Date.parse('2026-10-19T18:00:00+07:00')
  assert.equal(plan({}, sportClass, firstStart - 1).items.length, 12)
  const result = plan({}, sportClass, firstStart)
  assert.equal(result.items.length, 11)
  assert.equal(result.skippedPast, 1)
  assert.equal(result.items[0].date, '2026-10-21')
  const expired = plan({}, sportClass, Date.parse('2026-11-15T00:00:00+07:00'))
  assert.deepEqual(expired.items, [])
  assert.equal(expired.skippedPast, 12)
})

test('saved ISO bounds retain their precise instants when filtering boundary sessions', () => {
  const result = plan({ weekdays: '357' }, { startDate: '2026-10-20T12:00:00Z', endDate: '2026-11-14T00:00:00Z' })
  assert.equal(result.items.length, 10)
  assert.equal(result.skippedOutsideRange, 2)
  assert.equal(result.items[0].date, '2026-10-22')
  assert.equal(result.items.at(-1).date, '2026-11-12')
  assert.equal(plan({}, { startDate: '2026-10-19T11:00:00Z', endDate: '2026-10-19T12:30:00Z' }).items.length, 1)
})

test('UTC class dates and early session times use the Vietnamese calendar date', () => {
  const course = { startDate: '2026-10-18T17:00:00Z', endDate: '2026-10-19T16:59:59.999Z' }
  assert.deepEqual(getClassDateRange(course), { start: '2026-10-19', end: '2026-10-19' })
  const result = plan({ startTime: '01:00', endTime: '02:00' }, course)
  assert.equal(result.items[0].date, '2026-10-19')
  assert.equal(result.items[0].startsAt, '2026-10-18T18:00:00.000Z')
})
