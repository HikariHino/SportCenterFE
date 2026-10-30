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
const active = { id: 10, packageId: 1, packageName: 'Standard 1 tháng', agreedPrice: 300000, durationInDays: 30, status: 'Active', startDate: '2020-10-01T00:00:00Z', endDate: '2099-10-31T00:00:00Z' }
const currentPackage = { id: 1, packageName: active.packageName, price: 300000, durationInDays: 30, isActive: true }
const upgrade = { canUpgrade: true, message: 'Thanh toán phần chênh lệch', currentSubscriptionId: 10, currentPackageName: active.packageName, currentAgreedPrice: 300000, targetPackageId: 2, targetPackageName: pkg.packageName, targetPackagePrice: 800000, discountAmount: 300000, amountToPay: 500000, newStartDate: active.startDate, newEndDate: '2099-12-30T00:00:00Z' }

function mockPurchase({ target = pkg, subscriptions = [active], preview = upgrade, catalog = [currentPackage, { ...pkg, id: 9 }], failRead, loseResponse = false } = {}) {
  const state = { target: structuredClone(target), subscriptions: structuredClone(subscriptions), preview: structuredClone(preview), catalog: structuredClone(catalog), calls: [], posts: [], failRead }
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
      if (config.url.startsWith('/membership-packages/')) {
        const id = config.url.split('/').at(-1)
        data = String(state.target.id) === id ? state.target : state.catalog.find(item => String(item.id) === id)
      }
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

test('pending Standard orders for any package block creating another Standard order', async () => {
  const state = mockPurchase({ subscriptions: [active, { id: 20, packageId: 9, status: 'Pending' }] })
  const purchase = await service.prepareSubscriptionPurchase(2)
  state.subscriptions.push({ id: 21, packageId: 2, status: 'Pending' })
  const result = await service.createReviewedSubscription(purchase)
  assert.equal(result.changed, true)
  assert.match(result.purchase.reason, /chờ thanh toán/)
  assert.deepEqual(state.posts, [])
})

for (const memberId of [undefined, 5]) {
  const role = memberId == null ? 'Member' : 'CenterManager'
  test(`${role}: same Standard, equal-value and lower-value packages cannot create an order even if BE preview allows upgrade`, async () => {
    const upgraded = { ...active, packageId: 9, packageName: 'Standard 6 tháng', agreedPrice: 100000, durationInDays: 180 }
    for (const target of [{ ...pkg, id: 9, price: 1200000 }, pkg, { ...pkg, price: 1000000 }]) {
      const state = mockPurchase({ target, subscriptions: [upgraded], catalog: [{ id: 9, packageName: upgraded.packageName, price: 1000000, durationInDays: 180 }], preview: { ...upgrade, targetPackageId: target.id, currentSubscriptionId: upgraded.id } })
      const purchase = await service.prepareSubscriptionPurchase(target.id, memberId)
      assert.ok(purchase.reason)
      assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
      assert.deepEqual(state.posts, [])
    }
  })

  test(`${role}: active Standard requires an explicit upgrade preview, never a second full-price Standard`, async () => {
    for (const preview of [{ ...upgrade, canUpgrade: false, currentSubscriptionId: null }, { ...upgrade, currentSubscriptionId: 99 }]) {
      const state = mockPurchase({ preview })
      const purchase = await service.prepareSubscriptionPurchase(2, memberId)
      assert.match(purchase.reason, /không thể đăng ký thêm gói Standard/)
      assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
      assert.deepEqual(state.posts, [])
    }
  })

  test(`${role}: PT requires activated Standard and is rechecked if Standard expires or is cancelled before confirmation`, async () => {
    const target = { ...pkg, packageName: 'PT 1-1' }
    const preview = { ...upgrade, canUpgrade: false, currentSubscriptionId: null, currentAgreedPrice: 0, discountAmount: 0, amountToPay: 800000 }
    for (const subscriptions of [[], [{ ...active, status: 'Pending' }], [{ ...active, endDate: '2020-10-02' }], [{ ...active, startDate: '2099-01-01' }]]) {
      const state = mockPurchase({ target, preview, subscriptions })
      const purchase = await service.prepareSubscriptionPurchase(2, memberId)
      assert.match(purchase.reason, /Standard đã kích hoạt/)
      assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
      assert.deepEqual(state.posts, [])
    }
    for (const change of [{ status: 'Cancelled' }, { endDate: '2020-10-02' }]) {
      const state = mockPurchase({ target, preview })
      const purchase = await service.prepareSubscriptionPurchase(2, memberId)
      assert.equal(purchase.reason, '')
      Object.assign(state.subscriptions[0], change)
      const result = await service.createReviewedSubscription(purchase)
      assert.equal(result.changed, true)
      assert.match(result.purchase.reason, /Standard đã kích hoạt/)
      assert.deepEqual(state.posts, [])
    }
  })

  test(`${role}: a new Standard is allowed without membership and PT is allowed alongside activated Standard`, async () => {
    const state = mockPurchase({ subscriptions: [], preview: { ...upgrade, canUpgrade: false, currentSubscriptionId: null, currentAgreedPrice: 0, discountAmount: 0, amountToPay: 800000 } })
    const purchase = await service.prepareSubscriptionPurchase(2, memberId)
    assert.equal(purchase.reason, '')
    await service.createReviewedSubscription(purchase)
    assert.equal(state.posts.length, 1)
    assert.equal(state.posts[0].url, memberId == null ? '/member-subscriptions' : `/member-subscriptions/members/${memberId}`)

    const ptState = mockPurchase({ target: { ...pkg, packageName: 'PT 1-1' }, preview: { ...upgrade, canUpgrade: false, currentSubscriptionId: null, currentAgreedPrice: 0, discountAmount: 0, amountToPay: 800000 } })
    const ptPurchase = await service.prepareSubscriptionPurchase(2, memberId)
    assert.equal(ptPurchase.reason, '')
    await service.createReviewedSubscription(ptPurchase)
    assert.equal(ptState.posts.length, 1)
  })
}

test('current package descriptions and full prices are fetched again before confirmation; failed reads cannot permit registration', async () => {
  const state = mockPurchase()
  const purchase = await service.prepareSubscriptionPurchase(2)
  state.catalog[0].price = 900000
  const result = await service.createReviewedSubscription(purchase)
  assert.equal(result.changed, true)
  assert.match(result.purchase.reason, /cao hơn/)
  assert.deepEqual(state.posts, [])
  state.failRead = '/membership-packages/1'
  await assert.rejects(service.prepareSubscriptionPurchase(2), /Không tải được/)
  assert.deepEqual(state.posts, [])
})

test('an upgrade that shortens the actual expiry and inconsistent current package details never create orders', async () => {
  const state = mockPurchase({ preview: { ...upgrade, newEndDate: '2099-10-30T00:00:00Z' } })
  const purchase = await service.prepareSubscriptionPurchase(2)
  assert.match(purchase.reason, /Ngày hết hạn/)
  assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
  assert.deepEqual(state.posts, [])
  for (const changes of [{ price: null }, { price: 'invalid' }, { durationInDays: undefined }, { id: 99 }]) {
    const invalid = mockPurchase({ catalog: [{ ...currentPackage, ...changes }] })
    await assert.rejects(service.prepareSubscriptionPurchase(2), /thông tin gói hiện tại/)
    assert.deepEqual(invalid.posts, [])
  }
})

test('a misleading package name cannot make an active PT count as a Standard prerequisite', async () => {
  const state = mockPurchase({ target: { ...pkg, packageName: 'PT 1-1' },
    catalog: [{ ...currentPackage, description: 'Huấn luyện viên cá nhân 1-1' }],
    preview: { ...upgrade, canUpgrade: false, currentSubscriptionId: null } })
  const purchase = await service.prepareSubscriptionPurchase(2)
  assert.match(purchase.reason, /Standard đã kích hoạt/)
  assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
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
