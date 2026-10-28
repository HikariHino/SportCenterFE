import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterMemberPayments, paymentReceivedAmount, paymentStatus, paymentStatusLabel, paymentSummary } from '../src/utils/memberPayments.js'

const rows = [
  { id: 1, status: 'Completed', amount: 2000, amountReceived: 2000, subscriptionId: 13, transactionReference: 'BANK-ABC' },
  { id: 2, status: 'Pending', amount: 1000, amountReceived: 0, subscriptionId: 15, payOSOrderCode: 90202 },
  { id: 3, status: 'Cancelled', amount: 3000 }, { id: 4, status: 'Expired', amount: 3000 },
  { id: 5, status: 'Failed', amount: 3000 }, { id: 6, status: 'Refunded', amount: 3000 },
  { id: 7, status: 'NeedsReview', amount: 4000, amountReceived: 500 },
]
test('payment labels cover review and refund without treating them as completed', () => {
  assert.equal(paymentStatus({ status: ' needs_review ' }), 'needsreview')
  assert.equal(paymentStatus({ status: 'Canceled' }), 'cancelled')
  assert.equal(paymentStatusLabel({ status: 'NeedsReview' }), 'Cần đối soát')
  assert.equal(paymentStatusLabel({ status: 'Refunded' }), 'Đã hoàn tiền')
  assert.equal(paymentStatusLabel({ status: 'FutureStatus' }), 'FutureStatus')
})
test('summary totals only completed transactions and groups all closed statuses consistently', () => {
  assert.deepEqual(paymentSummary(rows), { total: 7, completed: 1, pending: 1, review: 1, closed: 4, paid: 2000 })
  assert.deepEqual(filterMemberPayments(rows, '', 'closed').map(row => row.id), [3, 4, 5, 6])
  for (const status of ['cancelled', 'expired', 'failed', 'refunded', 'needsreview']) assert.equal(filterMemberPayments(rows, '', status).length, 1)
})
test('search trims whitespace and matches internal IDs, subscription IDs, bank references and PayOS codes', () => {
  for (const search of [' #PAY-1 ', '#SUB-13', ' bank-abc ']) assert.deepEqual(filterMemberPayments(rows, search).map(row => row.id), [1])
  assert.deepEqual(filterMemberPayments(rows, '90202').map(row => row.id), [2])
  assert.deepEqual(filterMemberPayments(rows, 'BANK-ABC', 'pending'), [])
  assert.deepEqual(filterMemberPayments(rows, 'not-found'), [])
  assert.equal(filterMemberPayments(rows, '   ').length, 7)
})
test('received amounts retain existing fallback behavior and empty histories have zero totals', () => {
  assert.equal(paymentReceivedAmount({ amount: 1000, amountReceived: 1200 }), 1200)
  assert.equal(paymentReceivedAmount({ amount: 0, amountReceived: 0 }), 0)
  assert.equal(paymentReceivedAmount({ amount: 1000, amountReceived: null }), 1000)
  assert.deepEqual(paymentSummary([]), { total: 0, completed: 0, pending: 0, review: 0, closed: 0, paid: 0 })
})
