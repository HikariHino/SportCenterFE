import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
const descriptors = new Map()
before(async () => {
  for (const name of ['localStorage', 'sessionStorage']) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/subscriptionCancellationService.js')
})
after(async () => {
  await server?.close()
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

const pendingPayment = { id: 30, subscriptionId: 20, paymentMethod: 'PayOS', status: 'Pending', amount: 1000, amountReceived: 0 }
const pendingOrder = { id: 20, packageId: 2, status: 'Pending', payments: [pendingPayment] }

function mockCancellation({ order = pendingOrder, cancelPaymentStatus = 'Cancelled', losePaymentResponse = false, loseOrderResponse = false, failOrder = false, ignoreOrderWrite = false, failPaymentId, wrongPayment = false, failRead = false } = {}) {
  const state = { order: structuredClone(order), payments: structuredClone(order.payments || []), calls: [], posts: [], failPaymentId }
  api.defaults.adapter = async config => {
    state.calls.push(config.method + ' ' + config.url)
    let data
    if (config.url === '/member-subscriptions/20' && config.method === 'get') {
      if (failRead) throw new Error('Không tải được đơn')
      data = { ...state.order, payments: Array.isArray(state.order.payments) ? state.payments : state.order.payments }
    } else if (/^\/payments\/\d+\/cancel$/.test(config.url)) {
      const id = Number(config.url.split('/')[2])
      state.posts.push(config.url)
      if (state.failPaymentId === id) throw new Error('Chưa hủy được link')
      const payment = state.payments.find(item => item.id === id)
      payment.status = cancelPaymentStatus
      if (cancelPaymentStatus === 'Completed' || cancelPaymentStatus === 'NeedsReview') payment.amountReceived = 1000
      data = wrongPayment ? { ...payment, id: 99 } : payment
      if (losePaymentResponse) throw new Error('Mất phản hồi hủy link')
    } else if (/^\/payments\/\d+$/.test(config.url) && config.method === 'get') {
      data = state.payments.find(item => item.id === Number(config.url.split('/')[2]))
    } else if (config.url === '/member-subscriptions/20/cancel') {
      state.posts.push(config.url)
      if (failOrder) throw new Error('Chưa hủy được đơn')
      assert.ok(state.payments.every(item => ['Cancelled', 'Expired', 'Failed'].includes(item.status)), 'Every unresolved gateway link must be closed before cancelling the order')
      if (!ignoreOrderWrite) state.order.status = 'Cancelled'
      data = { ...state.order, payments: state.payments }
      if (loseOrderResponse) throw new Error('Mất phản hồi hủy đơn')
    } else throw new Error('Unexpected request ' + config.method + ' ' + config.url)
    return { data: { success: true, data: structuredClone(data) }, status: 200, headers: {}, config }
  }
  return state
}

test('cancel order closes each pending gateway link before cancelling the subscription and returns the confirmed DTO', async () => {
  const state = mockCancellation({ order: { ...pendingOrder, payments: [pendingPayment, { ...pendingPayment, id: 31 }] } })
  const result = await service.cancelSubscriptionOrder(20)
  assert.deepEqual(state.posts, ['/payments/30/cancel', '/payments/31/cancel', '/member-subscriptions/20/cancel'])
  assert.equal(result.status, 'Cancelled')
  assert.equal(result.id, 20)
})

test('old orders whose links were already cancelled can finish cancellation without another gateway request', async () => {
  const state = mockCancellation({ order: { ...pendingOrder, payments: [{ ...pendingPayment, status: 'Cancelled' }] } })
  assert.equal((await service.cancelSubscriptionOrder(20)).status, 'Cancelled')
  assert.deepEqual(state.posts, ['/member-subscriptions/20/cancel'])
})

test('a verified PayOS return cancels its matching subscription without treating the URL as evidence', async () => {
  const state = mockCancellation({ order: { ...pendingOrder, payments: [{ ...pendingPayment, status: 'Cancelled' }] } })
  const result = await service.completeCancelledPaymentSubscription({ ...pendingPayment, status: 'Cancelled' })
  assert.equal(result.status, 'Cancelled')
  assert.deepEqual(state.posts, ['/member-subscriptions/20/cancel'])
  await assert.rejects(service.completeCancelledPaymentSubscription(pendingPayment), /chưa được xác nhận/)
  assert.equal(await service.completeCancelledPaymentSubscription({ ...pendingPayment, subscriptionId: null, status: 'Cancelled' }), null)
})

test('paid, review and active records stop cancellation before any write', async () => {
  for (const order of [
    { ...pendingOrder, status: 'Active' },
    { ...pendingOrder, payments: [pendingPayment, { ...pendingPayment, id: 31, status: 'Completed' }] },
    { ...pendingOrder, payments: [{ ...pendingPayment, status: 'NeedsReview' }] },
    { ...pendingOrder, payments: [{ ...pendingPayment, status: 'Pending', amountReceived: 500 }] },
    { ...pendingOrder, payments: [{ ...pendingPayment, status: 'Unknown' }] },
    { ...pendingOrder, payments: null },
  ]) {
    const state = mockCancellation({ order })
    await assert.rejects(service.cancelSubscriptionOrder(20))
    assert.deepEqual(state.posts, [])
  }
})

test('if payment wins the race or the gateway cannot close the link, the subscription is never cancelled', async () => {
  for (const cancelPaymentStatus of ['Completed', 'NeedsReview', 'Pending']) {
    const state = mockCancellation({ cancelPaymentStatus })
    await assert.rejects(service.cancelSubscriptionOrder(20))
    assert.deepEqual(state.posts, ['/payments/30/cancel'])
    assert.equal(state.order.status, 'Pending')
  }
  const wrong = mockCancellation({ wrongPayment: true })
  await assert.rejects(service.cancelSubscriptionOrder(20), /không khớp/)
  assert.ok(!wrong.posts.includes('/member-subscriptions/20/cancel'))
})

test('lost gateway and subscription responses are read back before deciding the cancellation failed', async () => {
  for (const options of [{ losePaymentResponse: true }, { loseOrderResponse: true }]) {
    const state = mockCancellation(options)
    assert.equal((await service.cancelSubscriptionOrder(20)).status, 'Cancelled')
    assert.equal(state.posts.filter(item => item === '/member-subscriptions/20/cancel').length, 1)
  }
})

test('partial link cancellation can be retried without cancelling a confirmed link again', async () => {
  const state = mockCancellation({ order: { ...pendingOrder, payments: [pendingPayment, { ...pendingPayment, id: 31 }] }, failPaymentId: 31 })
  await assert.rejects(service.cancelSubscriptionOrder(20), /Chưa hủy được link/)
  assert.equal(state.order.status, 'Pending')
  state.failPaymentId = null
  assert.equal((await service.cancelSubscriptionOrder(20)).status, 'Cancelled')
  assert.deepEqual(state.posts, ['/payments/30/cancel', '/payments/31/cancel', '/payments/31/cancel', '/member-subscriptions/20/cancel'])
})

test('already cancelled orders and concurrent submissions do not create duplicate writes', async () => {
  const state = mockCancellation()
  const first = service.cancelSubscriptionOrder(20)
  const second = service.cancelSubscriptionOrder('20')
  assert.equal(first, second)
  await Promise.all([first, second])
  assert.equal(state.posts.filter(item => item === '/member-subscriptions/20/cancel').length, 1)
  await service.cancelSubscriptionOrder(20)
  assert.equal(state.posts.filter(item => item === '/member-subscriptions/20/cancel').length, 1)
})

test('read errors, failed cancellations and a success response still returning Pending never report Cancelled', async () => {
  for (const options of [{ failRead: true }, { failOrder: true }, { ignoreOrderWrite: true }]) {
    mockCancellation(options)
    await assert.rejects(service.cancelSubscriptionOrder(20))
  }
})

test('payment-page cancellation preserves its confirmed payment result if the order cannot be cancelled yet', async () => {
  const state = mockCancellation({ failOrder: true })
  await assert.rejects(service.cancelPaymentAndSubscription(pendingPayment), error => error.cancelledPayment?.status === 'Cancelled')
  assert.equal(state.order.status, 'Pending')
  assert.equal(state.payments[0].status, 'Cancelled')
})
