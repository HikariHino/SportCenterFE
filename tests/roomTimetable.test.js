import assert from 'node:assert/strict'
import { test } from 'node:test'
import { roomSessionForTimetable, roomSessionStatusLabel } from '../src/utils/roomTimetable.js'

const rooms = [{ id: 1, name: 'Studio Yoga 01' }, { id: 2, name: 'Phòng Gym Đa năng' }]
const yogaClass = { id: 10, className: 'Yoga cơ bản', roomId: 1, coachId: 5, coachName: 'Nguyễn Minh Anh', sportName: 'Yoga' }
const session = { id: 100, startsAt: '2026-10-19T09:00:00+07:00', endsAt: '2026-10-19T10:30:00+07:00', status: 'Scheduled' }

test('room session status becomes completed at the end time, including sessions across midnight', () => {
  const end = Date.parse(session.endsAt)
  assert.equal(roomSessionStatusLabel(session, Date.parse(session.startsAt) - 1), 'Đã lên lịch')
  assert.equal(roomSessionStatusLabel(session, end - 1), 'Đã lên lịch')
  assert.equal(roomSessionStatusLabel(session, end), 'Đã hoàn thành')
  assert.equal(roomSessionStatusLabel(session, end + 1), 'Đã hoàn thành')
  const overnight = { ...session, startsAt: '2026-10-19T23:00:00+07:00', endsAt: '2026-10-20T01:00:00+07:00' }
  assert.equal(roomSessionStatusLabel(overnight, Date.parse('2026-10-20T00:00:00+07:00')), 'Đã lên lịch')
  assert.equal(roomSessionStatusLabel(overnight, Date.parse(overnight.endsAt)), 'Đã hoàn thành')
  assert.equal(session.status, 'Scheduled')
})

test('room session status preserves cancellations, recognizes explicit completion and handles missing end times', () => {
  const now = Date.parse(session.endsAt) + 1
  for (const status of ['Cancelled', ' CANCELED ']) {
    assert.equal(roomSessionStatusLabel({ ...session, status }, now), 'Đã hủy')
  }
  assert.equal(roomSessionStatusLabel({ ...session, status: undefined, Status: 'Cancelled' }, now), 'Đã hủy')
  assert.equal(roomSessionStatusLabel({ ...session, status: 'Completed' }, 0), 'Đã hoàn thành')
  assert.equal(roomSessionStatusLabel({ ...session, status: undefined, Status: ' COMPLETED ' }, 0), 'Đã hoàn thành')
  for (const endsAt of [undefined, null, '', 'invalid']) {
    assert.equal(roomSessionStatusLabel({ ...session, endsAt }, now), 'Đã lên lịch')
  }
})

test('sessions inherit the default room and metadata from their class', () => {
  const result = roomSessionForTimetable(session, yogaClass, rooms, rooms[0])
  assert.equal(result.roomId, 1)
  assert.equal(result.roomName, rooms[0].name)
  assert.equal(result.className, yogaClass.className)
  assert.equal(result.coachName, yogaClass.coachName)
  assert.equal(roomSessionForTimetable(session, yogaClass, rooms, rooms[1]), null)
})

test('moved sessions appear only in the assigned room, even when IDs are strings', () => {
  const moved = { ...session, roomId: '2' }
  assert.equal(roomSessionForTimetable(moved, yogaClass, rooms, rooms[0]), null)
  assert.equal(roomSessionForTimetable(moved, yogaClass, rooms, rooms[1]).id, 100)
  assert.equal(roomSessionForTimetable({ ...moved, roomName: rooms[0].name }, yogaClass, rooms, rooms[0]), null)
  assert.equal(roomSessionForTimetable({ ...session, roomId: 999 }, yogaClass, rooms, rooms[0]), null)
})

test('session room names override the default and do not fall back when unrecognized', () => {
  assert.equal(roomSessionForTimetable({ ...session, roomName: ' PHÒNG GYM ĐA NĂNG ' }, yogaClass, rooms, rooms[1]).roomId, 2)
  assert.equal(roomSessionForTimetable({ ...session, roomName: 'Phòng khác' }, yogaClass, rooms, rooms[0]), null)
})

test('legacy class schedules resolve their room without inventing sessions', () => {
  const legacyClass = { ...yogaClass, roomId: null, schedule: '[Phòng: Studio Yoga 01] Thứ 2, 4, 6 · 09:00-10:30' }
  assert.equal(roomSessionForTimetable(session, legacyClass, rooms, rooms[0]).roomId, 1)
  assert.equal(roomSessionForTimetable(session, { id: 10 }, rooms, rooms[0]), null)
})

test('cancellations and session overrides are preserved and an unknown replacement coach is not mislabeled', () => {
  const result = roomSessionForTimetable({ ...session, status: 'Cancelled', cancellationReason: 'Bảo trì', coachId: 6 }, yogaClass, rooms, rooms[0])
  assert.equal(result.status, 'Cancelled')
  assert.equal(result.cancellationReason, 'Bảo trì')
  assert.equal(result.coachName, undefined)
  const named = roomSessionForTimetable({ ...session, coachId: 6, coachName: 'Trần Văn Nam' }, yogaClass, rooms, rooms[0])
  assert.equal(named.coachName, 'Trần Văn Nam')
})
