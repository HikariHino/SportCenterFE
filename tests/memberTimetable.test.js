import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildWeeklyTimetable, shiftTimetableDate, timetableDateKey, timetableTime, timetableWeekStart } from '../src/utils/memberTimetable.js'

test('weeks start on Monday and navigate across month and year boundaries', () => {
  assert.equal(timetableWeekStart('2026-10-25'), '2026-10-19')
  assert.equal(timetableWeekStart('2026-10-19'), '2026-10-19')
  assert.equal(timetableWeekStart('2027-01-01'), '2026-12-28')
  assert.equal(shiftTimetableDate('2026-12-28', 7), '2027-01-04')
  assert.equal(shiftTimetableDate('2027-01-04', -7), '2026-12-28')
})

test('dates and times use Vietnam time regardless of the browser timezone', () => {
  assert.equal(timetableDateKey('2026-10-18T18:30:00Z'), '2026-10-19')
  assert.equal(timetableWeekStart('2026-10-18T18:30:00Z'), '2026-10-19')
  assert.equal(timetableTime('2026-10-18T18:30:00Z'), '01:30')
  assert.equal(timetableTime('2026-10-18T17:00:00Z'), '00:00')
  for (const value of [null, '', 'invalid']) {
    assert.equal(timetableDateKey(value), '')
    assert.equal(timetableTime(value), 'Chưa cập nhật')
  }
})

test('timetable groups shared time slots, sorts by time and preserves multiple classes in a cell', () => {
  const items = [
    { id: 1, startsAt: '2026-10-19T15:00:00+07:00', endsAt: '2026-10-19T17:00:00+07:00' },
    { id: 2, startsAt: '2026-10-20T12:30:00+07:00', endsAt: '2026-10-20T14:45:00+07:00' },
    { id: 3, startsAt: '2026-10-21T12:30:00+07:00', endsAt: '2026-10-21T14:45:00+07:00' },
    { id: 4, status: 'Cancelled', startsAt: '2026-10-20T12:30:00+07:00', endsAt: '2026-10-20T14:45:00+07:00' },
    { id: 5, startsAt: '2026-10-20T12:30:00+07:00', endsAt: '2026-10-20T13:30:00+07:00' },
  ]
  const { days, rows, count } = buildWeeklyTimetable(items, '2026-10-19')
  assert.equal(days.length, 7)
  assert.equal(days[0].key, '2026-10-19')
  assert.equal(days[6].key, '2026-10-25')
  assert.equal(count, 5)
  assert.deepEqual(rows.map(row => [row.start, row.end]), [['12:30', '13:30'], ['12:30', '14:45'], ['15:00', '17:00']])
  assert.deepEqual(rows[1].cells[1].map(item => item.id), [2, 4])
  assert.deepEqual(rows[1].cells[2].map(item => item.id), [3])
  assert.deepEqual(rows[2].cells[0].map(item => item.id), [1])
})

test('week boundaries include Sunday and exclude the following Monday and invalid dates', () => {
  const items = [
    { id: 1, startsAt: '2026-10-18T23:59:00+07:00' },
    { id: 2, startsAt: '2026-10-19T00:00:00+07:00' },
    { id: 3, startsAt: '2026-10-25T23:00:00+07:00', endsAt: '2026-10-26T01:00:00+07:00' },
    { id: 4, startsAt: '2026-10-26T00:00:00+07:00' },
    { id: 5, startsAt: 'invalid' },
    { id: 6, startsAt: null },
  ]
  const { rows, count } = buildWeeklyTimetable(items, '2026-10-19')
  assert.equal(count, 2)
  assert.equal(rows[0].cells[0][0].id, 2)
  assert.equal(rows[0].end, 'Chưa cập nhật')
  assert.equal(rows[1].cells[6][0].id, 3)
  assert.equal(rows[1].nextDay, true)
  assert.equal(buildWeeklyTimetable([], '2026-10-19').rows.length, 0)
})
