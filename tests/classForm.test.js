import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildClassPayload, classDateInput, classFormValidationErrors } from '../src/utils/classForm.js'

const now = Date.parse('2026-10-19T10:00:00+07:00')
const valid = { className: ' Yoga ', sportId: '1', coachId: '5', maxCapacity: '20', price: '500000.25', startDate: '2026-10-19', endDate: '2026-11-19', isActive: true }

test('all required class fields reject empty values and whitespace before creating payloads', () => {
  const fields = ['className', 'sportId', 'coachId', 'maxCapacity', 'startDate', 'endDate']
  const empty = Object.fromEntries(fields.map(field => [field, '']))
  assert.deepEqual(Object.keys(classFormValidationErrors(empty, now)), fields)
  for (const field of fields) for (const value of ['', '   ', null, undefined]) {
    assert.ok(classFormValidationErrors({ ...valid, [field]: value }, now)[field])
    assert.throws(() => buildClassPayload({ ...valid, [field]: value }, now))
  }
  for (const maxCapacity of [0, -1, 1.5, 10001, true]) assert.ok(classFormValidationErrors({ ...valid, maxCapacity }, now).maxCapacity)
})

test('class payload includes course dates with the full final day in Vietnam time', () => {
  const result = buildClassPayload(valid, now)
  assert.equal(result.className, 'Yoga')
  assert.equal(Object.hasOwn(result, 'price'), false)
  assert.equal(result.startDate, '2026-10-19T00:00:00+07:00')
  assert.equal(result.endDate, '2026-11-19T23:59:59.999+07:00')
  assert.equal(result.coachId, 5)
})

test('missing dates, invalid calendars, reversed intervals and years before 2000 are rejected', () => {
  for (const overrides of [{ startDate: '' }, { endDate: '' }, { startDate: '2026-02-30' }, { endDate: '2026-02-30' }, { startDate: '1999-12-31' }, { startDate: '2026-12-01' }, { startDate: 'invalid' }]) {
    assert.throws(() => buildClassPayload({ ...valid, ...overrides }, now))
  }
  const minimum = buildClassPayload({ ...valid, startDate: '2000-01-01' }, now)
  assert.equal(minimum.startDate, '2000-01-01T00:00:00+07:00')
})

test('the exact backend end cutoff and identical timestamps are rejected', () => {
  const endDate = '2026-10-19T10:00:00+07:00'
  assert.throws(() => buildClassPayload({ ...valid, startDate: '2026-10-18', endDate }, now), /hiện tại/)
  assert.doesNotThrow(() => buildClassPayload({ ...valid, startDate: '2026-10-18', endDate }, now - 1))
  assert.throws(() => buildClassPayload({ ...valid, startDate: endDate, endDate }, now - 1), /sau ngày bắt đầu/)
  assert.doesNotThrow(() => buildClassPayload({ ...valid, startDate: '2026-10-19', endDate: '2026-10-19' }, now))
})

test('class writes omit the retired price field, including legacy data and forms without a fee', () => {
  for (const price of [undefined, '', 0, '500000.25', -1, 'invalid']) {
    assert.equal(Object.hasOwn(buildClassPayload({ ...valid, price }, now), 'price'), false)
  }
})

test('editing displays the Vietnam calendar date and requires correcting unset dates', () => {
  assert.equal(classDateInput('2026-10-18T18:00:00Z'), '2026-10-19')
  for (const value of [undefined, null, '', 'invalid', '0001-01-01T00:00:00Z', '1999-12-31T00:00:00Z']) assert.equal(classDateInput(value), '')
})

test('new classes reject previous Vietnam dates while allowing today and future dates', () => {
  const options = { allowPastStart: false }
  const midnight = Date.parse('2026-11-23T17:00:00Z') // 00:00 on Nov 24 in Vietnam
  const form = { ...valid, endDate: '2099-12-31' }
  assert.doesNotThrow(() => buildClassPayload({ ...form, startDate: '2026-11-23' }, midnight - 1, options))
  assert.throws(() => buildClassPayload({ ...form, startDate: '2026-11-23' }, midnight, options), error => Boolean(error.fieldErrors.startDate))
  assert.doesNotThrow(() => buildClassPayload({ ...form, startDate: '2026-11-24' }, midnight + 12 * 3600000, options))
  assert.doesNotThrow(() => buildClassPayload({ ...form, startDate: '2026-11-25' }, midnight, options))
  assert.throws(() => buildClassPayload({ ...form, startDate: '2026-11-23T16:59:59Z' }, midnight, options), /trước hôm nay/)
  assert.doesNotThrow(() => buildClassPayload({ ...form, startDate: '2026-11-23T17:00:00Z' }, midnight, options))
  // Editing an existing ongoing class must retain its historical start date.
  assert.doesNotThrow(() => buildClassPayload({ ...form, startDate: '2026-11-23' }, midnight))
})
