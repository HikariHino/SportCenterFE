import assert from 'node:assert/strict'
import { test } from 'node:test'
import { roomSessionForTimetable } from '../src/utils/roomTimetable.js'

const rooms = [{ id: 1, name: 'Studio Yoga 01' }, { id: 2, name: 'Phòng Gym Đa năng' }]
const yogaClass = { id: 10, className: 'Yoga cơ bản', roomId: 1, coachId: 5, coachName: 'Nguyễn Minh Anh', sportName: 'Yoga' }
const session = { id: 100, startsAt: '2026-10-19T09:00:00+07:00', endsAt: '2026-10-19T10:30:00+07:00', status: 'Scheduled' }

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
