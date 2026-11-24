import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getRegistrationBirthDateError, registrationBirthDateLimit } from '../src/utils/authRegistrationValidation.js'

test('registration permits the exact sixteenth birthday and rejects one day younger', () => {
  const now = Date.parse('2026-11-24T10:00:00+07:00')
  assert.equal(registrationBirthDateLimit(now), '2010-11-24')
  for (const dob of ['2010-11-24', '2000-01-01', '2010-11-24T00:00:00.000Z']) assert.equal(getRegistrationBirthDateError(dob, now), '')
  for (const dob of ['2010-11-25', '2026-11-24']) assert.match(getRegistrationBirthDateError(dob, now), /đủ 16 tuổi/)
  for (const dob of ['', undefined, null, '2010-02-30', '1900-01-01', '1949-12-31', 'bad-date', '2027-01-01']) assert.ok(getRegistrationBirthDateError(dob, now))
})

test('the age cutoff uses the Vietnam date at midnight and handles leap birthdays', () => {
  assert.equal(getRegistrationBirthDateError('2010-11-25', Date.parse('2026-11-24T16:59:59Z')), 'Bạn chưa đủ 16 tuổi.')
  assert.equal(getRegistrationBirthDateError('2010-11-25', Date.parse('2026-11-24T17:00:00Z')), '')
  assert.ok(getRegistrationBirthDateError('2012-02-29', Date.parse('2028-02-28T12:00:00+07:00')))
  assert.equal(getRegistrationBirthDateError('2012-02-29', Date.parse('2028-02-29T00:00:00+07:00')), '')
  assert.equal(registrationBirthDateLimit(Date.parse('2116-02-29T12:00:00+07:00')), '2100-02-28')
})
