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
  service = await server.ssrLoadModule('/src/services/memberSubscriptionService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
test('mine validates array data so an unreadable history cannot appear to be empty', async () => {
  for (const data of [[], [{ id: 1, status: 'Active' }]]) {
    api.defaults.adapter = async config => ({ data: { success: true, data }, status: 200, headers: {}, config })
    assert.deepEqual(await service.getMySubscriptions(), data)
  }
  for (const data of [null, {}, { items: [] }]) {
    api.defaults.adapter = async config => ({ data: { success: true, data }, status: 200, headers: {}, config })
    await assert.rejects(service.getMySubscriptions(), /không hợp lệ/)
  }
})
test('subscription application errors never resolve as successful reads or registrations', async () => {
  api.defaults.adapter = async config => ({ data: { statusCode: 409, message: 'Đã có gói đang hiệu lực.' }, status: 200, headers: {}, config })
  await assert.rejects(service.getMySubscriptions(), /hiệu lực/)
  await assert.rejects(service.createMemberSubscription(2), /hiệu lực/)
})

test('member subscriptions prefer /me, retain explicit packageType and fall back to /mine only for missing routes', async () => {
  const rows = [{ id: 1, status: 'Active', packageType: 'PT', packageName: 'Basic' }]
  const calls = []
  let legacy = false
  api.defaults.adapter = async config => {
    calls.push(config.url)
    if (legacy && config.url.endsWith('/me')) throw Object.assign(new Error('Not found'), { response: { status: 404 } })
    return { data: { success: true, data: rows }, status: 200, headers: {}, config }
  }
  assert.deepEqual(await service.getMySubscriptions(), rows)
  assert.deepEqual(calls, ['/member-subscriptions/me'])
  calls.length = 0
  legacy = true
  assert.deepEqual(await service.getMySubscriptions(), rows)
  assert.deepEqual(calls, ['/member-subscriptions/me', '/member-subscriptions/mine'])
})

const validPreview = { targetPackageId: 2, canUpgrade: true, currentSubscriptionId: 10, targetPackagePrice: 800000,
  discountAmount: 300000, amountToPay: 500000, currentAgreedPrice: 300000, newStartDate: '2026-10-01', newEndDate: '2027-01-01' }

test('staff preview scopes memberId in the route, with a read-only compatibility fallback on 404/405', async () => {
  for (const missingStatus of [null, 404, 405]) {
    const calls = []
    api.defaults.adapter = async config => {
      calls.push({ url: config.url, params: config.params })
      if (missingStatus && config.url.includes('/members/')) throw Object.assign(new Error('Route missing'), { response: { status: missingStatus } })
      return { data: { success: true, data: validPreview }, status: 200, headers: {}, config }
    }
    assert.deepEqual(await service.getSubscriptionUpgradePreview(2, 5), validPreview)
    assert.deepEqual(calls[0], { url: '/member-subscriptions/members/5/upgrade-preview', params: { targetPackageId: 2 } })
    assert.equal(calls.length, missingStatus ? 2 : 1)
    if (missingStatus) assert.deepEqual(calls[1], { url: '/member-subscriptions/upgrade-preview', params: { targetPackageId: 2, memberId: 5 } })
  }
})

test('authentication, validation, business errors and server errors never trigger legacy-route retries', async () => {
  for (const status of [400, 401, 403, 409, 500]) {
    const calls = []
    api.defaults.adapter = async config => {
      calls.push(config.url)
      throw Object.assign(new Error('Request rejected'), { response: { status, data: { message: 'Request rejected' } } })
    }
    // skipAuth prevents the global refresh/login interceptor in this route test.
    const interceptor = config => { config.skipAuth = true; return config }
    const id = api.interceptors.request.use(interceptor)
    try {
      await assert.rejects(service.getMySubscriptions())
      await assert.rejects(service.getSubscriptionUpgradePreview(2, 5))
    } finally { api.interceptors.request.eject(id) }
    assert.deepEqual(calls, ['/member-subscriptions/me', '/member-subscriptions/members/5/upgrade-preview'])
  }
})
