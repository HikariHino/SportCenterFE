import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildSessionReschedule, canRescheduleSession, sessionRescheduleDraft, sessionsOverlap } from '../src/utils/sessionReschedule.js'

const now = Date.parse('2026-10-19T10:00:00+07:00')
const session = { id: 100, status: 'Scheduled', startsAt: '2026-10-21T11:00:00Z', endsAt: '2026-10-21T12:30:00Z', classStartDate: '2026-10-18', classEndDate: '2026-11-14', coachId: 5, cancellationPolicyId: 7, capacity: 20, currentEnrollment: 0 }
const build = (draft, item = session) => buildSessionReschedule(item, draft, { now })

test('same-day and another-day drops preserve Vietnamese times unless a target time slot is supplied', () => {
  assert.deepEqual(sessionRescheduleDraft(session, { date: '2026-10-21' }), { date: '2026-10-21', startTime: '18:00', endTime: '19:30', endsNextDay: false, coachId: 5 })
  assert.deepEqual(sessionRescheduleDraft(session, { date: '2026-10-23' }), { date: '2026-10-23', startTime: '18:00', endTime: '19:30', endsNextDay: false, coachId: 5 })
  const draft = sessionRescheduleDraft(session, { date: '2026-10-23', startTime: '08:00', endTime: '09:00', nextDay: false })
  assert.equal(draft.startTime, '08:00')
  assert.equal(draft.endTime, '09:00')
})

test('rescheduling keeps coach, capacity and cancellation policy while converting to UTC', () => {
  const payload = build({ date: '2026-10-23', startTime: '18:30', endTime: '20:00' })
  assert.deepEqual(payload, { startsAt: '2026-10-23T11:30:00.000Z', endsAt: '2026-10-23T13:00:00.000Z', coachId: 5, cancellationPolicyId: 7, capacity: 20 })
})

test('only upcoming scheduled sessions can move, including the exact starting boundary', () => {
  assert.equal(canRescheduleSession(session, now), true)
  assert.equal(canRescheduleSession(session, Date.parse(session.startsAt)), false)
  for (const status of ['Cancelled', 'Canceled', 'Completed', 'InProgress']) assert.equal(canRescheduleSession({ ...session, status }, now), false)
  assert.equal(canRescheduleSession({ ...session, endsAt: 'invalid' }, now), false)
  assert.throws(() => build({ date: '2026-10-23', startTime: '18:00', endTime: '19:30' }, { ...session, status: 'Cancelled' }))
})

test('upcoming sessions can move with enrolled members or unknown enrolment', () => {
  for (const overrides of [{ currentEnrollment: 1 }, { currentEnrollment: 0, registeredCount: 1 }, { currentEnrollment: undefined }, { currentEnrollment: -1 }]) {
    const item = { ...session, ...overrides }
    assert.equal(canRescheduleSession(item, now), true)
    assert.equal(build({ date: '2026-10-23', startTime: '18:00', endTime: '19:30' }, item).startsAt, '2026-10-23T11:00:00.000Z')
  }
  assert.equal(canRescheduleSession({ ...session, currentEnrollment: '0' }, now), true)
})

test('a substitute coach changes only the selected coach in the session payload', () => {
  const payload = build({ ...sessionRescheduleDraft(session), coachId: '9' }, { ...session, currentEnrollment: 3 })
  assert.equal(payload.coachId, 9)
  assert.equal(Date.parse(payload.startsAt), Date.parse(session.startsAt))
  assert.equal(Date.parse(payload.endsAt), Date.parse(session.endsAt))
  assert.equal(payload.capacity, session.capacity)
  assert.throws(() => build({ ...sessionRescheduleDraft(session), coachId: '' }), /Thiếu thông tin/)
})

test('impossible dates, invalid times, backwards intervals and past target times are rejected', () => {
  const draft = { date: '2026-10-23', startTime: '18:00', endTime: '19:30' }
  for (const overrides of [{ date: '' }, { date: '2026-02-30' }, { startTime: '24:00' }, { endTime: '17:00' }, { endTime: '18:00' }, { date: '2026-10-19', startTime: '10:00', endTime: '11:00' }]) assert.throws(() => build({ ...draft, ...overrides }))
})

test('rescheduling respects inclusive course dates and precise saved ISO bounds', () => {
  const draft = { date: '2026-11-14', startTime: '18:00', endTime: '19:30' }
  assert.equal(build(draft).startsAt, '2026-11-14T11:00:00.000Z')
  assert.throws(() => build({ ...draft, date: '2026-11-15' }), /thời gian của lớp/)
  assert.throws(() => build(draft, { ...session, classEndDate: '2026-11-14T00:00:00Z' }), /thời gian của lớp/)
  assert.throws(() => build(draft, { ...session, classStartDate: null }), /Lớp chưa có/)
})

test('overnight sessions retain the following date and cannot extend beyond the course end', () => {
  const overnight = { ...session, startsAt: '2026-10-21T16:00:00Z', endsAt: '2026-10-21T18:00:00Z' }
  const draft = sessionRescheduleDraft(overnight, { date: '2026-10-23' })
  assert.equal(draft.endsNextDay, true)
  assert.equal(build(draft, overnight).endsAt, '2026-10-23T18:00:00.000Z')
  assert.throws(() => build({ ...draft, date: '2026-11-14' }, overnight), /thời gian của lớp/)
})

test('missing policy or capacity never silently switches to a different cancellation policy', () => {
  const draft = sessionRescheduleDraft(session, { date: '2026-10-23' })
  for (const overrides of [{ cancellationPolicyId: undefined }, { capacity: 0 }, { coachId: null }]) assert.throws(() => build({ ...draft, coachId: undefined }, { ...session, ...overrides }), /Thiếu thông tin/)
})

test('adjacent intervals do not conflict and overlapping intervals do', () => {
  assert.equal(sessionsOverlap(session, { startsAt: session.endsAt, endsAt: '2026-10-21T13:30:00Z' }), false)
  assert.equal(sessionsOverlap(session, { startsAt: '2026-10-21T12:00:00Z', endsAt: '2026-10-21T13:30:00Z' }), true)
})
