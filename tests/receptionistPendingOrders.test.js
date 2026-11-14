import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { getReceptionistPendingCounterOrders } from '../src/utils/receptionistPayments.js'

let server, api, service, CounterOrders, Checkout
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, esbuild: { jsx: 'automatic' },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/receptionistPaymentService.js')
  CounterOrders = (await server.ssrLoadModule('/src/pages/Receptionist/PendingCounterOrders.jsx')).default
  Checkout = (await server.ssrLoadModule('/src/pages/Receptionist/CheckoutDialog.jsx')).default
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
const order = { id: 48, memberId: 9, packageId: 1, packageName: 'Gold All-Access', agreedPrice: 2000, durationInDays: 180, status: 'Pending', payments: [], createdAt: '2026-11-14T10:00:00Z' }
const member = { memberId: 9, fullName: 'Nguyễn Văn An', phone: '0912345678', email: 'an@example.com' }
const response = (config, data) => ({ config, data: { success: true, data }, status: 200, headers: {} })
const failure = status => Object.assign(new Error('Could not load'), { response: { status, data: { message: 'Could not load' } } })

test('counter-choice order appears with no payment record and never creates a placeholder transaction', async () => {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push([config.method, config.url])
    assert.equal(config.timeout, 15000)
    return response(config, config.url === '/members' ? [member] : [order])
  }
  const result = await service.getReceptionistPendingOrders()
  assert.deepEqual(result.failedMembers, [])
  assert.deepEqual(calls, [['get', '/members'], ['get', '/member-subscriptions/members/9']])
  assert.equal(result.orders[0].memberName, member.fullName)
  const visible = getReceptionistPendingCounterOrders(result.orders, [], { status: 'pending', method: 'cash' })
  assert.equal(visible[0].id, 48)
  assert.equal(visible[0].blockedReason, '')
  assert.equal(visible[0].paymentMethod, undefined)
  assert.equal(visible[0].amountReceived, undefined)
})

test('a later refresh discovers new orders and removes activated or cancelled orders across member sessions', async () => {
  let orders = []
  api.defaults.adapter = async config => response(config, config.url === '/members' ? [member] : orders)
  assert.equal((await service.getReceptionistPendingOrders()).orders.length, 0)
  orders = [order]
  assert.equal((await service.getReceptionistPendingOrders()).orders.length, 1)
  for (const status of ['Active', 'Cancelled', 'Expired', 'Upgraded']) {
    orders = [{ ...order, status }]
    assert.equal((await service.getReceptionistPendingOrders()).orders.length, 0)
  }
})

test('pending orders respect status/search filters and remain visible for each counter method', () => {
  const orders = [{ ...order, memberName: member.fullName, memberPhone: member.phone, memberEmail: member.email }]
  for (const method of ['all', 'cash', 'banktransfer', 'creditcard']) assert.equal(getReceptionistPendingCounterOrders(orders, [], { method, status: 'pending' }).length, 1)
  for (const query of ['#SUB-48', 'Gold', 'Nguyễn Văn An', '0912345678', 'an@example.com']) assert.equal(getReceptionistPendingCounterOrders(orders, [], { query }).length, 1)
  for (const status of ['completed', 'cancelled', 'expired', 'failed', 'needsreview', 'refunded']) assert.equal(getReceptionistPendingCounterOrders(orders, [], { status }).length, 0)
  assert.equal(getReceptionistPendingCounterOrders(orders, [], { method: 'payos' }).length, 0)
  assert.equal(getReceptionistPendingCounterOrders(orders, [], { query: 'no-match' }).length, 0)
})

test('active PayOS and completed receipts prevent a second counter collection using either data source', () => {
  for (const status of ['Pending', 'Completed']) {
    const receipt = { id: 5, subscriptionId: 48, status, paymentMethod: 'PayOS', amountReceived: 0 }
    assert.equal(getReceptionistPendingCounterOrders([order], [receipt]).length, 0)
    assert.equal(getReceptionistPendingCounterOrders([{ ...order, payments: [receipt] }], []).length, 0)
  }
  for (const status of ['Cancelled', 'Expired', 'Failed']) {
    assert.equal(getReceptionistPendingCounterOrders([{ ...order, payments: [{ status, paymentMethod: 'PayOS', amountReceived: 0 }] }], []).length, 1)
  }
})

test('uncertain receipts, missing history and invalid prices show a blocked row instead of a collect action', () => {
  for (const changes of [{ payments: undefined }, { agreedPrice: 0 }, { payments: [{ status: 'NeedsReview' }] },
    { payments: [{ status: 'Pending', paymentMethod: 'Cash' }] }, { payments: [{ status: 'Unknown' }] },
    { payments: [{ status: 'Failed', amountReceived: 100 }] }]) {
    const [row] = getReceptionistPendingCounterOrders([{ ...order, ...changes }], [])
    assert.ok(row.blockedReason)
  }
})

test('all members including inactive accounts are queried with at most four concurrent requests and duplicate IDs are not scanned twice', async () => {
  const members = Array.from({ length: 11 }, (_, i) => ({ memberId: i + 1, fullName: 'Member ' + (i + 1), isActive: i % 2 === 0 }))
  let active = 0, peak = 0, calls = 0
  api.defaults.adapter = async config => {
    if (config.url === '/members') return response(config, [...members, members[0]])
    active++; calls++; peak = Math.max(peak, active)
    await new Promise(resolve => setImmediate(resolve))
    active--
    const id = Number(config.url.split('/').at(-1))
    return response(config, [{ ...order, id: 48 + id, memberId: id }])
  }
  const result = await service.getReceptionistPendingOrders()
  assert.equal(calls, 11)
  assert.ok(peak <= 4)
  assert.equal(result.orders.length, 11)
})

test('partial failures and wrong-member responses are reported without claiming an empty successful queue', async () => {
  api.defaults.adapter = async config => {
    if (config.url === '/members') return response(config, [member, { memberId: 10 }, { memberId: 11 }])
    if (config.url.endsWith('/10')) throw failure(503)
    if (config.url.endsWith('/11')) return response(config, [order])
    return response(config, [order])
  }
  const result = await service.getReceptionistPendingOrders()
  assert.deepEqual(result.failedMembers.sort(), [10, 11])
  assert.deepEqual(result.orders.map(item => item.id), [48])
  api.defaults.adapter = async config => response(config, { items: [] })
  await assert.rejects(service.getReceptionistPendingOrders(), /không hợp lệ/)
})

test('access denial fails the load and cancellation stops scheduling further member scans', async () => {
  api.defaults.adapter = async config => {
    if (config.url === '/members') return response(config, [member])
    throw failure(403)
  }
  await assert.rejects(service.getReceptionistPendingOrders(), error => error.response?.status === 403)
  const controller = new AbortController()
  let scans = 0
  api.defaults.adapter = async config => {
    if (config.url === '/members') return response(config, Array.from({ length: 10 }, (_, i) => ({ memberId: i + 1 })))
    scans++
    controller.abort()
    return response(config, [])
  }
  await assert.rejects(service.getReceptionistPendingOrders({ signal: controller.signal }))
  assert.ok(scans <= 4)
})

test('the counter table renders order identity, member details and one direct collect button; blocked orders have no collect button', () => {
  const rows = getReceptionistPendingCounterOrders([{ ...order, memberName: member.fullName, memberPhone: member.phone }])
  const render = props => renderToStaticMarkup(createElement(CounterOrders, { orders: rows, onRefresh() {}, onCollect() {}, ...props }))
  const html = render({})
  for (const label of ['#SUB-48', 'Gold All-Access', 'Nguyễn Văn An', '0912345678', 'Thu tiền đơn đăng ký 48']) assert.ok(html.includes(label), label)
  assert.doesNotMatch(render({ orders: [{ ...rows[0], blockedReason: 'Cần đối soát' }] }), /aria-label="Thu tiền/)
  assert.match(render({ disabled: true }), /disabled=""/)
  assert.match(render({ orders: [], error: 'Không tải được đơn' }), /role="alert"/)
})

test('direct checkout locks the chosen order and honors the selected counter payment method', () => {
  for (const initialPaymentMethod of ['Cash', 'BankTransfer', 'CreditCard']) {
    const html = renderToStaticMarkup(createElement(Checkout, { memberId: 9, subscriptionId: 48, counterOnly: true, initialPaymentMethod, onClose() {}, onCreated() {} }))
    assert.ok(html.includes('value="' + initialPaymentMethod + '" selected=""'))
    assert.match(html, /type="checkbox" required=""/)
    assert.doesNotMatch(html, /value="PayOS"/)
  }
})
