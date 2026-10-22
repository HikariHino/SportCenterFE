import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server, RoomSessionTimetable
before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom', logLevel: 'error',
  })
  RoomSessionTimetable = (await server.ssrLoadModule('/src/pages/CenterManager/RoomSessionTimetable.jsx')).default
})
after(async () => { await server?.close() })

const session = { id: 1, className: 'Scheduled Yoga', status: 'Scheduled', startsAt: '2026-10-21T11:00:00Z', endsAt: '2026-10-21T12:30:00Z' }
const render = (items, props = {}) => renderToStaticMarkup(createElement(RoomSessionTimetable, {
  items, weekStart: '2026-10-19', onWeekChange: () => {}, onSelect: () => {},
  ...props,
}))
const sections = html => {
  const boundary = html.indexOf('<details class="room-cancelled-sessions">')
  assert.ok(boundary > 0)
  return { timetable: html.slice(0, boundary), cancellations: html.slice(boundary) }
}

test('cancelled sessions move out of the room grid and counts while their replacement stays in the original slot', () => {
  const items = [
    session,
    { ...session, id: 2, className: 'Cancelled Yoga', status: 'Cancelled', coachName: 'Coach An', cancellationReason: 'Bảo trì phòng' },
    { ...session, id: 3, className: 'Cancelled Gym', status: ' CANCELED ', startsAt: '2026-11-01T11:00:00Z', endsAt: '2026-11-01T12:30:00Z' },
    { ...session, id: 4, className: 'Completed Yoga', status: 'Completed' },
  ]
  const { timetable, cancellations } = sections(render(items))
  assert.match(timetable, /Scheduled Yoga/)
  assert.match(timetable, /Completed Yoga/)
  assert.doesNotMatch(timetable, /Cancelled Yoga|Cancelled Gym|is-cancelled/)
  assert.match(timetable, /2 buổi tuần này · 2 buổi tổng cộng/)
  assert.match(cancellations, /2 buổi/)
  assert.match(cancellations, /Cancelled Yoga/)
  assert.match(cancellations, /Cancelled Gym/)
  assert.match(cancellations, /Coach An/)
  assert.match(cancellations, /Bảo trì phòng/)
  assert.match(cancellations, /18:00[^<]*21\/10\/(?:20)?26/)
  assert.match(cancellations, /19:30[^<]*21\/10\/(?:20)?26/)
  assert.match(cancellations, /Xem chi tiết/)
  assert.doesNotMatch(cancellations, /Scheduled Yoga|Completed Yoga|draggable=/)
  assert.ok(cancellations.indexOf('Cancelled Gym') < cancellations.indexOf('Cancelled Yoga'))
  assert.equal(items[0], session, 'Rendering preserves the source array and session data')
})

test('room grid shows completed labels for ended and explicitly completed sessions while future sessions remain scheduled', () => {
  const now = Date.parse('2026-10-21T12:30:00Z')
  const items = [
    session,
    { ...session, id: 2, className: 'Future Yoga', startsAt: '2026-10-22T11:00:00Z', endsAt: '2026-10-22T12:30:00Z' },
    { ...session, id: 3, className: 'Completed Yoga', status: undefined, Status: ' COMPLETED ' },
  ]
  const { timetable } = sections(render(items, { now }))
  assert.equal((timetable.match(/<small>Đã hoàn thành<\/small>/g) || []).length, 2)
  assert.equal((timetable.match(/<small>Đã lên lịch<\/small>/g) || []).length, 1)
  assert.match(timetable, /3 buổi tuần này · 3 buổi tổng cộng/)
  assert.equal(session.status, 'Scheduled')
})

test('a week containing only cancelled sessions shows an empty grid and retains cancelled details separately', () => {
  const { timetable, cancellations } = sections(render([{ ...session, status: undefined, Status: 'Cancelled' }]))
  assert.match(timetable, /Không có buổi học trong tuần này/)
  assert.match(timetable, /0 buổi tuần này · 0 buổi tổng cộng/)
  assert.doesNotMatch(timetable, /Scheduled Yoga/)
  assert.match(cancellations, /Scheduled Yoga/)
  assert.match(cancellations, /Xem chi tiết/)
})

test('rooms with no cancellations expose a separate empty state without removing scheduled sessions', () => {
  const { timetable, cancellations } = sections(render([session]))
  assert.match(timetable, /Scheduled Yoga/)
  assert.match(timetable, /1 buổi tuần này · 1 buổi tổng cộng/)
  assert.match(cancellations, /0 buổi/)
  assert.match(cancellations, /Phòng chưa có buổi học nào bị hủy/)
})

test('an empty selected week points to remaining sessions in other weeks after a cancellation', () => {
  const items = [
    { ...session, className: 'Cancelled Yoga', status: 'Cancelled' },
    ...Array.from({ length: 12 }, (_, index) => ({
      ...session, id: index + 2, startsAt: '2026-10-26T11:00:00Z', endsAt: '2026-10-26T12:30:00Z',
    })),
  ]
  const { timetable, cancellations } = sections(render(items))
  assert.match(timetable, /0 buổi tuần này · 12 buổi tổng cộng/)
  assert.match(timetable, /Phòng còn 12 buổi học ở các tuần khác/)
  assert.match(timetable, /Xem tuần từ 26\/10\/2026/)
  assert.match(cancellations, /Cancelled Yoga/)
  const nextWeek = sections(render(items, { weekStart: '2026-10-26' })).timetable
  assert.match(nextWeek, /12 buổi tuần này · 12 buổi tổng cộng/)
  assert.equal((nextWeek.match(/<strong><svg[^]*?Scheduled Yoga<\/strong>/g) || []).length, 12)
  assert.doesNotMatch(nextWeek, /room-timetable-other-week|Cancelled Yoga/)
})

test('empty rooms and weeks already containing sessions do not offer an unrelated week', () => {
  for (const items of [[], [session], [{ ...session, status: 'Cancelled' }]]) {
    assert.doesNotMatch(render(items), /room-timetable-other-week/)
  }
})
