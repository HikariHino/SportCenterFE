import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

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
  service = await server.ssrLoadModule('/src/services/memberSubscriptionService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const request = { amount: 4000, paymentMethod: 'Cash', paymentReceived: true }
const receipt = { id: 90, subscriptionId: 28, amount: 4000, paymentMethod: 'Cash', status: 'Completed', transactionReference: 'INV-90' }
const response = (config, data) => ({ data: { success: true, data }, status: 201, headers: {}, config })
const serverError = (status, message) => Object.assign(new Error(`Request failed with status code ${status}`), {
  response: { status, data: { success: false, message } },
})

test('cash, bank transfer and card send the existing BE contract and require a matching receipt', async () => {
  for (const paymentMethod of ['Cash', 'BankTransfer', 'CreditCard']) {
    const calls = []
    api.defaults.adapter = async config => {
      calls.push({ method: config.method, url: config.url, data: JSON.parse(config.data) })
      return response(config, { ...receipt, paymentMethod })
    }
    assert.equal((await service.confirmSubscriptionPayment(28, { ...request, amount: '4000', paymentMethod })).status, 'Completed')
    assert.deepEqual(calls, [{ method: 'post', url: '/member-subscriptions/28/payments', data: { ...request, paymentMethod } }])
  }
})

test('missing receipt consent, invalid amounts, methods or subscription IDs never send a payment', async () => {
  let calls = 0
  api.defaults.adapter = async config => { calls++; return response(config, receipt) }
  for (const changes of [
    { amount: 0 }, { amount: -1 }, { amount: NaN }, { amount: Infinity }, { amount: 'invalid' },
    { amount: 4000.001 }, { paymentMethod: 'PayOS' }, { paymentReceived: false },
    { paymentReceived: undefined }, { paymentReceived: 'true' },
  ]) await assert.rejects(service.confirmSubscriptionPayment(28, { ...request, ...changes }))
  for (const id of [0, -1, undefined, 'invalid', 1.5]) await assert.rejects(service.confirmSubscriptionPayment(id, request))
  await assert.rejects(service.confirmSubscriptionPayment(28))
  assert.equal(calls, 0)
})

test('the reported LINQ 400 is shown as a useful server error without leaking the query or reporting success', async () => {
  let calls = 0
  api.defaults.adapter = async () => {
    calls++
    throw serverError(400, "The LINQ expression 'DbSet<MemberSubscription>().Where(...) PackageTypeHelper.GetPackageType' could not be translated.")
  }
  await assert.rejects(service.confirmSubscriptionPayment(28, request), error => {
    assert.match(error.message, /Máy chủ gặp lỗi/)
    assert.match(error.message, /Chưa xác nhận/)
    assert.doesNotMatch(error.message, /LINQ|DbSet|PackageTypeHelper/)
    assert.equal(error.response, undefined)
    return true
  })
  assert.equal(calls, 1)
})

test('ordinary BE business errors remain actionable for both counter UIs', async () => {
  for (const [status, message] of [
    [400, 'Số tiền phải bằng giá đã chốt của đăng ký gói.'],
    [403, 'Chỉ lễ tân hoặc quản lý được xác nhận thu tiền.'],
    [409, 'Đăng ký gói đã được thanh toán.'],
    [409, 'Đăng ký gói còn giao dịch chờ xử lý hoặc cần đối soát.'],
  ]) {
    api.defaults.adapter = async () => { throw serverError(status, message) }
    await assert.rejects(service.confirmReceptionistSubscriptionPayment(28, request), error => error.message === message)
  }
})

test('application-level failures also hide technical server details', async () => {
  api.defaults.adapter = async config => ({ ...response(config, null), data: { success: false, message: 'DbSet<MemberSubscription> could not be translated' } })
  await assert.rejects(service.confirmSubscriptionPayment(28, request), /Máy chủ gặp lỗi/)
})

test('network and server failures do not retry POST or claim that no money was recorded', async () => {
  for (const error of [Object.assign(new Error('Network Error'), { isAxiosError: true }), serverError(500, 'Internal Server Error')]) {
    let calls = 0
    api.defaults.adapter = async () => { calls++; throw error }
    await assert.rejects(service.confirmSubscriptionPayment(28, request), /trạng thái gói và biên nhận.*không thu tiền lần nữa/)
    assert.equal(calls, 1)
  }
})

test('empty, mismatched or incomplete receipts never become a successful activation notice', async () => {
  for (const data of [null, {}, { ...receipt, id: 0 }, { ...receipt, subscriptionId: 99 },
    { ...receipt, amount: 5000 }, { ...receipt, status: 'Pending' }, { ...receipt, paymentMethod: 'PayOS' }]) {
    api.defaults.adapter = async config => response(config, data)
    await assert.rejects(service.confirmSubscriptionPayment(28, request), /Chưa xác nhận được kết quả thu tiền/)
  }
})

test('rapid double clicks share one in-flight POST and failures do not leave the action locked', async () => {
  let calls = 0, release
  api.defaults.adapter = config => {
    calls++
    return new Promise(resolve => { release = () => resolve(response(config, receipt)) })
  }
  const first = service.confirmSubscriptionPayment(28, request)
  const second = service.confirmSubscriptionPayment('28', request)
  assert.equal(first, second)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls, 1)
  release()
  assert.deepEqual(await first, receipt)
  api.defaults.adapter = async () => { throw serverError(409, 'Gói đã thanh toán.') }
  await assert.rejects(service.confirmSubscriptionPayment(28, request), /Gói đã thanh toán/)
  api.defaults.adapter = async config => response(config, receipt)
  assert.deepEqual(await service.confirmSubscriptionPayment(28, request), receipt)
})
