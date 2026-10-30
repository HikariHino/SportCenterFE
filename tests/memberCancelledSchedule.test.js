import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { partitionMemberRegistrations } from '../src/utils/memberClasses.js'

let server, Schedule, Cancelled
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom', logLevel: 'error' })
  Schedule = (await server.ssrLoadModule('/src/pages/member/MemberWeeklySchedule.jsx')).default
  Cancelled = (await server.ssrLoadModule('/src/pages/member/CancelledMemberRegistrations.jsx')).default
})
after(async () => { await server?.close() })

const registration = { id: 100, sessionId: 10, classId: 1, className: 'Gym Nâng Cao',
  status: 'Registered', sessionStatus: 'Scheduled', startsAt: '2026-11-09T18:00:00+07:00', endsAt: '2026-11-09T19:30:00+07:00' }
const items = [registration,
  { ...registration, id: 101, sessionId: 11, startsAt: '2026-11-11T18:00:00+07:00', endsAt: '2026-11-11T19:30:00+07:00' },
  { ...registration, id: 102, sessionId: 12, status: 'Cancelled', startsAt: '2026-11-14T18:00:00+07:00', endsAt: '2026-11-14T19:30:00+07:00', cancellationReason: 'Hội viên tự hủy lịch' },
  { ...registration, id: 103, sessionId: 13, className: 'Yoga Mr. David', sessionStatus: 'Cancelled', cancellationReason: 'Trung tâm hủy buổi: HLV chấn thương' },
]
const history = rows => renderToStaticMarkup(createElement(Cancelled, { items: rows, onSelect: () => {} }))

test('only cancelled registrations or sessions enter history, preserving other dates of the same class', () => {
  const snapshot = structuredClone(items)
  const result = partitionMemberRegistrations(items)
  assert.deepEqual(result.active.map(item => item.id), [100, 101])
  assert.deepEqual(result.cancelled.map(item => item.id), [102, 103])
  assert.deepEqual(items, snapshot)
  assert.equal(result.active[0], registration)
})

test('status variations and missing dates keep all history records without hiding completed sessions', () => {
  const result = partitionMemberRegistrations([
    { ...registration, status: 'Completed' },
    { ...registration, id: 101, status: ' CANCELED ', startsAt: null },
    { ...registration, id: 102, sessionStatus: ' cancelled ', startsAt: 'invalid' },
  ])
  assert.deepEqual(result.active.map(item => item.id), [100])
  assert.deepEqual(result.cancelled.map(item => item.id), [101, 102])
})

test('the weekly table and mobile agenda exclude cancelled sessions while history retains reasons and dates', () => {
  const { active, cancelled } = partitionMemberRegistrations(items)
  const html = renderToStaticMarkup(createElement(Schedule, {
    items: active, weekStart: '2026-11-09', onWeekChange: () => {}, onSelect: () => {}, onBrowse: () => {}, now: Date.parse('2026-10-30'),
  }))
  assert.match(html, /data-session-id="100"/)
  assert.match(html, /data-registration-id="101"/)
  assert.doesNotMatch(html, /data-(?:session|registration)-id="10[23]"/)
  assert.match(html, /2 buổi học/)
  const cancelledHtml = history(cancelled)
  assert.match(cancelledHtml, /Lịch đã hủy/)
  assert.match(cancelledHtml, /2 buổi/)
  assert.match(cancelledHtml, /14\/11\/(?:2026|26)/)
  assert.match(cancelledHtml, /Hội viên tự hủy lịch/)
  assert.match(cancelledHtml, /Trung tâm hủy buổi: HLV chấn thương/)
  assert.match(cancelledHtml, /Xem chi tiết đăng ký đã hủy #102/)
  assert.doesNotMatch(cancelledHtml, /<details[^>]* open/)
})

test('history includes other weeks and paginates without changing the active schedule', () => {
  const rows = Array.from({ length: 13 }, (_, index) => ({ ...items[2], id: 200 + index, startsAt: `2026-11-${String(index + 1).padStart(2, '0')}T18:00:00+07:00` }))
  const { active, cancelled } = partitionMemberRegistrations([registration, ...rows])
  const html = history(cancelled)
  assert.equal(active.length, 1)
  assert.equal(cancelled.length, 13)
  assert.equal((html.match(/<li>/g) || []).length, 12)
  assert.match(html, /Trang 1\/2/)
  assert.match(html, /tất cả các tuần/)
  assert.match(html, /Xem chi tiết đăng ký đã hủy #212/)
  assert.doesNotMatch(html, /Xem chi tiết đăng ký đã hủy #200/)
})

test('empty histories and schedules with only cancellations have clear independent empty states', () => {
  assert.match(history([]), /Bạn chưa có lịch học nào bị hủy/)
  const { active, cancelled } = partitionMemberRegistrations(items.slice(2))
  assert.equal(active.length, 0)
  assert.equal(cancelled.length, 2)
  assert.match(history(cancelled), /2 buổi/)
})
