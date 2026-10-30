import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { counterOrderCancellationReason } from '../src/utils/counterOrders.js'

let server, Dialog
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom', logLevel: 'error' })
  Dialog = (await server.ssrLoadModule('/src/components/CounterOrderCancellationDialog.jsx')).default
})
after(async () => { await server?.close() })

const order = { id: 20, memberId: 5, packageName: 'Standard 3 tháng', agreedPrice: 800000, status: 'Pending', payments: [] }
const payment = { id: 30, paymentMethod: 'PayOS', status: 'Pending', amountReceived: 0 }
const render = subscription => renderToStaticMarkup(createElement(Dialog, { subscription, onClose: () => {}, onCancelled: () => {} }))

test('unpaid counter orders and open or previously closed PayOS attempts expose cancellation', () => {
  assert.equal(counterOrderCancellationReason(order), '')
  assert.equal(counterOrderCancellationReason({ ...order, payments: undefined }), '')
  for (const status of ['Pending', 'Cancelled', 'Expired', 'Failed']) {
    assert.equal(counterOrderCancellationReason({ ...order, payments: [{ ...payment, status }] }), '')
  }
})

test('paid cash, card and transfer receipts block cancellation even when the order list still says Pending', () => {
  for (const paymentMethod of ['Cash', 'CreditCard', 'BankTransfer', 'PayOS']) {
    assert.match(counterOrderCancellationReason({ ...order, payments: [{ ...payment, paymentMethod, status: 'Completed' }] }), /Đơn đã thanh toán/)
  }
  assert.match(counterOrderCancellationReason(order, { ...payment, status: 'Completed' }), /Đơn đã thanh toán/)
})

test('review, received money and nonpending orders do not expose a cancellation action', () => {
  for (const item of [{ ...payment, status: 'NeedsReview' }, { ...payment, amountReceived: 500 }]) {
    assert.match(counterOrderCancellationReason({ ...order, payments: [item] }), /đối soát/)
    assert.match(counterOrderCancellationReason(order, item), /đối soát/)
  }
  for (const status of ['Active', 'Expired', 'Cancelled', 'Upgraded', 'Unknown']) {
    assert.ok(counterOrderCancellationReason({ ...order, status }))
  }
})

test('counter cancellation confirmation identifies the chosen order and explains pending-link closure', () => {
  const html = render(order)
  assert.match(html, /ĐƠN CHỜ THANH TOÁN #20/)
  assert.match(html, /Standard 3 tháng/)
  assert.match(html, /800\.000 đ/)
  assert.match(html, /<dd>#5<\/dd>/)
  assert.match(html, /chưa thu tiền/)
  assert.match(html, /đóng liên kết trước khi hủy đơn/)
  assert.match(html, /Gói đang sử dụng.*giữ nguyên/)
  assert.match(html, /type="submit" class="danger">/)
})

test('a stale or manually opened confirmation cannot submit an already paid order', () => {
  const html = render({ ...order, payments: [{ ...payment, paymentMethod: 'Cash', status: 'Completed' }] })
  assert.match(html, /Đơn đã thanh toán/)
  assert.match(html, /type="submit" class="danger" disabled=""/)
})
