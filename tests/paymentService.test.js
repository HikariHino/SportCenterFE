import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, service
let token = 'member-session'
const storageDescriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    storageDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: name => name === 'token' ? token : null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/paymentService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of storageDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const pending = { id: 14, payOSOrderCode: 14, paymentMethod: 'PayOS', status: 'Pending', amount: 1000, amountReceived: 0 }
const completed = { ...pending, status: 'Completed', amountReceived: 1000, transactionReference: 'INV-14' }
const transient = () => Object.assign(new Error('Transient failure'), {
  response: { status: 400, data: { message: 'An exception has been raised that is likely due to a transient failure.' } },
})
const response = (config, data) => ({ data: { success: true, data }, status: 200, headers: {}, config })
const tick = () => new Promise(resolve => setImmediate(resolve))
async function runWithTimers(t, operation) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let finished = false
  const result = operation()
  result.then(() => { finished = true }, () => { finished = true })
  for (let step = 0; step < 100 && !finished; step += 1) {
    await tick()
    t.mock.timers.tick(5000)
  }
  assert.ok(finished, 'Verification has a bounded number of attempts')
  return result
}

test('concurrent sync calls share one POST, and completed or failed requests never remain cached', async () => {
  let calls = 0, release
  api.defaults.adapter = config => {
    calls += 1
    return new Promise(resolve => { release = () => resolve(response(config, completed)) })
  }
  const first = service.syncPayment(14)
  const second = service.syncPayment('14')
  assert.equal(first, second)
  await tick()
  assert.equal(calls, 1)
  release()
  assert.deepEqual(await first, completed)
  await second
  api.defaults.adapter = async () => { calls += 1; throw transient() }
  await assert.rejects(service.syncPayment(14), /Transient failure/)
  api.defaults.adapter = async config => { calls += 1; return response(config, completed) }
  assert.deepEqual(await service.syncPayment(14), completed)
  assert.equal(calls, 3)
})

test('StrictMode-style concurrent verification shares list, sync and readback when a webhook wins the race', async t => {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push(`${config.method} ${config.url}`)
    if (config.url === '/payments') return response(config, [pending])
    if (config.url.endsWith('/sync')) throw transient()
    return response(config, completed)
  }
  await runWithTimers(t, async () => {
    const first = service.verifyPaymentResult('14')
    const second = service.verifyPaymentResult('14')
    assert.equal(first, second)
    const results = await Promise.all([first, second])
    assert.ok(results.every(item => item.status === 'Completed'))
  })
  assert.deepEqual(calls, ['get /payments', 'post /payments/14/sync', 'get /payments/14'])
})

test('settled server records return without calling sync, while review can be reconciled again', async () => {
  for (const status of ['Completed', 'Cancelled', 'Expired', 'Failed']) {
    const calls = []
    api.defaults.adapter = async config => {
      calls.push(config.url)
      return response(config, [{ ...pending, status }])
    }
    assert.equal((await service.verifyPaymentResult('14')).status, status)
    assert.deepEqual(calls, ['/payments'])
  }
})

test('review records query PayOS again and can complete without creating another payment', async () => {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push(`${config.method} ${config.url}`)
    return response(config, config.url === '/payments' ? [{ ...pending, status: 'NeedsReview', amountReceived: 500 }] : completed)
  }
  assert.equal((await service.verifyPaymentResult('14')).status, 'Completed')
  assert.deepEqual(calls, ['get /payments', 'post /payments/14/sync'])
})

test('manual verification refreshes a closed payment and reports review if money arrived later', async () => {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push(config.url)
    return response(config, config.url === '/payments' ? [{ ...pending, status: 'Cancelled' }] : { ...pending, status: 'NeedsReview', amountReceived: 500 })
  }
  assert.equal((await service.verifyPaymentResult('14', { refresh: true })).status, 'NeedsReview')
  assert.deepEqual(calls, ['/payments', '/payments/14/sync'])
})

test('creation submits only the subscription ID and preserves the actual state returned by BE', async () => {
  for (const status of ['Pending', 'Completed', 'Cancelled', 'Expired', 'Failed', 'NeedsReview']) {
    const dto = { ...pending, subscriptionId: 20, status, checkoutUrl: 'https://pay.payos.vn/web/fixture' }
    api.defaults.adapter = async config => {
      assert.equal(config.method, 'post')
      assert.equal(config.url, '/payments')
      assert.deepEqual(JSON.parse(config.data), { subscriptionId: 20 })
      return response(config, dto)
    }
    assert.equal((await service.createPayment(20)).status, status)
  }
})

test('creation rejects mismatched records and malformed history rather than directing a member to another order', async () => {
  for (const dto of [null, { ...pending, subscriptionId: 99 }, { ...pending, subscriptionId: 20, paymentMethod: 'Cash' }, { ...pending, subscriptionId: 20, status: 'Unknown' }]) {
    api.defaults.adapter = async config => response(config, dto)
    await assert.rejects(service.createPayment(20), /không khớp/)
  }
  api.defaults.adapter = async config => response(config, { items: [] })
  await assert.rejects(service.getPayments(), /không hợp lệ/)
})

test('pending gateway state is checked again until the server confirms completion', async t => {
  let syncs = 0, reads = 0
  api.defaults.adapter = async config => {
    if (config.url === '/payments') return response(config, [pending])
    if (config.url.endsWith('/sync')) { syncs += 1; return response(config, pending) }
    reads += 1
    return response(config, reads === 2 ? completed : pending)
  }
  const result = await runWithTimers(t, () => service.verifyPaymentResult('14'))
  assert.equal(result.status, 'Completed')
  assert.equal(syncs, 2)
  assert.equal(reads, 2)
})

test('persistent temporary failures stay unconfirmed after three sequential attempts without creating a payment', async t => {
  const writes = []
  let reads = 0, active = 0, maxActive = 0
  api.defaults.adapter = async config => {
    if (config.url === '/payments') return response(config, [pending])
    if (config.method === 'post') {
      writes.push(config.url)
      active += 1
      maxActive = Math.max(maxActive, active)
      await tick()
      active -= 1
      throw transient()
    }
    reads += 1
    return response(config, pending)
  }
  assert.equal((await runWithTimers(t, () => service.verifyPaymentResult('14'))).status, 'Pending')
  assert.deepEqual(writes, Array(3).fill('/payments/14/sync'))
  assert.equal(reads, 3)
  assert.equal(maxActive, 1)
})

test('real business errors are propagated once, and a manual retry starts a fresh verification', async () => {
  const calls = []
  api.defaults.adapter = async config => {
    calls.push(config.url)
    if (config.url === '/payments') return response(config, [pending])
    throw Object.assign(new Error('Gateway mismatch'), { response: { status: 400, data: { message: 'Mã đơn không hợp lệ.' } } })
  }
  await assert.rejects(service.verifyPaymentResult('14'), /Gateway mismatch/)
  assert.deepEqual(calls, ['/payments', '/payments/14/sync'])
  api.defaults.adapter = async config => response(config, [completed])
  assert.equal((await service.verifyPaymentResult('14')).status, 'Completed')
})

test('missing order codes, unmatched orders and mismatched readback identities never confirm another payment', async t => {
  let calls = 0
  api.defaults.adapter = async config => { calls += 1; return response(config, []) }
  for (const orderCode of [null, '', 'PAID', '0', '-14', '14.5']) await assert.rejects(service.verifyPaymentResult(orderCode), /mã đơn/)
  assert.equal(calls, 0)
  await assert.rejects(service.verifyPaymentResult('14'), /Không tìm thấy/)
  for (const wrong of [{ ...completed, id: 99 }, { ...completed, payOSOrderCode: 99 }]) {
    api.defaults.adapter = async config => config.url === '/payments'
      ? response(config, [pending]) : response(config, wrong)
    await assert.rejects(service.verifyPaymentResult('14'), /không khớp/)
  }
  api.defaults.adapter = async config => {
    if (config.url === '/payments') return response(config, [pending])
    if (config.method === 'post') throw transient()
    return response(config, { ...completed, payOSOrderCode: 99 })
  }
  await assert.rejects(runWithTimers(t, () => service.verifyPaymentResult('14')), /không khớp/)
})

test('verification and sync deduplication are scoped to the current login session', async () => {
  let calls = 0
  const releases = []
  api.defaults.adapter = config => {
    calls += 1
    return new Promise(resolve => releases.push(() => resolve(response(config, config.url === '/payments' ? [completed] : completed))))
  }
  for (const operation of [() => service.verifyPaymentResult('14'), () => service.syncPayment(14)]) {
    token = 'member-a'
    const first = operation()
    await tick()
    token = 'member-b'
    const second = operation()
    await tick()
    assert.notEqual(first, second)
    releases.splice(0).forEach(release => release())
    await Promise.all([first, second])
  }
  assert.equal(calls, 4)
  token = 'member-session'
})

test('temporary error classification retries only transport and concurrency failures, not ordinary HTTP 400', () => {
  assert.equal(service.isTemporaryPaymentError(transient()), true)
  for (const status of [408, 409, 429, 500, 502, 503, 504]) assert.equal(service.isTemporaryPaymentError({ response: { status } }), true)
  assert.equal(service.isTemporaryPaymentError({ isAxiosError: true }), true)
  for (const status of [400, 401, 403, 404]) assert.equal(service.isTemporaryPaymentError({ response: { status, data: { message: 'Invalid payment' } } }), false)
  assert.equal(service.isTemporaryPaymentError(new Error('Invalid data')), false)
})
