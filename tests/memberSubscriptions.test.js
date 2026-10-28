import assert from 'node:assert/strict'
import { test } from 'node:test'
import { membershipPackageType, mergeConfirmedSubscriptionCancellations, packageRegistrationReason, subscriptionDisplayStatusLabel, subscriptionPackageReason, subscriptionPaymentState, subscriptionRegistrationReason, subscriptionStatus, subscriptionStatusLabel } from '../src/utils/memberSubscriptions.js'

const now = Date.parse('2026-10-24T06:00:00Z')
const standard = { id: 1, packageName: 'Standard 1 tháng', price: 300000, durationInDays: 30 }
const quarterly = { id: 2, packageName: 'Standard 3 tháng', price: 800000, durationInDays: 90 }
const pt = { id: 3, packageName: 'PT 1-1', price: 1500000, durationInDays: 30 }
const active = { id: 10, packageId: 1, packageName: standard.packageName, agreedPrice: 300000, status: 'Active', startDate: '2026-10-20T00:00:00Z', endDate: '2026-11-19T00:00:00Z' }
const catalog = [standard, quarterly, pt]

test('active Standard allows a higher-value upgrade and an independent PT card', () => {
  assert.equal(subscriptionRegistrationReason([active], now), '')
  assert.equal(subscriptionPackageReason(quarterly, [active], catalog, now), '')
  assert.equal(subscriptionPackageReason(pt, [active], catalog, now), '')
  assert.match(subscriptionPackageReason(standard, [active], catalog, now), /cao hơn/)
  assert.match(subscriptionPackageReason({ ...quarterly, price: 250000, durationInDays: 120 }, [active], catalog, now), /cao hơn/)
})
test('a pending order blocks only its exact package rather than all other packages', () => {
  const pending = { packageId: quarterly.id, status: 'Pending' }
  assert.match(subscriptionPackageReason(quarterly, [active, pending], catalog, now), /chờ thanh toán/)
  assert.equal(subscriptionPackageReason(pt, [active, pending], catalog, now), '')
  assert.equal(subscriptionPackageReason({ ...quarterly, id: 4 }, [active, pending], catalog, now), '')
})

test('PT cards remain independent and the same active PT package cannot be bought twice', () => {
  const activePt = { ...active, id: 20, packageId: 3, packageName: pt.packageName, agreedPrice: pt.price }
  assert.equal(subscriptionPackageReason(standard, [activePt], catalog, now), '')
  assert.match(subscriptionPackageReason(pt, [active, activePt], catalog, now), /PT này/)
  assert.equal(subscriptionPackageReason({ ...pt, id: 4 }, [active, activePt], catalog, now), '')
})

test('package classification follows BE name and description rules exactly', () => {
  for (const pkg of [{ packageName: 'Gói PT tháng' }, { description: 'Huấn luyện viên cá nhân' }, { description: 'Tập 1-1' }, { description: 'pt cơ bản' }]) assert.equal(membershipPackageType(pkg), 'PT')
  for (const pkg of [{ packageName: 'Standard 3 tháng' }, { packageName: '1-1', description: 'Gym' }, {}]) assert.equal(membershipPackageType(pkg), 'Standard')
})
test('empty, expired and cancelled histories allow a new registration', () => {
  for (const rows of [[], [{ status: 'Expired' }], [{ status: 'Cancelled' }], [{ status: 'Canceled' }], [{ status: 'Upgraded' }], [{ status: 'Active', endDate: '2026-10-23' }]]) assert.equal(subscriptionRegistrationReason(rows, now), '')
  assert.equal(subscriptionStatus({ status: 'Active', endDate: '2026-10-23' }, now), 'expired')
  assert.equal(subscriptionStatusLabel({ status: 'Pending' }), 'Chờ thanh toán')
  assert.equal(subscriptionStatusLabel({ status: 'Canceled' }), 'Đã hủy')
  assert.equal(subscriptionStatusLabel({ status: 'Upgraded' }), 'Đã nâng cấp')
  assert.equal(subscriptionStatus({ status: 'Active', endDate: new Date(now).toISOString() }, now), 'expired')
  assert.equal(subscriptionStatus({ status: 'Active', endDate: null }, now), 'active')
})
test('unverified data and paused packages cannot enable registration', () => {
  for (const rows of [null, undefined, {}, { items: [] }]) assert.ok(subscriptionRegistrationReason(rows, now))
  for (const rows of [[{}], [null], [{ status: 'Unknown' }]]) assert.ok(subscriptionRegistrationReason(rows, now))
  assert.ok(packageRegistrationReason({ id: 1, isActive: false }))
  assert.ok(packageRegistrationReason(null))
  assert.equal(packageRegistrationReason({ id: 1, isActive: true }), '')
})

test('cancelled gateway receipts are displayed separately from an actually cancelled order', () => {
  const sub = { id: 20, status: 'Pending', payments: [{ id: 30, status: 'Cancelled' }] }
  assert.equal(subscriptionStatus(sub), 'pending')
  assert.equal(subscriptionPaymentState(sub), 'cancelled')
  assert.equal(subscriptionDisplayStatusLabel(sub), 'Đã hủy thanh toán')
  assert.equal(subscriptionDisplayStatusLabel({ ...sub, status: 'Cancelled' }), 'Đã hủy')
})

test('other attempts, received payments and review records cannot be hidden by an older cancelled link', () => {
  const cancelled = { id: 30, status: 'Cancelled' }
  for (const [status, expected] of [['Pending', 'Chờ thanh toán'], ['Completed', 'Đã thanh toán · Chờ kích hoạt'], ['NeedsReview', 'Thanh toán cần đối soát']]) {
    assert.equal(subscriptionDisplayStatusLabel({ status: 'Pending', payments: [cancelled, { id: 31, status }] }), expected)
  }
  assert.equal(subscriptionPaymentState({ status: 'Pending', payments: [{ id: 32, status: 'Failed' }, cancelled] }), 'failed')
  assert.equal(subscriptionDisplayStatusLabel({ ...active, payments: [cancelled] }, now), 'Đang hiệu lực')
})

test('a delayed pending list response cannot undo a confirmed cancellation, without changing other orders', () => {
  const cancelled = { id: 20, status: 'Cancelled', packageId: 2, payments: [] }
  const known = new Map([['20', cancelled]])
  const rows = [{ id: 20, status: 'Pending' }, active, { id: 21, status: 'Pending' }]
  const merged = mergeConfirmedSubscriptionCancellations(rows, known)
  assert.equal(merged[0].status, 'Cancelled')
  assert.equal(merged[1], active)
  assert.equal(merged[2].status, 'Pending')
  assert.equal(rows[0].status, 'Pending')
  assert.equal(mergeConfirmedSubscriptionCancellations([{ id: 20, status: 'Active' }], known)[0].status, 'Active')
})
