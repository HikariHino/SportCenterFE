import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import axios from 'axios'

let server, api, auth, authService, originalAdapter
const session = new Map(), remembered = new Map(), descriptors = new Map()
const storage = values => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) })
const jwt = seconds => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds })).toString('base64url')}.test-signature`
const response = (config, data) => ({ config, data, status: 200, headers: {} })
const rejected = (config, status) => Object.assign(new Error('Rejected'), { config, response: { status, data: { message: 'Phiên không hợp lệ.' } } })
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const tick = () => new Promise(resolve => setImmediate(resolve))
function login(token = jwt(-10), remember = false) {
  return auth.saveSession({ userId: 1, role: 'Receptionist', email: 'reception@example.test', token, refreshTokenKey: 'refresh-one' }, token, remember)
}

before(async () => {
  for (const [key, value] of Object.entries({ sessionStorage: storage(session), localStorage: storage(remembered),
    window: { location: { pathname: '/receptionist', search: '', href: '' } }, navigator: {} })) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false,
    server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  auth = await server.ssrLoadModule('/src/utils/auth.js')
  authService = await server.ssrLoadModule('/src/services/authService.js')
  originalAdapter = axios.defaults.adapter
})
beforeEach(() => {
  session.clear(); remembered.clear(); window.location.href = ''; delete navigator.locks
})
after(async () => {
  axios.defaults.adapter = originalAdapter
  await server?.close()
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('expired and near-expiry tokens renew once before parallel portal reads reach the API', async () => {
  for (const seconds of [-60, 15]) {
    login(jwt(seconds))
    const ready = deferred(), newer = jwt(900)
    let refreshes = 0
    const reads = []
    axios.defaults.adapter = async config => {
      refreshes++
      assert.equal(config.url, '/api/Auth/refresh-token')
      assert.equal(config.timeout, 15000)
      assert.deepEqual(JSON.parse(config.data), { refreshTokenKey: 'refresh-one' })
      await ready.promise
      return response(config, { token: newer, refreshTokenKey: 'refresh-two' })
    }
    api.defaults.adapter = async config => {
      reads.push(config.url)
      assert.equal(config.headers.Authorization, `Bearer ${newer}`)
      return response(config, [])
    }
    const requests = ['/payments', '/Rooms', '/members', '/GymCheckIns/today'].map(url => api.get(url))
    await tick()
    assert.equal(refreshes, 1)
    assert.equal(reads.length, 0)
    ready.resolve()
    await Promise.all(requests)
    assert.equal(reads.length, 4)
    assert.equal(refreshes, 1)
    assert.equal(auth.getRefreshTokenKey(), 'refresh-two')
    assert.equal(window.location.href, '')
  }
})

test('unexpired tokens and public requests do not trigger preflight refresh', async () => {
  login(jwt(900))
  axios.defaults.adapter = () => assert.fail('Unexpected refresh')
  api.defaults.adapter = async config => response(config, [])
  await api.get('/payments')
  login(jwt(-60))
  api.defaults.adapter = async config => {
    assert.equal(config.headers.Authorization, undefined)
    return response(config, [])
  }
  await api.get('/classes', { skipAuth: true })
})

test('signing out revokes the current refresh credential without rotating it first', async () => {
  login()
  axios.defaults.adapter = () => assert.fail('Signing out must not rotate the refresh token')
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/Auth/logout')
    assert.equal(config.headers.Authorization, undefined)
    assert.deepEqual(JSON.parse(config.data), { refreshTokenKey: 'refresh-one' })
    return response(config, { message: 'Signed out' })
  }
  await authService.logout({ refreshTokenKey: auth.getRefreshTokenKey() })
})

test('a late old-token 401 reuses a renewed token instead of rotating refresh credentials twice', async () => {
  const old = jwt(900), newer = jwt(1200), late = deferred()
  login(old)
  let refreshes = 0
  axios.defaults.adapter = async config => { refreshes++; return response(config, { token: newer, refreshTokenKey: 'refresh-two' }) }
  api.defaults.adapter = async config => {
    if (config.headers.Authorization === `Bearer ${old}`) {
      if (config.url === '/Rooms') await late.promise
      throw rejected(config, 401)
    }
    assert.equal(config.headers.Authorization, `Bearer ${newer}`)
    return response(config, [])
  }
  const first = api.get('/payments'), second = api.get('/Rooms')
  await first
  late.resolve()
  await second
  assert.equal(refreshes, 1)
  assert.equal(auth.getToken(), newer)
})

test('another tab rotation for the same login is reused under the browser refresh lock', async () => {
  const old = jwt(-60), newer = jwt(900)
  login(old, true)
  const loginId = auth.getLoginSessionId()
  navigator.locks = { request: async (name, renew) => {
    assert.equal(name, `sportcenter:refresh:${loginId}`)
    remembered.set('token', newer); remembered.set('refreshTokenKey', 'another-tab-refresh')
    return renew()
  } }
  axios.defaults.adapter = () => assert.fail('The other tab already renewed this login')
  api.defaults.adapter = async config => {
    assert.equal(config.headers.Authorization, `Bearer ${newer}`)
    return response(config, [])
  }
  await api.get('/payments')
  assert.equal(session.get('refreshTokenKey'), 'another-tab-refresh')
})

test('a refresh rejected by BE ends the session before sending any expired protected request', async () => {
  login()
  axios.defaults.adapter = async config => { throw rejected(config, 401) }
  api.defaults.adapter = () => assert.fail('Expired token reached the protected endpoint')
  await assert.rejects(api.get('/payments'), error => error.response?.status === 401)
  assert.equal(auth.getToken(), null)
  assert.equal(window.location.href, '/login')
})

test('temporary refresh failures retain the login and recover on a later request', async () => {
  for (const status of [undefined, 503]) {
    login()
    const old = auth.getToken(), newer = jwt(900)
    axios.defaults.adapter = async config => { throw status ? rejected(config, status) : new Error('Network Error') }
    api.defaults.adapter = () => assert.fail('Protected request sent before renewal')
    await assert.rejects(api.get('/payments'))
    assert.equal(auth.getToken(), old)
    assert.equal(window.location.href, '')
    axios.defaults.adapter = async config => response(config, { token: newer, refreshTokenKey: 'refresh-two' })
    api.defaults.adapter = async config => response(config, [])
    await api.get('/payments')
    assert.equal(auth.getToken(), newer)
  }
})

test('a refresh response from a previous login cannot overwrite the new account or replay its request', async () => {
  login()
  const pending = deferred(), newer = jwt(900)
  axios.defaults.adapter = async config => { await pending.promise; return response(config, { token: newer, refreshTokenKey: 'old-login-refresh' }) }
  api.defaults.adapter = () => assert.fail('Old request crossed into a different login')
  const request = api.get('/payments')
  const assertion = assert.rejects(request, error => error.code === 'ERR_CANCELED')
  await tick()
  auth.saveSession({ userId: 2, role: 'Member', token: 'second-account-token', refreshTokenKey: 'second-refresh' }, 'second-account-token', false)
  pending.resolve()
  await assertion
  assert.equal(auth.getToken(), 'second-account-token')
  assert.equal(auth.getRefreshTokenKey(), 'second-refresh')
  assert.equal(window.location.href, '')
})

test('a delayed denied response from a previous login cannot log out or retry as a new account', async () => {
  login(jwt(900))
  const pending = deferred()
  api.defaults.adapter = async config => { await pending.promise; throw rejected(config, 401) }
  axios.defaults.adapter = () => assert.fail('Old login must not refresh the new account')
  const assertion = assert.rejects(api.get('/payments'), error => error.code === 'ERR_CANCELED')
  await tick()
  auth.saveSession({ userId: 2, role: 'Member', token: 'second-token' }, 'second-token', false)
  pending.resolve()
  await assertion
  assert.equal(auth.getToken(), 'second-token')
  assert.equal(window.location.href, '')
})

test('a successful late response from a previous login is discarded', async () => {
  login(jwt(900))
  const pending = deferred()
  api.defaults.adapter = async config => { await pending.promise; return response(config, { privateData: 'old-account' }) }
  const assertion = assert.rejects(api.get('/members/me'), error => error.code === 'ERR_CANCELED')
  await tick()
  auth.saveSession({ userId: 2, role: 'Member', token: 'second-token' }, 'second-token', true)
  pending.resolve()
  await assertion
  assert.equal(auth.getToken(), 'second-token')
})

test('an evicted tab cannot send protected requests or overwrite the new remembered login with a late refresh', async () => {
  login(jwt(900), true)
  remembered.set(auth.ACTIVE_LOGIN_KEY, 'new-login')
  remembered.set('loginSessionId', 'new-login')
  remembered.set('token', 'new-token')
  remembered.set('refreshTokenKey', 'new-refresh')
  api.defaults.adapter = () => assert.fail('Evicted tab sent a protected request')
  await assert.rejects(api.get('/payments'), error => error.code === 'ERR_CANCELED')
  assert.equal(auth.updateSessionTokens('late-token', 'late-refresh'), false)
  auth.clearSession()
  assert.equal(remembered.get('token'), 'new-token')
  assert.equal(remembered.get('refreshTokenKey'), 'new-refresh')
})
