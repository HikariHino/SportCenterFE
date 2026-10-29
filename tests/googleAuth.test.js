import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { getGoogleClientId, getGoogleLoginErrorMessage } from '../src/utils/googleAuth.js'

let server, api, service, auth
const savedGlobals = new Map()
const memoryStorage = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear() }
}
before(async () => {
  for (const key of ['localStorage', 'sessionStorage']) {
    savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, value: memoryStorage() })
  }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
  api = (await server.ssrLoadModule('/src/services/api.js')).default
  service = await server.ssrLoadModule('/src/services/authService.js')
  auth = await server.ssrLoadModule('/src/utils/auth.js')
})
after(async () => {
  await server?.close()
  for (const [key, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
})

test('Google API sends only the ID token, bypassing stale application credentials', async () => {
  localStorage.setItem('token', 'expired-application-token')
  const controller = new AbortController()
  api.defaults.adapter = async config => {
    assert.equal(config.url, '/Auth/google')
    assert.equal(config.method, 'post')
    assert.deepEqual(JSON.parse(config.data), { idToken: 'google-id-token' })
    assert.equal(config.skipAuth, true)
    assert.equal(config.headers.Authorization, undefined)
    assert.equal(config.signal, controller.signal)
    assert.equal(config.timeout, 15000)
    return { data: { userId: 8, role: 'Member', token: ' be-jwt ', refreshTokenKey: 'refresh-key' }, status: 200, headers: {}, config }
  }
  const session = await service.loginWithGoogle({ idToken: 'google-id-token', role: 'Manager' }, { signal: controller.signal })
  assert.equal(session.token, 'be-jwt')
  assert.equal(localStorage.getItem('token'), 'expired-application-token')
  localStorage.clear()
})

test('Google login normalizes an envelope and preserves the server role', async () => {
  api.defaults.adapter = async config => ({ data: { success: true, data: { userId: 3, role: 'Coach', accessToken: 'coach-jwt' } }, status: 200, headers: {}, config })
  const result = await service.loginWithGoogle({ idToken: 'credential' })
  assert.equal(result.token, 'coach-jwt')
  assert.equal(result.role, 'Coach')
})

test('empty, missing and oversized credentials never call the API', async () => {
  let requests = 0
  api.defaults.adapter = async () => { requests++; throw new Error('Unexpected request') }
  for (const idToken of [undefined, '', '  ', 'x'.repeat(4097)]) {
    await assert.rejects(service.loginWithGoogle({ idToken }), /Invalid Google credential/)
  }
  assert.equal(requests, 0)
})

test('failed responses and missing backend sessions are rejected without saving credentials', async () => {
  for (const body of [{ success: false, statusCode: 401, message: 'Google token is invalid.' }, { message: 'Success without token' }]) {
    api.defaults.adapter = async config => ({ data: body, status: 200, headers: {}, config })
    await assert.rejects(service.loginWithGoogle({ idToken: 'credential' }))
    assert.equal(localStorage.getItem('token'), null)
    assert.equal(sessionStorage.getItem('token'), null)
  }
})

test('Google 401 does not refresh an unrelated session or redirect the page', async () => {
  let requests = 0
  api.defaults.adapter = async config => {
    requests++
    const error = new Error('Unauthorized')
    error.config = config
    error.response = { status: 401, data: { message: 'Account is disabled.' } }
    throw error
  }
  await assert.rejects(service.loginWithGoogle({ idToken: 'credential' }), error => /vô hiệu hóa/.test(getGoogleLoginErrorMessage(error)))
  assert.equal(requests, 1)
})

test('Google session uses the existing role destinations, remember choice and safe return URLs', () => {
  for (const [role, destination] of [['Member', '/member'], ['Coach', '/coach'], ['Receptionist', '/receptionist'], ['CenterManager', '/manager']]) {
    sessionStorage.clear(); localStorage.clear()
    const user = auth.saveSession({ userId: 4, role, token: 'be-jwt', refreshTokenKey: 'be-refresh' }, 'be-jwt', false)
    assert.equal(auth.getAuthDestination(user.role, 'https://untrusted.example/'), destination)
    assert.equal(sessionStorage.getItem('token'), 'be-jwt')
    assert.equal(sessionStorage.getItem('refreshTokenKey'), 'be-refresh')
    assert.equal(localStorage.getItem('token'), null)
    assert.doesNotMatch(sessionStorage.getItem('user'), /idToken|credential/)
  }
  auth.saveSession({ role: 'Member', token: 'remembered-jwt' }, 'remembered-jwt', true)
  assert.equal(localStorage.getItem('token'), 'remembered-jwt')
  assert.equal(auth.getAuthDestination('member', '/payment/success?orderCode=12'), '/payment/success?orderCode=12')
  assert.equal(auth.getAuthDestination('member', '/member?view=support'), '/member?view=support')
  sessionStorage.clear(); localStorage.clear()
})

test('Google errors distinguish locked accounts, unverified email, invalid tokens, network and configuration', () => {
  const error = (status, message) => ({ response: { status, data: { message } } })
  assert.match(getGoogleLoginErrorMessage(error(401, 'Account is disabled.')), /vô hiệu hóa/)
  assert.match(getGoogleLoginErrorMessage(error(401, 'Google email is not verified.')), /chưa được xác minh/)
  assert.match(getGoogleLoginErrorMessage(error(401, 'Google token is invalid.')), /hết hạn/)
  assert.doesNotMatch(getGoogleLoginErrorMessage(error(401, 'Unauthorized')), /mật khẩu không chính xác/)
  assert.match(getGoogleLoginErrorMessage(error(503, 'Google login is not configured.')), /chưa khả dụng/)
  assert.match(getGoogleLoginErrorMessage({ code: 'ERR_NETWORK' }), /kết nối/)
  assert.match(getGoogleLoginErrorMessage({ code: 'ECONNABORTED' }), /thời gian chờ/)
  assert.doesNotMatch(getGoogleLoginErrorMessage(error(500, 'private stack trace')), /private/)
})

test('missing and placeholder client IDs are unavailable', () => {
  for (const value of [undefined, '', 'your-google-web-client-id.apps.googleusercontent.com', 'not-a-client']) assert.equal(getGoogleClientId(value), '')
  assert.equal(getGoogleClientId(' 1234567890-abc123.apps.googleusercontent.com '), '1234567890-abc123.apps.googleusercontent.com')
})
