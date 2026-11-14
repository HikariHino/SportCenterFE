import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { filterReceptionistPayments } from '../src/utils/receptionistPayments.js'

let server, api, service
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/receptionistPaymentService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const order = { id: 28, memberId: 9, status: 'Pending', agreedPrice: 4000, payments: [] }
const input = { subscriptionId: 28, memberId: 9, amount: 4000, paymentMethod: 'PayOS' }
const pending = { id: 90, subscriptionId: 28, memberId: 9, amount: 4000, amountReceived: 0, paymentMethod: 'PayOS', status: 'Pending', payOSOrderCode: 123, checkoutUrl: 'https://pay.payos.vn/web/fixture' }
const response = (config, data) => ({ config, status: 200, headers: {}, data: { success: true, data } })
const failure = (status, message) => Object.assign(new Error(message), { response: { status, data: { message } } })

test('all checkout methods reread the selected member/order and send only the BE payment contract', async () => {
  for (const paymentMethod of ['PayOS', 'Cash', 'BankTransfer', 'CreditCard']) {
    const calls = []
    api.defaults.adapter = async config => {
      calls.push({ url: config.url, method: config.method, data: config.data && JSON.parse(config.data) })
      return response(config, config.method === 'get' ? order : { ...pending, paymentMethod, status: paymentMethod === 'PayOS' ? 'Pending' : 'Completed' })
    }
    const result = await service.checkoutReceptionistSubscription({ ...input, paymentMethod, paymentReceived: true })
    assert.equal(result.paymentMethod, paymentMethod)
    assert.deepEqual(calls[0], { url: '/member-subscriptions/28', method: 'get', data: undefined })
    assert.deepEqual(calls[1], paymentMethod === 'PayOS'
      ? { url: '/payments', method: 'post', data: { subscriptionId: 28 } }
      : { url: '/member-subscriptions/28/payments', method: 'post', data: { amount: 4000, paymentMethod, paymentReceived: true } })
  }
})

test('invalid identifiers, amounts, methods and missing receipt confirmation never call the API', async () => {
  let calls = 0
  api.defaults.adapter = async config => { calls++; return response(config, order) }
  for (const patch of [{ memberId: 0 }, { subscriptionId: -1 }, { subscriptionId: 2147483648 }, { amount: 0 }, { amount: NaN }, { paymentMethod: 'Other' }, { paymentMethod: 'Cash', paymentReceived: false }]) {
    await assert.rejects(service.checkoutReceptionistSubscription({ ...input, ...patch }))
  }
  assert.equal(calls, 0)
})

test('stale orders, changed prices, missing receipts, received funds and pending counter payments block writes', async () => {
  for (const stale of [
    { ...order, id: 29 }, { ...order, memberId: 8 }, { ...order, status: 'Active' },
    { ...order, status: 'Cancelled' }, { ...order, agreedPrice: 5000 }, { ...order, payments: undefined },
    ...['Completed', 'NeedsReview', 'Refunded', 'Unknown'].map(status => ({ ...order, payments: [{ ...pending, status }] })),
    { ...order, payments: [{ ...pending, status: 'Failed', amountReceived: 1000 }] },
    { ...order, payments: [{ ...pending, paymentMethod: 'Cash' }] },
  ]) {
    const calls = []
    api.defaults.adapter = async config => { calls.push(config.method); return response(config, stale) }
    await assert.rejects(service.checkoutReceptionistSubscription(input))
    assert.deepEqual(calls, ['get'])
  }
  api.defaults.adapter = async config => response(config, { ...order, payments: [pending] })
  await assert.rejects(service.checkoutReceptionistSubscription({ ...input, paymentMethod: 'Cash', paymentReceived: true }), /đang có giao dịch/)
})

test('an existing PayOS request can be reused but cannot be converted into a counter receipt', async () => {
  const calls = []
  api.defaults.adapter = async config => { calls.push(config.url); return response(config, config.method === 'get' ? { ...order, payments: [pending] } : pending) }
  assert.equal((await service.checkoutReceptionistSubscription(input)).id, 90)
  assert.deepEqual(calls, ['/member-subscriptions/28', '/payments'])
})

test('concurrent checkout clicks share preflight and one payment write', async () => {
  let writes = 0, release
  api.defaults.adapter = config => config.method === 'get' ? Promise.resolve(response(config, order))
    : new Promise(resolve => { writes++; release = () => resolve(response(config, pending)) })
  const first = service.checkoutReceptionistSubscription(input)
  const second = service.checkoutReceptionistSubscription({ ...input, subscriptionId: '28' })
  assert.equal(first, second)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(writes, 1)
  release()
  assert.equal((await first).id, 90)
})

test('mismatched responses and lost payment responses require refreshing without retrying the write', async () => {
  for (const outcome of [{ ...pending, memberId: 10 }, { ...pending, amount: 5000 }, null, failure(503, 'Unavailable'), Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })]) {
    let writes = 0
    api.defaults.adapter = async config => {
      if (config.method === 'get') return response(config, order)
      writes++
      if (outcome instanceof Error) throw outcome
      return response(config, outcome)
    }
    await assert.rejects(service.checkoutReceptionistSubscription(input), error => error.requiresRefresh === true && /Chưa xác nhận/.test(error.message))
    assert.equal(writes, 1)
  }
})

test('PayOS configuration errors are actionable and private server details are hidden', async () => {
  api.defaults.adapter = async config => {
    if (config.method === 'get') return response(config, order)
    throw failure(400, "Key cannot be null or empty (Parameter 'key')")
  }
  await assert.rejects(service.checkoutReceptionistSubscription(input), /cấu hình.*PayOS/)
  assert.equal(service.getReceptionistPaymentError(failure(400, 'DbSet could not be translated'), 'Lỗi máy chủ'), 'Lỗi máy chủ')
  assert.equal(service.getReceptionistPaymentError(failure(403, 'Không có quyền thu tiền.')), 'Không có quyền thu tiền.')
})

test('sync verifies record identity and reads back after a temporary failure without creating a new payment', async () => {
  for (const status of ['Pending', 'Completed', 'NeedsReview']) {
    const calls = []
    api.defaults.adapter = async config => {
      calls.push(`${config.method} ${config.url}`)
      if (config.method === 'post') throw failure(503, 'Unavailable')
      return response(config, { ...pending, status })
    }
    const result = await service.syncReceptionistPayment(pending)
    assert.equal(result.payment.status, status)
    assert.equal(Boolean(result.warning), status !== 'Completed')
    assert.deepEqual(calls, ['post /payments/90/sync', 'get /payments/90'])
  }
  for (const patch of [{ id: 91 }, { memberId: 10 }, { subscriptionId: 29 }, { payOSOrderCode: 124 }, { paymentMethod: 'Cash' }, { amount: 5000 }, { status: 'Unknown' }]) {
    api.defaults.adapter = async config => response(config, { ...pending, ...patch })
    await assert.rejects(service.syncReceptionistPayment(pending), /không khớp/)
  }
})

test('real sync business errors remain failures and never trigger a second write', async () => {
  const calls = []
  api.defaults.adapter = async config => { calls.push(config.url); throw failure(400, 'Không tìm thấy giao dịch PayOS.') }
  await assert.rejects(service.syncReceptionistPayment(pending), /Không tìm thấy/)
  assert.deepEqual(calls, ['/payments/90/sync'])
})

test('checkout links are hidden for closed, review, received, expired or unsafe URLs', () => {
  const now = Date.parse('2026-11-14T08:00:00Z')
  assert.equal(service.receptionistCheckoutUrl(pending, now), pending.checkoutUrl)
  for (const patch of [{ status: 'Completed' }, { status: 'NeedsReview' }, { amountReceived: 1 }, { paymentMethod: 'Cash' }, { expiresAt: '2026-11-14T08:00:00Z' }, { expiresAt: 'invalid' }, { checkoutUrl: 'javascript:alert(1)' }, { checkoutUrl: 'https://user:password@example.com' }, { checkoutUrl: 'http://example.com' }]) {
    assert.equal(service.receptionistCheckoutUrl({ ...pending, ...patch }, now), '')
  }
})

test('Receptionist payment history filters every BE status and method, with newest records first', () => {
  const payments = ['Pending', 'Completed', 'Cancelled', 'Expired', 'Failed', 'NeedsReview', 'Refunded'].map((status, index) => ({ ...pending, id: index + 1, status, paymentMethod: index % 2 ? 'Cash' : 'PayOS' }))
  assert.deepEqual(filterReceptionistPayments(payments).map(item => item.id), [7, 6, 5, 4, 3, 2, 1])
  for (const payment of payments) assert.deepEqual(filterReceptionistPayments(payments, { status: payment.status.toLowerCase() }), [payment])
  assert.deepEqual(filterReceptionistPayments(payments, { method: 'cash' }).map(item => item.id), [6, 4, 2])
  assert.deepEqual(filterReceptionistPayments(payments, { query: '#7' }).map(item => item.id), [7])
  assert.equal(filterReceptionistPayments(payments, { query: 'missing' }).length, 0)
})
