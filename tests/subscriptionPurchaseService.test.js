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
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/subscriptionPurchaseService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

const pkg = { id: 2, packageName: 'Standard 3 tháng', price: 800000, durationInDays: 90, isActive: true }
const active = { id: 10, packageId: 1, packageName: 'Standard 1 tháng', agreedPrice: 300000, status: 'Active', startDate: '2099-10-01T00:00:00Z', endDate: '2099-10-31T00:00:00Z' }
const upgrade = { canUpgrade: true, message: 'Thanh toán phần chênh lệch', currentSubscriptionId: 10, currentPackageName: active.packageName, currentAgreedPrice: 300000, targetPackageId: 2, targetPackageName: pkg.packageName, targetPackagePrice: 800000, discountAmount: 300000, amountToPay: 500000, newStartDate: active.startDate, newEndDate: '2099-12-30T00:00:00Z' }

function mockPurchase({ target = pkg, subscriptions = [active], preview = upgrade, failRead, loseResponse = false } = {}) {
  const state = { target: structuredClone(target), subscriptions: structuredClone(subscriptions), preview: structuredClone(preview), calls: [], posts: [], failRead }
  api.defaults.adapter = async config => {
    state.calls.push({ method: config.method, url: config.url, params: config.params })
    let data
    if (config.method === 'post') {
      const body = JSON.parse(config.data)
      state.posts.push({ url: config.url, body })
      data = { id: 30, memberId: 5, packageId: body.packageId, packageName: state.target.packageName, agreedPrice: state.preview.amountToPay, durationInDays: state.target.durationInDays, status: 'Pending' }
      state.subscriptions.push(data)
      if (loseResponse) throw new Error('Mất kết nối sau khi tạo đơn')
    } else {
      if (state.failRead === config.url) throw new Error('Không tải được điều kiện mới')
      if (config.url.startsWith('/membership-packages/')) data = state.target
      else if (config.url === '/member-subscriptions/upgrade-preview') data = state.preview
      else data = state.subscriptions
    }
    return { data: { success: true, data: structuredClone(data) }, status: 200, headers: {}, config }
  }
  return state
}

test('upgrade preview preserves BE credit and original start date without creating an order or charging money', async () => {
  const state = mockPurchase()
  const purchase = await service.prepareSubscriptionPurchase(2)
  assert.equal(purchase.preview.amountToPay, 500000)
  assert.equal(purchase.preview.newStartDate, active.startDate)
  assert.equal(purchase.reason, '')
  assert.deepEqual(state.posts, [])
  assert.deepEqual(state.calls.find(item => item.url.endsWith('upgrade-preview')).params, { targetPackageId: 2 })
})

test('confirmed upgrade submits only packageId and uses the returned agreedPrice for the pending payment', async () => {
  const state = mockPurchase()
  const purchase = await service.prepareSubscriptionPurchase(2)
  const result = await service.createReviewedSubscription(purchase)
  assert.deepEqual(state.posts, [{ url: '/member-subscriptions', body: { packageId: 2 } }])
  assert.equal(result.subscription.agreedPrice, 500000)
  assert.equal(result.subscription.status, 'Pending')
  assert.equal(state.subscriptions.find(item => item.id === 10).status, 'Active')
})

test('PT can be purchased alongside Standard and new purchases do not treat shifting activation estimates as changed prices', async () => {
  const state = mockPurchase({ target: { ...pkg, packageName: 'PT 1-1' }, preview: { ...upgrade, canUpgrade: false, currentSubscriptionId: null, currentAgreedPrice: 0, discountAmount: 0, amountToPay: 800000 } })
  const purchase = await service.prepareSubscriptionPurchase(2)
  state.preview.newStartDate = '2099-10-28T09:00:00Z'
  state.preview.newEndDate = '2100-01-26T09:00:00Z'
  assert.equal((await service.createReviewedSubscription(purchase)).subscription.agreedPrice, 800000)
  assert.equal(state.posts.length, 1)
})

test('pending orders for another package do not block a purchase; the exact package does', async () => {
  const state = mockPurchase({ subscriptions: [active, { id: 20, packageId: 9, status: 'Pending' }] })
  const purchase = await service.prepareSubscriptionPurchase(2)
  state.subscriptions.push({ id: 21, packageId: 2, status: 'Pending' })
  const result = await service.createReviewedSubscription(purchase)
  assert.equal(result.changed, true)
  assert.match(result.purchase.reason, /chờ thanh toán/)
  assert.deepEqual(state.posts, [])
})

test('lower-price Standard and duplicate active PT are refused before POST', async () => {
  for (const options of [
    { preview: { ...upgrade, canUpgrade: false, message: 'Chỉ nâng cấp lên gói cao hơn' } },
    { target: { ...pkg, packageName: 'PT 1-1' }, subscriptions: [{ ...active, packageId: 2, packageName: 'PT 1-1' }], preview: { ...upgrade, canUpgrade: false } },
  ]) {
    const state = mockPurchase(options)
    const purchase = await service.prepareSubscriptionPurchase(2)
    assert.ok(purchase.reason)
    assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
    assert.deepEqual(state.posts, [])
  }
})

test('changed amount, credited subscription, duration or upgrade dates require renewed consent', async () => {
  for (const change of [
    state => { state.preview.amountToPay = 550000 },
    state => { state.preview.currentSubscriptionId = 11 },
    state => { state.target.durationInDays = 120 },
    state => { state.preview.newEndDate = '2100-01-29T00:00:00Z' },
  ]) {
    const state = mockPurchase()
    const purchase = await service.prepareSubscriptionPurchase(2)
    change(state)
    const result = await service.createReviewedSubscription(purchase)
    assert.equal(result.changed, true)
    assert.deepEqual(state.posts, [])
  }
})

test('counter purchase previews and creates for the selected member, including Standard/PT rules', async () => {
  const state = mockPurchase()
  const purchase = await service.prepareSubscriptionPurchase(2, 5)
  assert.deepEqual(state.calls.find(item => item.url.endsWith('upgrade-preview')).params, { targetPackageId: 2, memberId: 5 })
  assert.ok(state.calls.some(item => item.url === '/member-subscriptions/members/5'))
  await service.createReviewedSubscription(purchase)
  assert.deepEqual(state.posts, [{ url: '/member-subscriptions/members/5', body: { packageId: 2 } }])
})

test('failed preview or history and malformed amounts never create or infer a payment amount', async () => {
  for (const options of [
    { failRead: '/member-subscriptions/upgrade-preview' }, { failRead: '/member-subscriptions/mine' },
    { preview: { ...upgrade, amountToPay: null } }, { preview: { ...upgrade, amountToPay: -1 } },
    { preview: { ...upgrade, targetPackageId: 99 } },
    { preview: { ...upgrade, newStartDate: 'invalid' } },
    { preview: { ...upgrade, currentSubscriptionId: null } },
  ]) {
    const state = mockPurchase(options)
    await assert.rejects(service.prepareSubscriptionPurchase(2))
    assert.deepEqual(state.posts, [])
  }
})

test('a lost creation response is reconciled with pending history on retry without a second POST', async () => {
  const state = mockPurchase({ loseResponse: true })
  const purchase = await service.prepareSubscriptionPurchase(2)
  await assert.rejects(service.createReviewedSubscription(purchase), /Mất kết nối/)
  const result = await service.createReviewedSubscription(purchase)
  assert.equal(result.changed, true)
  assert.match(result.purchase.reason, /chờ thanh toán/)
  assert.equal(state.posts.length, 1)
})
