import assert from 'node:assert/strict'
import { test } from 'node:test'
import { packageRegistrationReason, subscriptionRegistrationReason, subscriptionStatus, subscriptionStatusLabel } from '../src/utils/memberSubscriptions.js'

const now = Date.parse('2026-10-24T06:00:00Z')
test('an active membership blocks every new package until it expires', () => {
  assert.match(subscriptionRegistrationReason([{ status: 'Active', endDate: '2027-04-17T00:00:00Z' }], now), /còn hiệu lực/)
  assert.match(subscriptionRegistrationReason([{ status: ' active ', startDate: '2026-11-01', endDate: '2027-04-17' }], now), /còn hiệu lực/)
  for (const endDate of [undefined, null, 'invalid']) assert.ok(subscriptionRegistrationReason([{ status: 'Active', endDate }], now))
  assert.ok(subscriptionRegistrationReason([{ status: 'Active', endDate: new Date(now).toISOString() }], now))
})
test('pending orders block new registration even if another order has expired or been cancelled', () => {
  assert.match(subscriptionRegistrationReason([{ status: 'Expired' }, { status: 'Pending' }, { status: 'Cancelled' }], now), /chờ thanh toán/)
  assert.match(subscriptionRegistrationReason([{ status: 'Active', endDate: '2027-04-17' }, { status: 'Pending' }], now), /còn hiệu lực/)
})
test('empty, expired and cancelled histories allow a new registration', () => {
  for (const rows of [[], [{ status: 'Expired' }], [{ status: 'Cancelled' }], [{ status: 'Canceled' }], [{ status: 'Active', endDate: '2026-10-23' }]]) assert.equal(subscriptionRegistrationReason(rows, now), '')
  assert.equal(subscriptionStatus({ status: 'Active', endDate: '2026-10-23' }, now), 'expired')
  assert.equal(subscriptionStatusLabel({ status: 'Pending' }), 'Chờ thanh toán')
  assert.equal(subscriptionStatusLabel({ status: 'Canceled' }), 'Đã hủy')
})
test('unverified data and paused packages cannot enable registration', () => {
  for (const rows of [null, undefined, {}, { items: [] }]) assert.ok(subscriptionRegistrationReason(rows, now))
  for (const rows of [[{}], [null], [{ status: 'Unknown' }]]) assert.ok(subscriptionRegistrationReason(rows, now))
  assert.ok(packageRegistrationReason({ id: 1, isActive: false }))
  assert.ok(packageRegistrationReason(null))
  assert.equal(packageRegistrationReason({ id: 1, isActive: true }), '')
})
