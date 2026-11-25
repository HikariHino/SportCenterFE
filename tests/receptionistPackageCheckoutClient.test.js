import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { act, createElement as h, StrictMode } from 'react'
import { Window } from 'happy-dom'
import { createServer } from 'vite'

let window, server, createRoot, Auth, Workspace, Payments, Result, Router, Routes, Route, useLocation, api, state
const descriptors = new Map()
const member = { memberId: 9, fullName: 'Nguyễn Văn An', phone: '0912345678' }
const packages = [
  { id: 1, packageName: 'Gói đang dùng', price: 300000 },
  { id: 2, packageName: 'Gói nâng cấp', price: 800000 },
  { id: 3, packageName: 'Gói thấp hơn', price: 100000 },
  { id: 4, packageName: 'Gói ngang giá', price: 300000 },
  { id: 5, packageName: 'PT riêng', price: 200000, packageType: 'PT' },
  { id: 6, packageName: 'Gói ngừng bán', price: 900000, isActive: false },
].map(pkg => ({ durationInDays: 90, isActive: true, packageType: 'Standard', ...pkg }))
const active = { id: 10, memberId: 9, packageId: 1, packageType: 'Standard', packageName: 'Gói đang dùng', status: 'Active',
  agreedPrice: 100000, startDate: '2020-01-01T00:00:00Z', endDate: '2099-01-01T00:00:00Z', payments: [] }
const receipt = (status = 'Pending') => ({ id: 90, memberId: 9, subscriptionId: 28, amount: 500000, amountReceived: status === 'Completed' ? 500000 : 0,
  paymentMethod: 'PayOS', status, payOSOrderCode: 1090, checkoutUrl: 'https://pay.payos.vn/web/test-payment', expiresAt: '2099-01-01T00:00:00Z' })

before(async () => {
  window = new Window({ url: 'http://localhost:3000/receptionist' })
  for (const [key, value] of Object.entries({ window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, localStorage: window.localStorage, sessionStorage: window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  window.location.assign = url => state.redirects.push(url)
  sessionStorage.setItem('token', 'receptionist-package-checkout-test')
  sessionStorage.setItem('user', JSON.stringify({ id: 3, fullName: 'Lễ Tân', role: 'receptionist' }))
  server = await createServer({ configFile: false, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ['react-router-dom', 'react-router'], resolve: { conditions: ['module-sync', 'module', 'import'] } },
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  Auth = (await server.ssrLoadModule('/src/contexts/AuthContext.jsx')).AuthProvider
  Workspace = (await server.ssrLoadModule('/src/contexts/ReceptionistWorkspaceContext.jsx')).ReceptionistWorkspaceProvider
  Payments = (await server.ssrLoadModule('/src/pages/Receptionist/PaymentsView.jsx')).PaymentsView
  Result = (await server.ssrLoadModule('/src/pages/member/PaymentResult.jsx')).default
  const router = await server.ssrLoadModule('react-router-dom')
  Router = router.MemoryRouter; Routes = router.Routes; Route = router.Route; useLocation = router.useLocation
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  api.defaults.adapter = async config => {
    const response = data => ({ data: { success: true, data: structuredClone(data) }, status: 200, headers: {}, config })
    state.calls.push({ method: config.method, url: config.url, data: config.data && JSON.parse(config.data) })
    if (config.url === '/members') return response([member])
    if (config.url === '/membership-packages') return response(state.packages)
    if (/^\/membership-packages\/\d+$/.test(config.url)) return response(state.packages.find(pkg => String(pkg.id) === config.url.split('/').at(-1)))
    if (config.url.endsWith('/upgrade-preview')) {
      return response({ canUpgrade: true, message: 'Thanh toán chênh lệch', currentSubscriptionId: 10, currentPackageName: 'Gói đang dùng', currentAgreedPrice: 100000,
        targetPackageId: 2, targetPackagePrice: 800000, discountAmount: 300000, amountToPay: state.amount,
        newStartDate: active.startDate, newEndDate: '2099-04-01T00:00:00Z' })
    }
    if (config.url === '/member-subscriptions/members/9') {
      if (config.method === 'post') {
        const order = { id: 28, memberId: 9, packageId: 2, packageType: 'Standard', packageName: 'Gói nâng cấp', status: 'Pending', agreedPrice: state.amount, durationInDays: 90, payments: [] }
        state.subscriptions.push(order)
        if (state.loseOrder) { state.loseOrder = false; throw Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }) }
        return response(order)
      }
      return response(state.wrongMember ? state.subscriptions.map(item => ({ ...item, memberId: 8 })) : state.subscriptions)
    }
    if (config.url === '/member-subscriptions/28') return response(state.subscriptions.find(item => item.id === 28))
    if (config.url === '/payments' && config.method === 'get') return response(state.staleHistory ? [receipt()] : state.payments)
    if (config.url === '/payments' && config.method === 'post') {
      if (state.failPayOS) throw Object.assign(new Error('PayOS unavailable'), { response: { status: 400, data: { message: 'PayOS chưa sẵn sàng' } } })
      const payment = receipt(); state.payments = [payment]; state.subscriptions.find(item => item.id === 28).payments = [payment]
      return response(payment)
    }
    if (config.url === '/member-subscriptions/28/payments') {
      const input = JSON.parse(config.data)
      const payment = { ...receipt('Completed'), paymentMethod: input.paymentMethod, amount: input.amount, amountReceived: input.amount }
      state.payments = [payment]; state.subscriptions.forEach(item => { item.status = item.id === 28 ? 'Active' : 'Upgraded' })
      state.subscriptions.find(item => item.id === 28).payments = [payment]
      return response(payment)
    }
    if (config.url === '/payments/90/sync') {
      state.payments = [receipt(state.syncStatus)]
      if (state.syncStatus === 'Completed') state.subscriptions = []
      return response(state.payments[0])
    }
    if (config.url === '/payments/90/cancel') {
      state.payments = [receipt('Cancelled')]
      return response(state.payments[0])
    }
    if (config.url === '/payments/90') return response(state.payments[0])
    throw new Error('Unexpected request ' + config.url)
  }
  createRoot = (await import('react-dom/client')).createRoot
})

after(async () => {
  await server?.close(); await window?.happyDOM.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

async function screen(run, route = '/receptionist?view=Thanh+to%C3%A1n', setup = () => {}) {
  state = { calls: [], redirects: [], packages: structuredClone(packages), subscriptions: [structuredClone(active)], payments: [], amount: 500000, syncStatus: 'Completed' }
  setup(state)
  const container = document.body.appendChild(document.createElement('div')), root = createRoot(container)
  function History() {
    const location = useLocation()
    return h(Workspace, { sessionKey: 'package-checkout' }, h(Payments, { query: '', showNotice() {}, paymentReturn: location.state?.receptionistPaymentReturn }))
  }
  try {
    await act(async () => root.render(h(StrictMode, null, h(Router, { initialEntries: [route] }, h(Auth, null,
      h(Routes, null, h(Route, { path: '/receptionist', element: h(History) }), h(Route, { path: '/payment/success', element: h(Result) }), h(Route, { path: '/payment/cancel', element: h(Result) })))))))
    await run(container)
  } finally { await act(async () => root.unmount()); container.remove() }
}
const click = selector => act(async () => { const button = document.querySelector(selector); assert.ok(button, selector); button.click() })
const choose = (selector, value) => act(async () => { const input = document.querySelector(selector); input.value = value; input.dispatchEvent(new window.Event('change', { bubbles: true })) })
const createCalls = () => state.calls.filter(call => call.method === 'post' && call.url === '/member-subscriptions/members/9')
const paymentCalls = () => state.calls.filter(call => call.method === 'post' && call.url === '/payments')
async function selectUpgrade() {
  await click('.reception-table-tools .reception-primary-button')
  await choose('.reception-checkout-fields select', '9')
  await click('[aria-label="Chọn gói Gói nâng cấp"]')
}
const submit = () => act(async () => { const form = document.querySelector('.reception-package-checkout-dialog form'); for (let i = 0; i < 2; i++) form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })) })

test('package tiles disable owned, lower, equal and inactive packages while allowing upgrades and independent PT', () => screen(async () => {
  await click('.reception-table-tools .reception-primary-button')
  assert.equal(document.querySelectorAll('.reception-checkout-package-grid > button').length, 6)
  assert.ok([...document.querySelectorAll('.reception-checkout-package-grid > button')].every(button => button.disabled))
  await choose('.reception-checkout-fields select', '9')
  for (const name of ['Gói đang dùng', 'Gói thấp hơn', 'Gói ngang giá', 'Gói ngừng bán']) assert.equal(document.querySelector(`[aria-label="Chọn gói ${name}"]`).disabled, true, name)
  for (const name of ['Gói nâng cấp', 'PT riêng']) assert.equal(document.querySelector(`[aria-label="Chọn gói ${name}"]`).disabled, false, name)
  assert.doesNotMatch(document.querySelector('.reception-package-checkout-dialog').textContent, /Đơn đăng ký đang chờ/)
  assert.equal(createCalls().length, 0)
  await choose('.reception-checkout-fields select', '')
  assert.equal(document.querySelectorAll('.reception-checkout-package-grid > button:disabled').length, 6)
  state.wrongMember = true
  await choose('.reception-checkout-fields select', '9')
  assert.equal(document.querySelectorAll('.reception-checkout-package-grid > button:disabled').length, 6)
  assert.match(document.querySelector('.reception-package-checkout-dialog [role=alert]').textContent, /không khớp hội viên/)
}))

test('PayOS creates one reviewed upgrade order and one payment, then redirects to the returned checkout URL', () => screen(async () => {
  await selectUpgrade()
  assert.match(document.querySelector('.reception-checkout-purchase').textContent, /500.000 đ/)
  await submit()
  assert.equal(createCalls().length, 1)
  assert.deepEqual(createCalls()[0].data, { packageId: 2 })
  assert.equal(paymentCalls().length, 1)
  assert.deepEqual(paymentCalls()[0].data, { subscriptionId: 28 })
  assert.deepEqual(state.redirects, ['https://pay.payos.vn/web/test-payment'])
}))

test('counter checkout waits for receipt consent, records the backend upgrade amount and updates history', () => screen(async () => {
  await selectUpgrade()
  await choose('.reception-checkout-method select', 'Cash')
  assert.equal(document.querySelector('.reception-package-checkout-dialog [type=submit]').disabled, true)
  await click('.reception-payment-confirm input')
  await submit()
  const payments = state.calls.filter(call => call.url === '/member-subscriptions/28/payments')
  assert.equal(payments.length, 1)
  assert.deepEqual(payments[0].data, { amount: 500000, paymentMethod: 'Cash', paymentReceived: true })
  assert.equal(document.querySelector('[data-order-id="28"]'), null)
  assert.ok(document.querySelector('[data-payment-id="90"]'))
  assert.deepEqual(state.redirects, [])
}))

const pendingCounterOrder = () => ({ id: 28, memberId: 9, packageId: 2, packageType: 'Standard', packageName: 'Gói nâng cấp', status: 'Pending', agreedPrice: 500000, durationInDays: 90, payments: [] })
const submitCounterOrder = () => act(async () => {
  const form = document.querySelector('.reception-checkout-dialog form')
  for (let count = 0; count < 2; count++) form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
})

test('bank transfer collection hides receipt consent and pays the existing order through PayOS once', () => screen(async () => {
  await click('[aria-label="Thu tiền đơn đăng ký 28"]')
  assert.ok(document.querySelector('.reception-payment-confirm'))
  const methods = '.reception-checkout-fields label:last-child select'
  assert.deepEqual([...document.querySelector(methods).options].map(option => [option.value, option.textContent]), [['PayOS', 'Banking'], ['Cash', 'Tiền mặt']])
  await choose(methods, 'PayOS')
  assert.equal(document.querySelector('.reception-payment-confirm'), null)
  const payButton = document.querySelector('.reception-checkout-dialog [type=submit]')
  assert.equal(payButton.textContent, 'Trả tiền')
  assert.equal(payButton.disabled, false)
  await submitCounterOrder()
  assert.equal(createCalls().length, 0, 'the existing order is reused')
  assert.equal(paymentCalls().length, 1)
  assert.deepEqual(paymentCalls()[0].data, { subscriptionId: 28 })
  assert.equal(state.calls.some(call => call.method === 'post' && call.url === '/member-subscriptions/28/payments'), false)
  assert.deepEqual(state.redirects, ['https://pay.payos.vn/web/test-payment'])
}, undefined, state => { state.subscriptions.push(pendingCounterOrder()) }))

test('switching from transfer back to cash restores receipt consent and prevents accidental cash collection', () => screen(async () => {
  await click('[aria-label="Thu tiền đơn đăng ký 28"]')
  const methods = '.reception-checkout-fields label:last-child select'
  await choose(methods, 'PayOS')
  await choose(methods, 'Cash')
  assert.ok(document.querySelector('.reception-payment-confirm'))
  assert.equal(document.querySelector('.reception-checkout-dialog [type=submit]').textContent, 'Xác nhận thu tiền')
  assert.equal(document.querySelector('.reception-checkout-dialog [type=submit]').disabled, true)
  await submitCounterOrder()
  assert.equal(paymentCalls().length, 0)
  assert.equal(state.calls.some(call => call.method === 'post'), false)
}, undefined, state => { state.subscriptions.push(pendingCounterOrder()) }))

test('a failed transfer payment keeps the existing order and retries only after refreshing', () => screen(async () => {
  await click('[aria-label="Thu tiền đơn đăng ký 28"]')
  await choose('.reception-checkout-fields label:last-child select', 'PayOS')
  state.failPayOS = true
  await submitCounterOrder()
  assert.ok(document.querySelector('.reception-checkout-dialog [role=alert]'))
  assert.equal(document.querySelector('.reception-checkout-dialog [type=submit]').disabled, true)
  assert.deepEqual(state.redirects, [])
  await click('.reception-checkout-dialog footer button')
  state.failPayOS = false
  await submitCounterOrder()
  assert.equal(paymentCalls().length, 2)
  assert.equal(createCalls().length, 0)
  assert.equal(state.redirects.length, 1)
}, undefined, state => { state.subscriptions.push(pendingCounterOrder()) }))

test('changed preview terms require another confirmation before an order is created', () => screen(async () => {
  await selectUpgrade(); state.amount = 600000
  await submit()
  assert.equal(createCalls().length, 0)
  assert.match(document.querySelector('.reception-package-checkout-dialog [role=alert]').textContent, /đã thay đổi/)
  assert.match(document.querySelector('.reception-checkout-purchase').textContent, /600.000 đ/)
  await submit()
  assert.equal(createCalls().length, 1)
}))

test('failed PayOS creation keeps the order and retries payment without creating a duplicate order', () => screen(async () => {
  await selectUpgrade(); state.failPayOS = true
  await submit()
  assert.equal(createCalls().length, 1)
  assert.equal(document.querySelector('.reception-package-checkout-dialog [type=submit]').disabled, true)
  await click('.reception-package-checkout-dialog footer button')
  state.failPayOS = false
  await submit()
  assert.equal(createCalls().length, 1)
  assert.equal(paymentCalls().length, 2)
  assert.equal(state.redirects.length, 1)
}))

test('a lost order response is recovered before continuing, without posting a second registration', () => screen(async () => {
  await selectUpgrade(); state.loseOrder = true
  await submit()
  assert.equal(createCalls().length, 1)
  assert.equal(paymentCalls().length, 0)
  await click('.reception-package-checkout-dialog footer button')
  await submit()
  assert.equal(createCalls().length, 1)
  assert.equal(paymentCalls().length, 1)
}))

test('a changed member subscription or newly higher active tier blocks writes at confirmation', () => screen(async () => {
  await selectUpgrade(); state.wrongMember = true
  await submit()
  assert.equal(createCalls().length, 0)
  assert.equal(paymentCalls().length, 0)
}))

test('verified PayOS completion returns to Receptionist history with success and current payment data', () => screen(async () => {
  assert.match(document.querySelector('.reception-payment-return').textContent, /Thanh toán thành công/)
  assert.ok(document.querySelector('[data-payment-id="90"]'))
  assert.equal(state.calls.filter(call => call.url === '/payments/90/sync').length, 1)
  assert.equal(createCalls().length, 0)
  assert.equal(paymentCalls().length, 0)
  const popup = document.querySelector('.reception-payment-success-dialog')
  assert.ok(popup?.open)
  assert.match(popup.textContent, /Thanh toán thành công/)
  assert.match(popup.textContent, /#PAY-90/)
  assert.match(popup.textContent, /500.000 đ/)
  await click('.reception-payment-success-done')
  assert.equal(document.querySelector('.reception-payment-success-dialog'), null)
  assert.ok(document.querySelector('[data-payment-id="90"]'))
}, '/payment/success?orderCode=1090&status=PAID', state => { state.payments = [receipt()] }))

test('a PAID query string cannot turn a cancelled backend transaction into a success message', () => screen(async () => {
  assert.match(document.querySelector('.reception-payment-return').textContent, /Giao dịch đã hủy/)
  assert.doesNotMatch(document.querySelector('.reception-payment-return').textContent, /Thanh toán thành công/)
  assert.equal(createCalls().length, 0)
  assert.equal(paymentCalls().length, 0)
  assert.equal(document.querySelector('.reception-payment-success-dialog'), null)
}, '/payment/success?orderCode=1090&status=PAID', state => { state.payments = [receipt('Cancelled')] }))

for (const staleHistory of [false, true]) test(`PayOS cancellation stays cancelled without a pending duplicate, stale history: ${staleHistory}`, () => screen(async () => {
  assert.match(document.querySelector('.reception-payment-return').textContent, /Giao dịch đã hủy/)
  assert.match(document.querySelector('[data-payment-id="90"]').textContent, /Giao dịch đã hủy/)
  assert.equal(document.querySelector('[data-order-id="28"]'), null)
  assert.equal(document.querySelector('[aria-label="Thanh toán lại đơn đăng ký 28"]'), null)
  assert.ok(document.querySelector('[aria-label="Xem thanh toán 90"]'))
  assert.equal(document.querySelector('.reception-payment-success-dialog'), null)
  assert.equal(state.calls.filter(call => call.url === '/payments/90/cancel').length, 1)
  assert.equal(paymentCalls().length, 0)
  assert.equal(createCalls().length, 0)
}, '/payment/cancel?orderCode=1090&cancel=true&status=CANCELLED', state => {
  state.staleHistory = staleHistory
  state.syncStatus = 'Pending'; state.payments = [receipt()]
  state.subscriptions.push({ ...active, id: 28, packageId: 2, status: 'Pending', agreedPrice: 500000, payments: [receipt()] })
}))
