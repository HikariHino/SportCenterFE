import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getReceptionistPaymentRows } from '../src/utils/receptionistPayments.js'

const order = (id, overrides = {}) => ({ id, memberId: 9, status: 'Pending', agreedPrice: 2000, payments: [],
  memberName: 'Nguyễn Văn An', memberPhone: '0912345678', memberEmail: 'an@example.com', packageName: 'Gold', createdAt: '2026-11-14T10:00:00Z', ...overrides })
const payment = (id, overrides = {}) => ({ id, subscriptionId: 48, memberId: 9, amount: 2000, paymentMethod: 'Cash', status: 'Completed', createdAt: '2026-11-17T10:00:00Z', ...overrides })

test('one list sorts pending orders and real pending receipts first, then newest dates within each group', () => {
  const rows = getReceptionistPaymentRows([order(22), order(48, { createdAt: '2026-11-15T10:00:00Z' })], [
    payment(45, { subscriptionId: 99 }), payment(44, { status: 'Pending', paymentMethod: 'PayOS', subscriptionId: 98 }),
    payment(43, { status: 'Failed', subscriptionId: 97, createdAt: '2026-11-16T10:00:00Z' }),
  ])
  assert.deepEqual(rows.map(row => row.key), ['payment:44', 'order:48', 'order:22', 'payment:45', 'payment:43'])
})

test('payment and subscription IDs stay distinct and a pending order never gains a fake receipt or method', () => {
  const source = order(48), receipt = payment(48, { subscriptionId: 99 })
  const rows = getReceptionistPaymentRows([source], [receipt])
  assert.deepEqual(rows.map(row => row.key), ['order:48', 'payment:48'])
  assert.equal(rows[0].payment, undefined)
  assert.equal(rows[0].order.paymentMethod, undefined)
  assert.equal(rows[1].payment.id, 48)
  assert.equal(source.blockedReason, undefined)
  assert.equal(receipt.memberName, undefined)
})

test('an order represented by an active receipt is not offered as a second collection', () => {
  for (const status of ['Pending', 'Completed', 'NeedsReview', 'Refunded', 'Unknown']) {
    const rows = getReceptionistPaymentRows([order(48)], [payment(7, { status })])
    assert.deepEqual(rows.map(row => row.key), ['payment:7'])
  }
  const rows = getReceptionistPaymentRows([order(48)], [payment(7, { status: 'Failed', amountReceived: 100 })])
  assert.deepEqual(rows.map(row => row.key), ['payment:7'])
})

test('cancelled, failed and expired attempts remain history while the same unpaid order can be collected', () => {
  for (const status of ['Cancelled', 'Failed', 'Expired']) {
    const rows = getReceptionistPaymentRows([order(48)], [payment(7, { status })])
    assert.deepEqual(rows.map(row => row.key), ['order:48', 'payment:7'])
    assert.equal(rows[0].order.blockedReason, '')
  }
})

test('both sources respect shared status, method, subscription and member search filters', () => {
  const orders = [order(48)], payments = [payment(7, { status: 'Failed' }), payment(8, { subscriptionId: 99, paymentMethod: 'PayOS' })]
  for (const query of ['#SUB-48', 'Gold', 'Nguyễn Văn An', '0912345678', 'an@example.com']) {
    assert.deepEqual(getReceptionistPaymentRows(orders, payments, { query }).map(row => row.key), ['order:48', 'payment:7'])
  }
  assert.deepEqual(getReceptionistPaymentRows(orders, payments, { query: '#PAY-7' }).map(row => row.key), ['payment:7'])
  assert.deepEqual(getReceptionistPaymentRows(orders, payments, { status: 'pending' }).map(row => row.key), ['order:48'])
  assert.deepEqual(getReceptionistPaymentRows(orders, payments, { status: 'completed' }).map(row => row.key), ['payment:8'])
  assert.deepEqual(getReceptionistPaymentRows(orders, payments, { method: 'payos' }).map(row => row.key), ['payment:8'])
  assert.deepEqual(getReceptionistPaymentRows(orders, payments, { method: 'cash' }).map(row => row.key), ['order:48', 'payment:7'])
})

test('missing receipt history and review evidence keep an unpaid order blocked in the shared list', () => {
  for (const overrides of [{ payments: undefined }, { payments: [{ status: 'NeedsReview' }] }, { agreedPrice: 0 }]) {
    const [row] = getReceptionistPaymentRows([order(48, overrides)], [])
    assert.ok(row.order.blockedReason)
  }
})
