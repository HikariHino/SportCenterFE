import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, CheckoutDialog, PaymentsView
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, esbuild: { jsx: 'automatic' },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  CheckoutDialog = (await server.ssrLoadModule('/src/pages/Receptionist/CheckoutDialog.jsx')).default
  PaymentsView = (await server.ssrLoadModule('/src/pages/Receptionist/PaymentsView.jsx')).PaymentsView
})
after(async () => { await server?.close() })

test('checkout starts with member/order selection and disables submission until the current order is loaded', () => {
  const html = renderToStaticMarkup(createElement(CheckoutDialog, { onClose() {}, onCreated() {} }))
  assert.match(html, /Tên, mã, email hoặc số điện thoại/)
  assert.match(html, /Đơn đăng ký đang chờ/)
  assert.match(html, /value="PayOS" selected=""/)
  assert.match(html, /type="submit" disabled=""/)
  assert.doesNotMatch(html, /type="number"/)
})

test('counter checkout requires receipt consent and payment history exposes all gateway and counter filters', () => {
  const counter = renderToStaticMarkup(createElement(CheckoutDialog, { counterOnly: true, memberId: 9, subscriptionId: 28, onClose() {}, onCreated() {} }))
  assert.match(counter, /reception-nested-dialog/)
  assert.match(counter, /type="checkbox" required=""/)
  assert.match(counter, /Tôi đã thực nhận đủ tiền/)
  assert.doesNotMatch(counter, /value="PayOS"/)
  const history = renderToStaticMarkup(createElement(PaymentsView, { query: '', showNotice() {} }))
  for (const label of ['Lịch sử thanh toán', 'Làm mới', 'Hết hạn', 'Thất bại', 'Hoàn tiền', 'Tiền mặt', 'Chuyển khoản', 'Thẻ tín dụng']) assert.ok(history.includes(label), label)
})
