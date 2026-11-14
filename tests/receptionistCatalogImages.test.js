import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, api, catalog, packages, subscriptions, sports
const descriptors = new Map()
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: { getItem: () => null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  catalog = await server.ssrLoadModule('/src/services/receptionistCatalogService.js')
  packages = await server.ssrLoadModule('/src/services/membershipPackageService.js')
  subscriptions = await server.ssrLoadModule('/src/services/memberSubscriptionService.js')
  sports = await server.ssrLoadModule('/src/services/classCatalogService.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})
const response = (config, data) => ({ config, status: 200, headers: {}, data: { success: true, data } })

test('Receptionist selects sports by ID and queries classes/sessions when the catalog includes imageUrl', async () => {
  for (const imageUrl of [undefined, null, '', 'https://images.example/sport.webp', 'https://images.example/missing.png']) {
    const calls = []
    api.defaults.adapter = async config => {
      calls.push({ method: config.method, url: config.url, params: config.params })
      if (config.url === '/sports') return response(config, [{ id: 3, name: 'Tennis', imageUrl }])
      return response(config, { items: [{ id: 12, sportId: 3, sportName: 'Tennis', imageUrl }], total: 1 })
    }
    const [sport] = await sports.getSports()
    assert.equal(sport.imageUrl, imageUrl)
    const filters = { sportId: sport.id, coachId: 4, page: 1, pageSize: 20 }
    const classes = await catalog.getReceptionistClasses(filters)
    const sessions = await catalog.getReceptionistClassSessions(filters)
    assert.equal(classes.items[0].sportId, 3)
    assert.equal(sessions.items[0].sportId, 3)
    assert.equal(classes.total, 1)
    for (const call of calls.slice(1)) {
      assert.equal(call.params.sportId, 3)
      assert.equal(call.params.coachId, 4)
      assert.equal(call.params.imageUrl, undefined)
      assert.equal(call.method, 'get')
    }
  }
})

test('counter registration retains package images while submitting only the selected package ID', async () => {
  for (const imageUrl of [undefined, null, '', 'https://images.example/package.webp', 'https://images.example/missing.png']) {
    const writes = []
    const pkg = { id: 7, packageName: 'Gold', price: 2000, durationInDays: 30, isActive: true, imageUrl }
    api.defaults.adapter = async config => {
      if (config.method === 'post') {
        writes.push({ url: config.url, data: JSON.parse(config.data) })
        return response(config, { id: 18, memberId: 9, packageId: 7, status: 'Pending', packageName: 'Gold', agreedPrice: 2000 })
      }
      return response(config, config.url === '/membership-packages' ? [pkg] : pkg)
    }
    const [item] = await packages.getMembershipPackages()
    const detail = await packages.getMembershipPackageById(item.id)
    assert.equal(detail.imageUrl, imageUrl)
    const subscription = await subscriptions.createReceptionistMemberSubscription(9, detail.id)
    assert.equal(subscription.packageId, 7)
    assert.deepEqual(writes, [{ url: '/member-subscriptions/members/9', data: { packageId: 7 } }])
  }
})
