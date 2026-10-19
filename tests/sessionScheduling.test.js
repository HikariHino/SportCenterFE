import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertSessionSchedule } from '../src/utils/sessionScheduling.js'

const room = { id: 1, name: 'Gym', capacity: 25, isActive: true }
const otherRoom = { id: 2, name: 'Yoga', capacity: 20, isActive: true }
const sportClass = { id: 10, className: 'Gym Advanced', roomId: 1, maxCapacity: 20, coachId: 5, startDate: '2099-10-01', endDate: '2099-10-31', isActive: true }
const data = { startsAt: '2099-10-21T11:00:00Z', endsAt: '2099-10-21T12:30:00Z', coachId: 5, cancellationPolicyId: 1, capacity: 20 }
const check = options => assertSessionSchedule({ sportClass, room, rooms: [room, otherRoom], groups: [], data, ...options })

test('capacity is a positive integer bounded by both room and class, including current enrolment', () => {
  for (const capacity of [0, -1, 1.5, 21, 26, '', 'abc']) assert.throws(() => check({ data: { ...data, capacity } }), /Sức chứa/)
  assert.throws(() => check({ room: { ...room, capacity: 10 }, data: { ...data, capacity: 11 } }), /1 đến 10/)
  assert.throws(() => check({ room: { ...room, capacity: undefined } }), /Chưa xác nhận/)
  assert.throws(() => check({ data: { ...data, capacity: 10 }, current: { id: 100, ...data, status: 'Scheduled', currentEnrollment: 11 } }), /đã đăng ký/)
  check({ data: { ...data, capacity: 20 } })
})

test('identical, partial, contained and overnight room overlaps are blocked across classes', () => {
  const occupied = { id: 100, ...data, coachId: 9, status: 'Scheduled' }
  for (const overrides of [{}, { startsAt: '2099-10-21T12:00:00Z', endsAt: '2099-10-21T13:00:00Z' }, { startsAt: '2099-10-21T10:00:00Z', endsAt: '2099-10-21T14:00:00Z' }, { startsAt: '2099-10-20T16:00:00Z', endsAt: '2099-10-21T11:30:00Z' }]) {
    assert.throws(() => check({ groups: [{ sportClass: { ...sportClass, id: 20 }, items: [{ ...occupied, ...overrides }] }] }), /đã có/)
  }
})

test('different nonoverlapping times on the same date and matching times on different dates are allowed', () => {
  for (const overrides of [{ startsAt: data.endsAt, endsAt: '2099-10-21T13:30:00Z' }, { startsAt: '2099-10-21T10:00:00Z', endsAt: data.startsAt }, { startsAt: '2099-10-22T11:00:00Z', endsAt: '2099-10-22T12:30:00Z' }]) {
    check({ groups: [{ sportClass, items: [{ id: 100, ...data, ...overrides }] }] })
  }
})

test('cancelled records do not occupy the room, while an active replacement still blocks duplicates', () => {
  const cancelled = { id: 100, ...data, status: 'Cancelled' }
  check({ groups: [{ sportClass, items: [cancelled] }] })
  assert.throws(() => check({ groups: [{ sportClass, items: [cancelled, { id: 101, ...data, status: 'Scheduled' }] }] }), /đã có/)
})

test('other rooms can host concurrent classes, but a shared coach cannot be double booked', () => {
  const group = { sportClass: { ...sportClass, id: 20, roomId: 2, coachId: 9 }, items: [{ id: 100, ...data, coachId: 9 }] }
  check({ groups: [group] })
  assert.throws(() => check({ groups: [{ ...group, items: [{ ...group.items[0], coachId: 5 }] }] }), /Huấn luyện viên/)
})

test('updates exclude only the selected session and still reject another session in the same class', () => {
  const current = { id: 100, ...data, status: 'Scheduled', currentEnrollment: 0 }
  check({ current, data: { ...data, startsAt: '2099-10-21T11:30:00Z' }, groups: [{ sportClass, items: [current] }] })
  assert.throws(() => check({ current, groups: [{ sportClass, items: [current, { ...current, id: 101 }] }] }), /đã có/)
})

test('invalid intervals, out-of-course dates and inactive rooms or classes are rejected', () => {
  for (const overrides of [{ startsAt: 'invalid' }, { startsAt: data.endsAt }, { startsAt: '2000-01-01' }, { endsAt: '2099-11-01T12:30:00Z' }]) assert.throws(() => check({ data: { ...data, ...overrides } }))
  assert.throws(() => check({ room: { ...room, isActive: false } }))
  assert.throws(() => check({ sportClass: { ...sportClass, isActive: false } }))
})

test('registered sessions permit time and coach changes while retaining capacity validation', () => {
  const current = { id: 100, ...data, status: 'Scheduled', currentEnrollment: 1 }
  for (const proposed of [{ ...data, startsAt: '2099-10-21T11:30:00Z' }, { ...data, endsAt: '2099-10-21T13:00:00Z' }, { ...data, startsAt: '2099-10-22T11:00:00Z', endsAt: '2099-10-22T12:30:00Z' }]) check({ current, data: proposed })
  check({ current, data: { ...data, coachId: 9, capacity: 19 } })
  check({ current, data: { ...data, startsAt: '2099-10-21T18:00:00+07:00', endsAt: '2099-10-21T19:30:00+07:00' } })
})

test('capacity never drops below another supported counter when currentEnrollment is stale', () => {
  assert.throws(() => check({ data: { ...data, capacity: 5 }, current: { id: 100, ...data, status: 'Scheduled', currentEnrollment: 0, registeredCount: 6 } }), /6 học viên/)
})
