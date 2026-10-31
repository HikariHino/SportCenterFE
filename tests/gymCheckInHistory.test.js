import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterGymHistoryDates, formatGymDate, gymCheckInStatus, gymDateKey, gymDateRangeReason, gymDurationLabel, gymDurationMinutes, gymHistoryParams, gymTimestamp, summarizeGymHistory } from '../src/utils/gymCheckInHistory.js'

const visit = (id, time, fields = {}) => ({ id, memberId: 1, memberName: 'Hội viên', checkInTime: time, status: 'CheckedOut', durationMinutes: 60, ...fields })

test('Vietnam day filtering covers the previous UTC day and excludes the following Vietnam day', () => {
  const range = { fromDate: '2026-10-31', toDate: '2026-10-31' }
  assert.deepEqual(gymHistoryParams(range), { fromDate: '2026-10-30', toDate: '2026-10-31' })
  const records = [visit(1, '2026-10-30T16:59:59Z'), visit(2, '2026-10-30T17:00:00Z'),
    visit(3, '2026-10-31T16:59:59Z'), visit(4, '2026-10-31T17:00:00Z')]
  assert.deepEqual(filterGymHistoryDates(records, range).map(item => item.id), [3, 2])
})

test('date ranges validate leap days, impossible months, reverse ranges and open-ended filters', () => {
  for (const range of [{ fromDate: '2026-02-29' }, { fromDate: '2026-99-31' }, { toDate: 'not-a-date' },
    { fromDate: '2026-11-01', toDate: '2026-10-31' }]) {
    assert.ok(gymDateRangeReason(range))
    assert.throws(() => gymHistoryParams(range))
  }
  assert.equal(gymDateRangeReason({ fromDate: '2028-02-29' }), '')
  assert.deepEqual(gymHistoryParams({ toDate: '2026-10-31' }), { toDate: '2026-10-31' })
  assert.deepEqual(gymHistoryParams({}), {})
})

test('UTC timestamps without suffixes are displayed as Vietnam time rather than browser local time', () => {
  assert.equal(gymTimestamp('2026-10-30T17:00:00'), Date.parse('2026-10-30T17:00:00Z'))
  assert.equal(gymDateKey('2026-10-30T17:00:00Z'), '2026-10-31')
  assert.match(formatGymDate('2026-10-30T17:00:00Z'), /31\/10\/26/)
  assert.equal(formatGymDate(null), '—')
})

test('forgotten checkout is not treated as currently in the gym and duration comes from the API', () => {
  const item = visit(1, '2026-10-30T17:00:00Z', { checkOutTime: null, status: 'ForgotCheckOut', durationMinutes: null })
  assert.equal(gymCheckInStatus(item), 'ForgotCheckOut')
  assert.equal(gymDurationMinutes(item), null)
  assert.equal(gymDurationLabel(gymDurationMinutes(item)), '—')
  assert.equal(gymDurationLabel(125), '2 giờ 5 phút')
  assert.equal(gymDurationMinutes({ ...item, status: 'InGym', durationMinutes: 25 }), 25)
})

test('summary uses only visits in the exact chosen range and keeps the latest package and visit time', () => {
  const records = [visit(1, '2026-10-30T17:00:00Z', { packageName: 'Cũ' }),
    visit(2, '2026-10-31T01:00:00Z', { packageName: 'Mới', durationMinutes: 35, status: 'InGym' }),
    visit(3, '2026-10-31T03:00:00Z', { memberId: 2, status: 'ForgotCheckOut', durationMinutes: null })]
  const groups = summarizeGymHistory(records)
  const member = groups.find(item => item.memberId === 1)
  assert.equal(member.totalCheckIns, 2)
  assert.equal(member.totalDurationMinutes, 95)
  assert.equal(member.currentPackageName, 'Mới')
  assert.equal(member.lastCheckInTime, records[1].checkInTime)
  assert.equal(member.isCurrentlyInGym, true)
  assert.equal(groups.find(item => item.memberId === 2).isCurrentlyInGym, false)
  assert.equal(groups.find(item => item.memberId === 2).totalDurationMinutes, 0)
})
