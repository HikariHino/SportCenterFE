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
const render = items => renderToStaticMarkup(createElement(RoomSessionTimetable, {
  items, weekStart: '2026-10-19', onWeekChange: () => {}, onSelect: () => {},
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
    { ...session, id: 4, className: 'Completed Yoga', status: 'Completed', startsAt: '2026-10-18T11:00:00Z', endsAt: '2026-10-18T12:30:00Z' },
  ]
  const { timetable, cancellations } = sections(render(items))
  assert.match(timetable, /Scheduled Yoga/)
  assert.doesNotMatch(timetable, /Cancelled Yoga|Cancelled Gym|is-cancelled/)
  assert.match(timetable, /1 buổi tuần này · 2 buổi tổng cộng/)
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
