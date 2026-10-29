import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { getLandingAction, getLandingPortal } from '../src/utils/landingNavigation.js'
import { getAuthDestination } from '../src/utils/auth.js'

let server, api, service
const descriptors = new Map()
before(async () => {
  for (const name of ['localStorage', 'sessionStorage']) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, { configurable: true, value: { getItem: key => key === 'token' ? 'private-session-token' : null } })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/landingService.js')
})
after(async () => {
  await server?.close()
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete globalThis[name]
  }
})

const pkg = { id: 7, packageName: 'Standard 3 tháng', price: 800000, durationInDays: 90, isActive: true }
const session = { id: 11, className: 'Yoga buổi sáng', startsAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-01T01:00:00Z', availableSeats: 4 }
const response = (config, data) => ({ data: { success: true, data }, status: 200, headers: {}, config })

test('landing reads only public catalogs without sending the current user token or private API calls', async () => {
  const calls = []
  const data = { '/membership-packages': [pkg, { ...pkg, id: 8, isActive: false }], '/sports': [{ id: 1, name: 'Yoga' }], '/coaches': [{ id: 2, fullName: 'Nguyễn An' }] }
  api.defaults.adapter = async config => {
    calls.push(config.url)
    assert.equal(config.method, 'get')
    assert.equal(config.skipAuth, true)
    assert.equal(config.headers.Authorization, undefined)
    assert.equal(config.timeout, 12000)
    return response(config, data[config.url])
  }
  assert.deepEqual(await service.getLandingPackages(), [pkg])
  assert.equal((await service.getLandingSports())[0].name, 'Yoga')
  assert.equal((await service.getLandingCoaches())[0].fullName, 'Nguyễn An')
  assert.deepEqual(calls, ['/membership-packages', '/sports', '/coaches'])
})

test('schedule filters use the actual public ClassSearch contract and preserve BE seat counts', async () => {
  const controller = new AbortController()
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/class-sessions')
    assert.equal(config.skipAuth, true)
    assert.equal(config.signal, controller.signal)
    assert.equal(config.params.sportId, 3)
    assert.equal(config.params.search, 'Yoga')
    assert.equal(config.params.onlyAvailable, true)
    assert.equal(config.params.pageSize, 6)
    assert.ok(Math.abs(Date.parse(config.params.from) - Date.now()) < 2000)
    return response(config, { items: [session], total: 15, page: 1, pageSize: 6 })
  }
  const result = await service.getLandingSessions({ sportId: '3', search: '  Yoga  ', signal: controller.signal })
  assert.equal(result.total, 15)
  assert.equal(result.items[0].availableSeats, 4)
})

test('empty catalogs stay empty and malformed prices or sessions never turn into invented data', async () => {
  api.defaults.adapter = async config => response(config, [])
  assert.deepEqual(await service.getLandingPackages(), [])
  for (const bad of [[{ ...pkg, price: null }], [{ ...pkg, durationInDays: 0 }], { items: [pkg] }]) {
    api.defaults.adapter = async config => response(config, bad)
    await assert.rejects(service.getLandingPackages(), /chưa hợp lệ/)
  }
  api.defaults.adapter = async config => response(config, { items: [{ ...session, availableSeats: -1 }], total: 1 })
  await assert.rejects(service.getLandingSessions(), /chưa hợp lệ/)
})

test('a public API failure propagates so the page can offer retry instead of fake availability', async () => {
  api.defaults.adapter = async () => { throw Object.assign(new Error('Mock unavailable'), { response: { status: 503 } }) }
  await assert.rejects(service.getLandingPackages(), /Mock unavailable/)
})

test('an unauthorized public-catalog response does not refresh a private session or redirect the visitor', async () => {
  let calls = 0
  api.defaults.adapter = async config => {
    calls++
    throw Object.assign(new Error('Public catalog unavailable'), { config, response: { status: 401 } })
  }
  await assert.rejects(service.getLandingPackages(), /Public catalog unavailable/)
  assert.equal(calls, 1)
})

test('guest package and class choices survive login and open the right Member view', () => {
  const choice = getLandingAction(null, 'subscriptions', 7)
  assert.equal(choice.to, '/login')
  assert.equal(getAuthDestination('member', choice.state.from), '/member?view=subscriptions&catalog=1&packageId=7')
  assert.equal(getLandingAction({ role: 'member' }, 'classes').to, '/member?view=classes&browse=1')
  assert.doesNotMatch(getLandingAction(null, 'subscriptions', 'https://example.com').state.from, /packageId/)
  assert.equal(getAuthDestination('member', '//example.com/member'), '/member')
  assert.equal(getAuthDestination('member', '/member/other'), '/member')
})

test('staff actions go to their authorized portal and unsupported accounts do not loop to home', () => {
  assert.equal(getLandingAction({ role: 'manager' }, 'subscriptions', 7).to, '/manager?view=packages')
  assert.equal(new URL(getLandingAction({ role: 'receptionist' }, 'payments').to, 'http://localhost').searchParams.get('view'), 'Thanh toán')
  assert.equal(getLandingAction({ role: 'coach' }, 'classes').to, '/coach')
  assert.equal(getLandingPortal({ role: 'admin' }).to, '/login')
})
