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
    server: { middlewareMode: true, hmr: { port: 0 } }, appType: 'custom', logLevel: 'error' })
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

const pkg = { id: 2, packageType: 'Standard', packageName: 'Standard 3 tháng', price: 800000, durationInDays: 90, isActive: true }
const active = { id: 10, packageId: 1, packageType: 'Standard', packageName: 'Standard 1 tháng', agreedPrice: 300000, durationInDays: 30, status: 'Active', startDate: '2020-10-01T00:00:00Z', endDate: '2099-10-31T00:00:00Z' }
const upgrade = { canUpgrade: true, message: 'Thanh toán phần chênh lệch', currentSubscriptionId: 10, currentPackageName: active.packageName, currentAgreedPrice: 300000, targetPackageId: 2, targetPackageName: pkg.packageName, targetPackagePrice: 800000, discountAmount: 300000, amountToPay: 500000, newStartDate: active.startDate, newEndDate: '2099-12-30T00:00:00Z' }
const newPurchase = { ...upgrade, canUpgrade: false, currentSubscriptionId: null, currentAgreedPrice: 0, discountAmount: 0, amountToPay: 800000 }

function mockPurchase({ target = pkg, subscriptions = [active], preview = upgrade, failRead, loseResponse = false,
  referencePackages = [{ id: 1, packageType: 'Standard', packageName: 'Gói cũ', price: 300000, durationInDays: 30 }] } = {}) {
  const state = { target: structuredClone(target), subscriptions: structuredClone(subscriptions), preview: structuredClone(preview), referencePackages: structuredClone(referencePackages), calls: [], posts: [], failRead }
  api.defaults.adapter = async config => {
    state.calls.push({ method: config.method, url: config.url, params: config.params })
    let data
    if (config.method === 'post') {
      const body = JSON.parse(config.data)
      state.posts.push({ url: config.url, body })
      data = { id: 30, memberId: 5, packageId: body.packageId, packageType: state.target.packageType,
        packageName: state.target.packageName, agreedPrice: state.target.packageType === 'PT' ? state.target.price : state.preview.amountToPay,
        durationInDays: state.target.durationInDays, status: 'Pending' }
      state.subscriptions.push(data)
      if (loseResponse) throw new Error('Mất kết nối sau khi tạo đơn')
    } else {
      if (state.failRead === config.url) throw new Error('Không tải được điều kiện mới')
      if (config.url.startsWith('/membership-packages/')) {
        const id = Number(config.url.split('/').at(-1))
        data = id === state.target.id ? state.target : state.referencePackages.find(pkg => pkg.id === id)
      } else if (config.url.endsWith('/upgrade-preview')) data = state.preview
      else if (config.url === '/member-subscriptions/me' || /^\/member-subscriptions\/members\/\d+$/.test(config.url)) data = state.subscriptions
      else throw new Error('Unexpected request ' + config.url)
    }
    return { data: { success: true, data: structuredClone(data) }, status: 200, headers: {}, config }
  }
  return state
}

for (const memberId of [undefined, 5]) {
  const role = memberId == null ? 'Member' : 'CenterManager'
  const previewUrl = memberId == null ? '/member-subscriptions/upgrade-preview' : '/member-subscriptions/members/5/upgrade-preview'
  const createUrl = memberId == null ? '/member-subscriptions' : '/member-subscriptions/members/5'

  test(role + ': Standard upgrades use the new preview route and submit only packageId', async () => {
    const state = mockPurchase()
    const purchase = await service.prepareSubscriptionPurchase(2, memberId)
    assert.equal(purchase.reason, '')
    assert.equal(purchase.preview.discountAmount, 300000)
    assert.equal(purchase.preview.amountToPay, 500000)
    assert.deepEqual(state.calls.find(item => item.url === previewUrl).params, { targetPackageId: 2 })
    assert.equal(state.calls.some(item => item.url === '/membership-packages/1'), true)
    const result = await service.createReviewedSubscription(purchase)
    assert.equal(result.changed, false)
    assert.equal(result.subscription.agreedPrice, 500000)
    assert.deepEqual(state.posts, [{ url: createUrl, body: { packageId: 2 } }])
    assert.equal(state.subscriptions[0].status, 'Active')
  })

  test(role + ': lower and equal Standard prices remain blocked even if BE preview says upgrade', async () => {
    for (const price of [200000, 300000]) {
      const state = mockPurchase({ target: { ...pkg, price } })
      const purchase = await service.prepareSubscriptionPurchase(2, memberId)
      assert.match(purchase.reason, /cao hơn/)
      assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
      assert.deepEqual(state.posts, [])
    }
  })

  test(role + ': a highest-tier subscription paid as a small surcharge cannot downgrade even with a permissive BE preview', async () => {
    for (const price of [500000, 1000000]) {
      const state = mockPurchase({ target: { ...pkg, price }, subscriptions: [{ ...active, agreedPrice: 100000 }],
        referencePackages: [{ id: 1, packageType: 'Standard', price: 1000000, durationInDays: 180, isActive: false }] })
      const purchase = await service.prepareSubscriptionPurchase(2, memberId)
      assert.match(purchase.reason, /cao hơn/)
      assert.equal(purchase.preview, null)
      assert.equal(state.calls.some(call => call.url.endsWith('/upgrade-preview')), false)
      assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
      assert.deepEqual(state.posts, [])
    }
  })

  test(role + ': explicit PT with a Basic name is independent, full-price and never requests Standard credit', async () => {
    for (const subscriptions of [[], [active], [{ ...active, status: 'Pending' }], [{ ...active, status: 'Expired' }],
      [{ ...active, packageType: 'PT', packageName: 'Standard 1 tháng' }]]) {
      const state = mockPurchase({ target: { ...pkg, packageType: 'PT', packageName: 'Basic' }, subscriptions })
      const purchase = await service.prepareSubscriptionPurchase(2, memberId)
      assert.equal(purchase.reason, '')
      assert.equal(purchase.preview.canUpgrade, false)
      assert.equal(purchase.preview.discountAmount, 0)
      assert.equal(purchase.preview.amountToPay, pkg.price)
      assert.equal(state.calls.some(item => item.url.endsWith('upgrade-preview')), false)
      const result = await service.createReviewedSubscription(purchase)
      assert.equal(result.subscription.agreedPrice, pkg.price)
      assert.deepEqual(state.posts, [{ url: createUrl, body: { packageId: 2 } }])
    }
  })

  test(role + ': only the exact active PT package is blocked; another PT remains purchasable', async () => {
    const target = { ...pkg, packageType: 'PT', packageName: 'Basic' }
    const state = mockPurchase({ target, subscriptions: [{ ...active, packageId: 2, packageType: 'PT' }] })
    const purchase = await service.prepareSubscriptionPurchase(2, memberId)
    assert.match(purchase.reason, /PT này/)
    assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
    assert.deepEqual(state.posts, [])
  })

  test(role + ': Standard cannot fall back to a second full-price purchase while already active', async () => {
    const state = mockPurchase({ preview: newPurchase })
    const purchase = await service.prepareSubscriptionPurchase(2, memberId)
    assert.match(purchase.reason, /không thể đăng ký thêm gói Standard/)
    assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
    assert.deepEqual(state.posts, [])
  })
}

test('changed type, upgrade credit or amount requires another review without creating an order', async () => {
  for (const change of [state => { state.target.packageType = 'PT' }, state => { state.preview.amountToPay = 550000 }, state => { state.preview.currentSubscriptionId = 11 }]) {
    const state = mockPurchase()
    const purchase = await service.prepareSubscriptionPurchase(2)
    change(state)
    assert.equal((await service.createReviewedSubscription(purchase)).changed, true)
    assert.deepEqual(state.posts, [])
  }
})

test('a PT that becomes active after opening confirmation is rejected by the fresh history read', async () => {
  const state = mockPurchase({ target: { ...pkg, packageType: 'PT' }, subscriptions: [] })
  const purchase = await service.prepareSubscriptionPurchase(2)
  state.subscriptions.push({ ...active, packageId: 2, packageType: 'PT' })
  assert.match((await service.createReviewedSubscription(purchase)).purchase.reason, /PT này/)
  assert.deepEqual(state.posts, [])
})

test('failed preview, failed history and invalid upgrade amounts cannot create orders', async () => {
  for (const options of [{ failRead: '/member-subscriptions/upgrade-preview' }, { failRead: '/member-subscriptions/me' },
    { preview: { ...upgrade, amountToPay: null } }, { preview: { ...upgrade, targetPackageId: 99 } },
    { preview: { ...upgrade, newStartDate: 'invalid' } }]) {
    const state = mockPurchase(options)
    await assert.rejects(service.prepareSubscriptionPurchase(2))
    assert.deepEqual(state.posts, [])
  }
})

test('legacy responses without packageType still resolve their package details', async () => {
  const state = mockPurchase({ subscriptions: [{ ...active, packageType: undefined }] })
  assert.equal((await service.prepareSubscriptionPurchase(2)).reason, '')
  assert.ok(state.calls.some(item => item.url === '/membership-packages/1'))
})

test('a changed full current package price is rechecked before creating the reviewed order', async () => {
  const state = mockPurchase()
  const purchase = await service.prepareSubscriptionPurchase(2)
  state.referencePackages[0].price = 1000000
  const result = await service.createReviewedSubscription(purchase)
  assert.equal(result.changed, true)
  assert.match(result.purchase.reason, /cao hơn/)
  assert.deepEqual(state.posts, [])
})

test('unreadable current package values cannot be bypassed through direct confirmation', async () => {
  for (const options of [{ failRead: '/membership-packages/1' }, { referencePackages: [] },
    { referencePackages: [{ id: 1, price: 0 }] }]) {
    const state = mockPurchase(options)
    await assert.rejects(service.prepareSubscriptionPurchase(2))
    assert.deepEqual(state.posts, [])
  }
})

test('staff form loads the full active package value even when it is absent from the sale catalog', async () => {
  const highest = { id: 1, packageType: 'Standard', packageName: 'Gói cao nhất', price: 1000000, durationInDays: 180, isActive: false }
  const state = mockPurchase({ subscriptions: [{ ...active, agreedPrice: 100000 }], referencePackages: [highest] })
  const references = await service.loadSubscriptionPackageReferences(state.subscriptions, [state.target])
  assert.equal(references.find(pkg => pkg.id === 1).price, highest.price)
  assert.equal(references.find(pkg => pkg.id === 1).isActive, false)
  assert.equal(references.find(pkg => pkg.id === 2).id, state.target.id)
  assert.deepEqual(state.posts, [])
})

test('a lost creation response is reconciled with the pending order before a second POST', async () => {
  const state = mockPurchase({ loseResponse: true })
  const purchase = await service.prepareSubscriptionPurchase(2)
  await assert.rejects(service.createReviewedSubscription(purchase), /Mất kết nối/)
  const result = await service.createReviewedSubscription(purchase)
  assert.equal(result.changed, true)
  assert.match(result.purchase.reason, /chờ thanh toán/)
  assert.equal(state.posts.length, 1)
})
