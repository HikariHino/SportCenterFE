import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

let window, server, api, createRoot, Workspace, Activity, useCache, Payments, cache
let records, subscriptions, failPayments, failOrders, writes, receipts
const descriptors = new Map()
const member = { memberId: 9, fullName: 'Nguyễn Văn An', phone: '0912345678', email: 'an@example.com' }
const order = (id, overrides = {}) => ({ id, memberId: 9, status: 'Pending', agreedPrice: 2000, payments: [], packageName: 'Gold', durationInDays: 180, createdAt: '2026-11-14T10:00:00Z', ...overrides })
const payment = (id, overrides = {}) => ({ id, subscriptionId: 99, memberId: 9, amount: 2000, paymentMethod: 'Cash', status: 'Completed', createdAt: '2026-11-17T10:00:00Z', ...overrides })

before(async () => {
  window = new Window({ url: 'http://localhost:3000/receptionist' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator, HTMLElement: window.HTMLElement,
    localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    const response = data => ({ data: { success: true, data }, status: 200, headers: {}, config })
    if (config.method === 'post') {
      writes.push(config)
      const id = Number(config.url.match(/member-subscriptions\/(\d+)\/payments/)?.[1])
      assert.ok(id)
      const input = JSON.parse(config.data)
      const receipt = payment(90, { subscriptionId: id, amount: input.amount, paymentMethod: input.paymentMethod })
      records.unshift(receipt)
      subscriptions = subscriptions.map(item => item.id === id ? { ...item, status: 'Active', payments: [receipt] } : item)
      receipts++
      return response(receipt)
    }
    if (config.url === '/members') { if (failOrders) throw new Error('Không tải được đơn chờ'); return response([member]) }
    if (config.url === '/payments') { if (failPayments) throw new Error('Không tải được giao dịch'); return response(records.map(item => ({ ...item }))) }
    if (/^\/payments\/\d+$/.test(config.url)) return response(records.find(item => config.url === `/payments/${item.id}`))
    if (config.url === '/member-subscriptions/members/9') return response(subscriptions.map(item => ({ ...item })))
    if (/^\/member-subscriptions\/\d+$/.test(config.url)) return response(subscriptions.find(item => config.url === `/member-subscriptions/${item.id}`))
    assert.fail('Unexpected request: ' + config.url)
  }
  Payments = (await server.ssrLoadModule('/src/pages/Receptionist/PaymentsView.jsx')).PaymentsView
  const context = await server.ssrLoadModule('/src/contexts/ReceptionistWorkspaceContext.jsx')
  Workspace = context.ReceptionistWorkspaceProvider; Activity = context.ReceptionistViewActivity; useCache = context.useReceptionistCache
  createRoot = (await import('react-dom/client')).createRoot
})
after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(initialOrders, initialPayments, run) {
  subscriptions = initialOrders; records = initialPayments; writes = []; receipts = 0; failPayments = failOrders = false
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  function Capture({ query = '', active = true }) {
    cache = useCache()
    return h(Activity, { active }, h(Payments, { query, showNotice() {} }))
  }
  const render = async props => act(async () => root.render(h(Workspace, { sessionKey: 'reception-payment-test' }, h(Capture, props))))
  try { await render(); await run(render) }
  finally { await act(async () => root.unmount()); container.remove() }
}
const tableRows = () => [...document.querySelectorAll('.reception-payment-record')]
const click = selector => act(async () => { const button = document.querySelector(selector); assert.ok(button, selector); button.click() })
const select = (label, value) => act(async () => {
  const input = [...document.querySelectorAll('label')].find(node => node.firstChild?.textContent === label)?.querySelector('select')
  assert.ok(input, label); input.value = value; input.dispatchEvent(new window.Event('change', { bubbles: true }))
})
const refresh = () => click('.reception-table-tools button')

test('pending orders and history share one table and one fixed pager, with pending rows first', () => screen([order(48), order(22)], [payment(45), payment(44, { paymentMethod: 'PayOS' })], async () => {
  assert.equal(document.querySelectorAll('.reception-payment-table-scroll').length, 1)
  assert.equal(document.querySelectorAll('.reception-pagination').length, 1)
  assert.equal(document.querySelector('.reception-pagination').parentElement.className, 'reception-paged-table')
  assert.equal(document.querySelector('.reception-pagination').closest('.reception-table-scroll'), null)
  assert.deepEqual(tableRows().map(row => row.dataset.orderId || row.dataset.paymentId), ['48', '22', '45', '44'])
  assert.match(tableRows()[0].textContent, /#SUB-48/)
  assert.match(tableRows()[0].textContent, /Nguyễn Văn An/)
  assert.equal(document.querySelectorAll('[aria-label^="Thu tiền đơn"]').length, 2)
  assert.equal(document.querySelectorAll('[aria-label^="Xem thanh toán"]').length, 2)
  assert.doesNotMatch(document.body.textContent, /Đơn chờ thanh toán tại quầy|Làm mới đơn chờ/)
}))

test('ten shared rows per page preserve order and payment identities and reset pagination when filtering', () => screen(
  Array.from({ length: 12 }, (_, i) => order(i + 1)), Array.from({ length: 11 }, (_, i) => payment(i + 101)), async () => {
    assert.equal(tableRows().length, 10)
    assert.equal(document.querySelectorAll('[data-order-id]').length, 10)
    await click('[aria-label="Trang sau: Thanh toán"]')
    assert.equal(tableRows().length, 10)
    assert.deepEqual(tableRows().slice(0, 2).map(row => row.dataset.orderId), ['2', '1'])
    assert.equal(tableRows()[2].dataset.paymentId, '111')
    assert.equal(tableRows()[0].dataset.stt, '11')
    await select('Phương thức', 'payos')
    assert.equal(tableRows().length, 0)
    await select('Phương thức', 'cash')
    assert.equal(tableRows().length, 10)
    assert.equal(tableRows()[0].dataset.stt, '1')
  }))

test('status, method and subscription searches apply to the combined dataset', () => screen([order(48)], [payment(45), payment(44, { status: 'Pending', paymentMethod: 'PayOS' })], async render => {
  await select('Trạng thái', 'pending')
  assert.deepEqual(tableRows().map(row => row.dataset.orderId || row.dataset.paymentId), ['44', '48'])
  await select('Phương thức', 'payos')
  assert.deepEqual(tableRows().map(row => row.dataset.paymentId), ['44'])
  await select('Trạng thái', 'all'); await select('Phương thức', 'all')
  await render({ query: '#SUB-48' })
  assert.equal(tableRows().length, 1)
  assert.equal(tableRows()[0].dataset.orderId, '48')
}))

test('counter collection uses the selected order, records one receipt and replaces its pending row', () => screen([order(48)], [payment(45)], async () => {
  await click('[aria-label="Thu tiền đơn đăng ký 48"]')
  const dialog = document.querySelector('.reception-checkout-dialog')
  const choices = dialog.querySelectorAll('select')
  assert.equal(choices[0].value, '9')
  assert.equal(choices[1].value, '48')
  assert.equal(choices[1].disabled, true)
  await click('.reception-payment-confirm input')
  await act(async () => {
    for (let i = 0; i < 2; i++) dialog.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
  })
  assert.equal(receipts, 1)
  assert.equal(writes[0].url, '/member-subscriptions/48/payments')
  assert.equal(JSON.parse(writes[0].data).paymentReceived, true)
  assert.equal(document.querySelector('[data-order-id="48"]'), null)
  assert.ok(document.querySelector('[data-payment-id="90"]'))
  assert.match(document.querySelector('.reception-payment-detail-dialog').textContent, /Giao dịch #90/)
}))

test('a real receipt opens its own details and active receipts never expose another collect action', () => screen([order(48)], [payment(7, { subscriptionId: 48, status: 'NeedsReview' })], async () => {
  assert.equal(tableRows().length, 1)
  assert.equal(document.querySelector('[aria-label^="Thu tiền đơn"]'), null)
  await click('[aria-label="Xem thanh toán 7"]')
  assert.match(document.querySelector('.reception-payment-detail-dialog').textContent, /Giao dịch #7/)
  assert.equal(writes.length, 0)
}))

test('errors from either source keep rows visible, disable collection, and use one refresh control', () => screen([order(48)], [payment(45)], async () => {
  for (const source of ['payments', 'orders']) {
    failPayments = source === 'payments'; failOrders = source === 'orders'
    await refresh()
    assert.ok(document.querySelector('[role=alert]'))
    assert.equal(tableRows().length, 2)
    assert.equal(document.querySelector('[aria-label="Thu tiền đơn đăng ký 48"]').disabled, true)
    failPayments = failOrders = false
    await refresh()
    assert.equal(document.querySelector('[aria-label="Thu tiền đơn đăng ký 48"]').disabled, false)
  }
}))

test('blocked history stays visible without a collect button and updates when background data arrives', () => screen([order(48, { payments: undefined })], [], async () => {
  assert.equal(tableRows().length, 1)
  assert.match(tableRows()[0].textContent, /Chưa tải đủ biên nhận/)
  assert.equal(document.querySelector('[aria-label^="Thu tiền đơn"]'), null)
  await act(async () => {
    cache.setData('pending-orders', { orders: [{ ...order(48), memberName: member.fullName }], failedMembers: [] })
    cache.setData('payments', [payment(8, { subscriptionId: 48, status: 'Pending', paymentMethod: 'PayOS' })])
  })
  assert.equal(tableRows().length, 1)
  assert.equal(tableRows()[0].dataset.paymentId, '8')
  assert.equal(document.querySelector('[aria-label^="Thu tiền đơn"]'), null)
}))
